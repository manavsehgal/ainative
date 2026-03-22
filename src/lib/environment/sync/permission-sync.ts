/**
 * Permission sync: Claude Code permissions → Codex trust levels.
 * Advisory mapping — Codex uses trust levels (ask/auto-edit/full-auto)
 * while Claude uses explicit allow/deny permission lists.
 */

import { safeReadFile } from "../parsers/utils";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";
import type { SyncOperation } from "./skill-sync";

/**
 * Map Claude Code permissions to a Codex advisory summary.
 * This is informational — Codex trust levels don't map 1:1 to Claude permissions.
 */
export function preparePermissionSync(
  artifact: EnvironmentArtifactRow,
  targetPath: string
): SyncOperation {
  const metadata = artifact.metadata ? JSON.parse(artifact.metadata) : {};
  const rules = (metadata.rules as string[]) || [];
  const type = metadata.type as string || "allow";

  // Generate an advisory markdown summary
  const lines: string[] = [
    `# Permission Advisory (synced from Claude Code)`,
    "",
    `**Type:** ${type}`,
    `**Rules:**`,
    ...rules.map((r: string) => `- \`${r}\``),
    "",
    `> Note: Codex uses trust levels (ask/auto-edit/full-auto) rather than explicit permissions.`,
    `> Review these rules and adjust your Codex \`approval_mode\` in config.toml accordingly.`,
  ];

  const content = lines.join("\n");
  const existingContent = safeReadFile(targetPath);

  return {
    targetPath,
    content,
    isNew: existingContent === null,
    existingContent,
  };
}
