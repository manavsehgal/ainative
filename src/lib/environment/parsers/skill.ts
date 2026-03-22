/**
 * Parse a skill directory into an EnvironmentArtifact.
 * Skills live in .claude/skills/<name>/ or ~/.codex/skills/<name>/.
 */

import { readdirSync, readFileSync, statSync } from "fs";
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

  // Extract description from YAML frontmatter if present
  const metadata: Record<string, unknown> = {};
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        metadata[key] = value;
      }
    }
  }

  return {
    tool,
    category: "skill",
    scope,
    name,
    relPath: dirPath.replace(baseDir, "").replace(/^\//, ""),
    absPath: dirPath,
    contentHash: computeHash(content),
    preview: safePreview(content),
    metadata,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    modifiedAt: stat.mtimeMs,
  };
}
