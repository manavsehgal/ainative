/**
 * Instruction sync: CLAUDE.md ↔ AGENTS.md content merging.
 * Appends content from one instruction file to another.
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { mkdirSync } from "fs";
import { safeReadFile } from "../parsers/utils";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";
import type { SyncOperation } from "./skill-sync";

/**
 * Prepare instruction sync — copies content to the target instruction file.
 * For CLAUDE.md → AGENTS.md: appends Claude-specific sections.
 * For AGENTS.md → CLAUDE.md: appends shared sections.
 */
export function prepareInstructionSync(
  artifact: EnvironmentArtifactRow,
  targetPath: string
): SyncOperation {
  const sourceContent = safeReadFile(artifact.absPath) || "";
  const existingContent = safeReadFile(targetPath);

  let content: string;

  if (existingContent) {
    // Append a sync marker + source content to avoid overwriting
    const syncMarker = `\n\n<!-- Synced from ${artifact.name} by Stagent -->\n`;

    // Check if already synced (avoid duplicates)
    if (existingContent.includes(`Synced from ${artifact.name}`)) {
      // Replace the previously synced section
      const markerRegex = new RegExp(
        `<!-- Synced from ${artifact.name} by Stagent -->\\n[\\s\\S]*?(?=<!-- Synced from|$)`
      );
      content = existingContent.replace(markerRegex, `${syncMarker.trim()}\n${sourceContent}\n`);
    } else {
      content = existingContent + syncMarker + sourceContent + "\n";
    }
  } else {
    content = sourceContent;
  }

  return {
    targetPath,
    content,
    isNew: existingContent === null,
    existingContent,
  };
}

/** Execute an instruction sync. */
export function executeInstructionSync(op: SyncOperation): void {
  mkdirSync(dirname(op.targetPath), { recursive: true });
  writeFileSync(op.targetPath, op.content, "utf-8");
}
