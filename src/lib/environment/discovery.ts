/**
 * Workspace discovery engine.
 * Walks a parent directory to find child folders with .claude/ or .codex/ markers.
 * Lightweight — uses stat checks only, no file content reading.
 */

import { existsSync, readdirSync, readFileSync, realpathSync, type Dirent } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { safeStat } from "./parsers/utils";

// ── Types ──────────────────────────────────────────────────────────────

export type DiscoveryMarker = "claude" | "codex";

export interface DiscoveryOptions {
  parentDir: string;
  maxDepth: number;
  markers: DiscoveryMarker[];
}

export interface ArtifactHints {
  skillCount: number;
  mcpServerCount: number;
  hasInstructions: boolean;
  hasMemory: boolean;
}

export interface DiscoveredProject {
  path: string;
  folderName: string;
  markers: DiscoveryMarker[];
  artifactHints: ArtifactHints;
  totalArtifactEstimate: number;
  gitBranch: string | null;
  lastModified: number;
  alreadyImported: boolean;
}

export interface DiscoveryResult {
  projects: DiscoveredProject[];
  searchPath: string;
  depth: number;
  durationMs: number;
  errors: Array<{ path: string; error: string }>;
}

// ── Skip list ──────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "vendor",
  ".cache",
  "__pycache__",
  ".venv",
  "target",
  ".terraform",
  ".turbo",
  ".vercel",
  ".output",
]);

// ── Helpers ────────────────────────────────────────────────────────────

/** Count direct children in a directory, returning 0 on error. */
function countDirEntries(dirPath: string): number {
  try {
    return readdirSync(dirPath).length;
  } catch {
    return 0;
  }
}

/** Read git branch from .git/HEAD. */
function readGitBranch(projectPath: string): string | null {
  try {
    const headPath = join(projectPath, ".git", "HEAD");
    const content = readFileSync(headPath, "utf-8").trim();
    // "ref: refs/heads/main" → "main"
    if (content.startsWith("ref: refs/heads/")) {
      return content.slice("ref: refs/heads/".length);
    }
    // Detached HEAD — return short SHA
    return content.slice(0, 8);
  } catch {
    return null;
  }
}

/** Gather lightweight artifact hints for a project directory. */
function gatherArtifactHints(
  projectPath: string,
  markers: DiscoveryMarker[]
): { hints: ArtifactHints; total: number } {
  let skillCount = 0;
  let mcpServerCount = 0;
  let hasInstructions = false;
  let hasMemory = false;

  if (markers.includes("claude")) {
    const claudeDir = join(projectPath, ".claude");

    // Skills
    const skillsDir = join(claudeDir, "skills");
    skillCount += countDirEntries(skillsDir);

    // MCP servers
    if (existsSync(join(projectPath, ".mcp.json"))) mcpServerCount++;

    // Instructions
    if (
      existsSync(join(projectPath, "CLAUDE.md")) ||
      existsSync(join(projectPath, "AGENTS.md"))
    ) {
      hasInstructions = true;
    }

    // Memory
    if (existsSync(join(projectPath, "MEMORY.md"))) {
      hasMemory = true;
    }
  }

  if (markers.includes("codex")) {
    const userCodex = join(homedir(), ".codex");

    // Codex skills are user-level, count once
    const codexSkills = join(userCodex, "skills");
    if (existsSync(codexSkills)) {
      skillCount += countDirEntries(codexSkills);
    }

    // Codex MCP from config.toml
    if (existsSync(join(userCodex, "config.toml"))) mcpServerCount++;
  }

  const total =
    skillCount +
    mcpServerCount +
    (hasInstructions ? 1 : 0) +
    (hasMemory ? 1 : 0);

  return {
    hints: { skillCount, mcpServerCount, hasInstructions, hasMemory },
    total,
  };
}

/** Check which markers exist in a directory. */
function detectMarkers(
  dirPath: string,
  wantedMarkers: DiscoveryMarker[]
): DiscoveryMarker[] {
  const found: DiscoveryMarker[] = [];

  if (wantedMarkers.includes("claude") && existsSync(join(dirPath, ".claude"))) {
    found.push("claude");
  }
  if (wantedMarkers.includes("codex") && existsSync(join(dirPath, ".codex"))) {
    found.push("codex");
  }

  return found;
}

/** Get the most recent mtime from marker directories. */
function getLastModified(dirPath: string, markers: DiscoveryMarker[]): number {
  let latest = 0;

  for (const marker of markers) {
    const markerDir =
      marker === "claude"
        ? join(dirPath, ".claude")
        : join(dirPath, ".codex");
    const stat = safeStat(markerDir);
    if (stat && stat.mtimeMs > latest) {
      latest = stat.mtimeMs;
    }
  }

  return latest;
}

// ── Main ───────────────────────────────────────────────────────────────

/**
 * Recursively discover projects under a parent directory.
 * Only directories with .claude/ or .codex/ markers are included.
 */
export function discoverWorkspace(options: DiscoveryOptions): DiscoveryResult {
  const start = performance.now();
  const projects: DiscoveredProject[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  const visited = new Set<string>(); // real paths to avoid symlink cycles

  function walk(dirPath: string, currentDepth: number): void {
    if (currentDepth > options.maxDepth) return;

    let entries: Dirent[];
    try {
      entries = readdirSync(dirPath, { withFileTypes: true }) as Dirent[];
    } catch (err) {
      errors.push({
        path: dirPath,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const name = String(entry.name);
      if (SKIP_DIRS.has(name)) continue;
      if (name.startsWith(".") && name !== ".claude" && name !== ".codex") continue;

      const childPath = join(dirPath, name);

      // Resolve symlinks to avoid cycles
      let realPath: string;
      try {
        realPath = realpathSync(childPath);
      } catch {
        continue; // broken symlink
      }

      if (visited.has(realPath)) continue;
      visited.add(realPath);

      // Check for markers at this level
      const foundMarkers = detectMarkers(childPath, options.markers);

      if (foundMarkers.length > 0) {
        const { hints, total } = gatherArtifactHints(childPath, foundMarkers);

        projects.push({
          path: childPath,
          folderName: basename(childPath),
          markers: foundMarkers,
          artifactHints: hints,
          totalArtifactEstimate: total,
          gitBranch: readGitBranch(childPath),
          lastModified: getLastModified(childPath, foundMarkers),
          alreadyImported: false, // set by API layer after DB lookup
        });
      }

      // Recurse deeper if within depth limit
      if (currentDepth < options.maxDepth) {
        walk(childPath, currentDepth + 1);
      }
    }
  }

  walk(options.parentDir, 1);

  // Sort by folder name
  projects.sort((a, b) => a.folderName.localeCompare(b.folderName));

  return {
    projects,
    searchPath: options.parentDir,
    depth: options.maxDepth,
    durationMs: Math.round(performance.now() - start),
    errors,
  };
}
