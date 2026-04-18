/**
 * Hook sync: export hook definitions between formats.
 * Claude Code hooks are JSON/shell scripts in .claude/hooks/.
 * Codex doesn't have a direct equivalent — exports as documentation.
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { safeReadFile } from "../parsers/utils";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";
import type { SyncOperation } from "./skill-sync";

/**
 * Export a hook definition to a target path.
 * Copies the hook file content with a header comment.
 */
export function prepareHookSync(
  artifact: EnvironmentArtifactRow,
  targetPath: string
): SyncOperation {
  const content = safeReadFile(artifact.absPath) || "";
  const existingContent = safeReadFile(targetPath);

  // Add a header indicating this was synced
  const header = `# Hook: ${artifact.name}\n# Synced from ${artifact.tool} by ainative\n# Source: ${artifact.absPath}\n\n`;

  return {
    targetPath,
    content: header + content,
    isNew: existingContent === null,
    existingContent,
  };
}

/** Execute a hook sync. */
export function executeHookSync(op: SyncOperation): void {
  mkdirSync(dirname(op.targetPath), { recursive: true });
  writeFileSync(op.targetPath, op.content, "utf-8");
}
