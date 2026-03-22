/**
 * Skill sync: SKILL.md (YAML+md) ↔ Codex skill (plain md).
 * Handles copying skill directories and translating frontmatter format.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync } from "fs";
import { join, basename, dirname } from "path";
import { homedir } from "os";
import { safeReadFile, safeStat } from "../parsers/utils";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";

export interface SyncOperation {
  targetPath: string;
  content: string;
  isNew: boolean;
  existingContent: string | null;
}

/**
 * Prepare a skill sync from Claude Code to Codex.
 * Claude skills have SKILL.md with YAML frontmatter.
 * Codex skills are plain markdown files.
 */
export function prepareSkillToCodex(artifact: EnvironmentArtifactRow): SyncOperation {
  const content = safeReadFile(artifact.absPath) || "";
  const skillName = artifact.name;
  const targetDir = join(homedir(), ".codex", "skills", skillName);
  const targetFile = join(targetDir, `${skillName}.md`);

  // Strip YAML frontmatter for Codex format (Codex uses plain markdown)
  let codexContent = content;
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n*/);
  if (fmMatch) {
    codexContent = content.slice(fmMatch[0].length).trim();
  }

  const existingContent = safeReadFile(targetFile);

  return {
    targetPath: targetFile,
    content: codexContent,
    isNew: existingContent === null,
    existingContent,
  };
}

/**
 * Prepare a skill sync from Codex to Claude Code.
 * Codex skills are plain markdown.
 * Claude skills have SKILL.md with YAML frontmatter.
 */
export function prepareSkillToClaude(artifact: EnvironmentArtifactRow): SyncOperation {
  const content = safeReadFile(artifact.absPath) || "";
  const skillName = artifact.name;
  const targetDir = join(homedir(), ".claude", "skills", skillName);
  const targetFile = join(targetDir, "SKILL.md");

  // Add YAML frontmatter for Claude format
  let claudeContent = content;
  if (!content.startsWith("---\n")) {
    // Extract first line as description if it looks like one
    const firstLine = content.split("\n")[0]?.trim() || "";
    const description = firstLine.startsWith("#")
      ? firstLine.replace(/^#+\s*/, "")
      : skillName;

    claudeContent = `---\nname: ${skillName}\ndescription: ${description}\n---\n\n${content}`;
  }

  const existingContent = safeReadFile(targetFile);

  return {
    targetPath: targetFile,
    content: claudeContent,
    isNew: existingContent === null,
    existingContent,
  };
}

/** Execute a skill sync by writing the file. */
export function executeSkillSync(op: SyncOperation): void {
  mkdirSync(dirname(op.targetPath), { recursive: true });
  writeFileSync(op.targetPath, op.content, "utf-8");
}

/** Prepare a skill sync based on artifact tool and target. */
export function prepareSkillSync(
  artifact: EnvironmentArtifactRow,
  targetTool: string
): SyncOperation {
  if (targetTool === "codex") {
    return prepareSkillToCodex(artifact);
  }
  return prepareSkillToClaude(artifact);
}
