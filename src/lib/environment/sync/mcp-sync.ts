/**
 * MCP server sync: .mcp.json (Claude) ↔ config.toml (Codex).
 * Adds/removes MCP server entries across tool configs.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { safeReadFile } from "../parsers/utils";
import { parseTOML } from "../parsers/toml";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";
import type { SyncOperation } from "./skill-sync";
import { getLaunchCwd } from "../workspace-context";

interface McpServerEntry {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Add an MCP server to Claude Code's .mcp.json.
 */
export function prepareMcpToClaude(
  artifact: EnvironmentArtifactRow,
  scope: "user" | "project",
  projectDir?: string
): SyncOperation {
  const metadata = artifact.metadata ? JSON.parse(artifact.metadata) : {};
  const serverName = artifact.name;

  const targetPath =
    scope === "user"
      ? join(homedir(), ".claude", ".mcp.json")
      : join(projectDir || getLaunchCwd(), ".claude", ".mcp.json");

  const existing = safeReadFile(targetPath);
  let config: { mcpServers: Record<string, McpServerEntry> };

  try {
    config = existing ? JSON.parse(existing) : { mcpServers: {} };
  } catch {
    config = { mcpServers: {} };
  }

  // Add/update the server entry
  config.mcpServers[serverName] = {
    command: metadata.command as string,
    args: metadata.args as string[],
    ...(metadata.url ? { url: metadata.url as string } : {}),
    ...(metadata.env ? { env: metadata.env as Record<string, string> } : {}),
  };

  const content = JSON.stringify(config, null, 2);

  return {
    targetPath,
    content,
    isNew: !existing,
    existingContent: existing,
  };
}

/**
 * Add an MCP server to Codex's config.toml.
 * Appends a [mcp_servers.<name>] section.
 */
export function prepareMcpToCodex(
  artifact: EnvironmentArtifactRow
): SyncOperation {
  const metadata = artifact.metadata ? JSON.parse(artifact.metadata) : {};
  const serverName = artifact.name;
  const targetPath = join(homedir(), ".codex", "config.toml");

  const existing = safeReadFile(targetPath) || "";

  // Build the TOML section for this server
  const lines: string[] = [];
  lines.push(`[mcp_servers.${serverName}]`);
  if (metadata.command) lines.push(`command = "${metadata.command}"`);
  if (metadata.args && Array.isArray(metadata.args)) {
    const argsStr = metadata.args.map((a: string) => `"${a}"`).join(", ");
    lines.push(`args = [${argsStr}]`);
  }
  if (metadata.url) lines.push(`url = "${metadata.url}"`);

  const newSection = lines.join("\n");

  // Check if section already exists
  const sectionRegex = new RegExp(`\\[mcp_servers\\.${serverName}\\]`);
  let content: string;

  if (sectionRegex.test(existing)) {
    // Replace existing section (up to next section or EOF)
    content = existing.replace(
      new RegExp(`\\[mcp_servers\\.${serverName}\\][^\\[]*`),
      newSection + "\n\n"
    );
  } else {
    // Append new section
    content = existing.trimEnd() + "\n\n" + newSection + "\n";
  }

  return {
    targetPath,
    content,
    isNew: !existing,
    existingContent: existing || null,
  };
}

/** Prepare an MCP sync based on target tool. */
export function prepareMcpSync(
  artifact: EnvironmentArtifactRow,
  targetTool: string,
  scope?: "user" | "project",
  projectDir?: string
): SyncOperation {
  if (targetTool === "claude-code") {
    return prepareMcpToClaude(artifact, scope || "user", projectDir);
  }
  return prepareMcpToCodex(artifact);
}
