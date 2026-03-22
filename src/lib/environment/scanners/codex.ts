/**
 * Scanner for Codex CLI artifacts.
 * Reads user-level ~/.codex/ and project-level Codex artifacts.
 */

import { readdirSync, existsSync } from "fs";
import { join } from "path";
import type { EnvironmentArtifact, ScanError } from "../types";
import { parseSkillDir } from "../parsers/skill";
import { parseCodexMcpConfig } from "../parsers/mcp-config";
import { parseCodexSettings } from "../parsers/settings";
import { parseInstructionFile } from "../parsers/instructions";
import { safeStat, safeReadFile, computeHash, safePreview } from "../parsers/utils";

/** Directories/files to skip when scanning ~/.codex/. */
const CODEX_SKIP = new Set([
  "sessions",
  "archived_sessions",
  "shell_snapshots",
  "logs_1.sqlite",
  "logs_1.sqlite-shm",
  "logs_1.sqlite-wal",
  "sqlite",
  "tmp",
  "vendor_imports",
  "log",
  "history.jsonl",
  "session_index.jsonl",
  "state_5.sqlite",
  "auth.json",
  "version.json",
  "models_cache.json",
]);

interface ScanOutput {
  artifacts: EnvironmentArtifact[];
  errors: ScanError[];
}

/** Scan user-level ~/.codex/ directory. */
function scanUserLevel(userHome: string): ScanOutput {
  const codexDir = join(userHome, ".codex");
  const artifacts: EnvironmentArtifact[] = [];
  const errors: ScanError[] = [];

  if (!existsSync(codexDir)) return { artifacts, errors };

  // Skills: ~/.codex/skills/*/
  const skillsDir = join(codexDir, "skills");
  if (existsSync(skillsDir)) {
    try {
      for (const entry of readdirSync(skillsDir)) {
        const skillPath = join(skillsDir, entry);
        const artifact = parseSkillDir(skillPath, "codex", "user", userHome);
        if (artifact) artifacts.push(artifact);
      }
    } catch (e) {
      errors.push({ path: skillsDir, error: String(e) });
    }
  }

  // Config: ~/.codex/config.toml (settings + MCP servers)
  const configPath = join(codexDir, "config.toml");
  if (existsSync(configPath)) {
    artifacts.push(...parseCodexSettings(configPath, userHome));
    artifacts.push(...parseCodexMcpConfig(configPath, userHome));
  }

  // Rules: ~/.codex/rules/
  const rulesDir = join(codexDir, "rules");
  if (existsSync(rulesDir)) {
    try {
      for (const entry of readdirSync(rulesDir)) {
        const rulePath = join(rulesDir, entry);
        const content = safeReadFile(rulePath);
        if (!content) continue;

        const stat = safeStat(rulePath);
        if (!stat?.isFile()) continue;

        artifacts.push({
          tool: "codex",
          category: "rule",
          scope: "user",
          name: entry,
          relPath: rulePath.replace(userHome, "").replace(/^\//, ""),
          absPath: rulePath,
          contentHash: computeHash(content),
          preview: safePreview(content),
          metadata: {},
          sizeBytes: stat.size,
          modifiedAt: stat.mtimeMs,
        });
      }
    } catch (e) {
      errors.push({ path: rulesDir, error: String(e) });
    }
  }

  // Memories: ~/.codex/memories/
  const memoriesDir = join(codexDir, "memories");
  if (existsSync(memoriesDir)) {
    try {
      for (const entry of readdirSync(memoriesDir)) {
        const memPath = join(memoriesDir, entry);
        const content = safeReadFile(memPath);
        if (!content) continue;

        const stat = safeStat(memPath);
        if (!stat?.isFile()) continue;

        artifacts.push({
          tool: "codex",
          category: "memory",
          scope: "user",
          name: entry,
          relPath: memPath.replace(userHome, "").replace(/^\//, ""),
          absPath: memPath,
          contentHash: computeHash(content),
          preview: safePreview(content),
          metadata: {},
          sizeBytes: stat.size,
          modifiedAt: stat.mtimeMs,
        });
      }
    } catch (e) {
      errors.push({ path: memoriesDir, error: String(e) });
    }
  }

  return { artifacts, errors };
}

/** Scan project-level Codex artifacts. */
function scanProjectLevel(projectDir: string): ScanOutput {
  const artifacts: EnvironmentArtifact[] = [];
  const errors: ScanError[] = [];

  // AGENTS.md at project root (shared with Claude Code, but also used by Codex)
  // This is handled by the claude-code scanner's instruction files scan.
  // We only look for Codex-specific project files here.

  // codex.md at project root
  const codexMd = join(projectDir, "codex.md");
  if (existsSync(codexMd)) {
    const artifact = parseInstructionFile(codexMd, "project", projectDir, "codex");
    if (artifact) artifacts.push(artifact);
  }

  return { artifacts, errors };
}

/** Full Codex scan: user-level + project-level. */
export function scanCodex(
  projectDir: string,
  userHome: string
): ScanOutput {
  const user = scanUserLevel(userHome);
  const project = scanProjectLevel(projectDir);

  return {
    artifacts: [...user.artifacts, ...project.artifacts],
    errors: [...user.errors, ...project.errors],
  };
}
