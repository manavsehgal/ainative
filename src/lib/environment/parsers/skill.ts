/**
 * Parse a skill directory into an EnvironmentArtifact.
 * Skills live in .claude/skills/<name>/ or ~/.codex/skills/<name>/.
 */

import { readdirSync, readFileSync } from "fs";
import { join, basename } from "path";
import type { EnvironmentArtifact, ToolPersona, ArtifactScope } from "../types";
import { computeHash, safePreview, safeStat } from "./utils";

export function parseSkillDir(
  dirPath: string,
  tool: ToolPersona,
  scope: ArtifactScope,
  baseDir: string
): EnvironmentArtifact | null {
  const stat = safeStat(dirPath);
  if (!stat?.isDirectory()) return null;

  const name = basename(dirPath);
  // Skip hidden directories (e.g., .system, .DS_Store).
  // These are never user-authored skills and would otherwise
  // surface as spurious profiles under auto-promote.
  if (name.startsWith(".")) return null;
  let mainFile = "";
  let content = "";

  // Look for the primary skill file
  try {
    const files = readdirSync(dirPath);
    const skillFile =
      files.find((f) => f === "SKILL.md") ||
      files.find((f) => f.endsWith(".md")) ||
      files[0];
    if (skillFile) {
      mainFile = join(dirPath, skillFile);
      content = readFileSync(mainFile, "utf-8");
    }
  } catch {
    return null;
  }

  // Extract description from YAML frontmatter if present.
  const metadata: Record<string, unknown> = {};
  let bodyAfterFrontmatter = content;
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n*/);
  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        // Strip surrounding YAML quotes so the UI doesn't leak them.
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        metadata[key] = value;
      }
    }
    bodyAfterFrontmatter = content.slice(fmMatch[0].length);
  }

  // Prefer the frontmatter description as the human-facing preview so the
  // UI does not leak raw YAML. Falls back to post-frontmatter body text.
  const description =
    typeof metadata.description === "string" && metadata.description.length > 0
      ? metadata.description
      : null;
  const preview = description ?? safePreview(bodyAfterFrontmatter);

  return {
    tool,
    category: "skill",
    scope,
    name,
    relPath: dirPath.replace(baseDir, "").replace(/^\//, ""),
    absPath: dirPath,
    contentHash: computeHash(content),
    preview,
    metadata,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    modifiedAt: stat.mtimeMs,
  };
}
