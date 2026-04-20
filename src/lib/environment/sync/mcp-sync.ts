/**
 * MCP server sync: .mcp.json (Claude) ↔ config.toml (Codex).
 * Adds/removes MCP server entries across tool configs.
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { safeReadFile } from "../parsers/utils";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";
import type { SyncOperation } from "./skill-sync";
import { getLaunchCwd } from "../workspace-context";
import type { PluginMcpRegistration } from "@/lib/plugins/mcp-loader";

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

/**
 * Build a SyncOperation that merges plugin-owned MCP server entries into
 * Codex's config.toml. Non-plugin entries are preserved verbatim.
 *
 * Namespace: `<pluginId>-<serverName>` (dash separator, per TDR-035 §1).
 *
 * - Accepted + stdio  → write/update section
 * - Accepted + ainative-sdk → skip (log only; Codex doesn't speak this transport)
 * - Disabled / pending → strip existing section if present
 *
 * @param registrations  All registrations (accepted AND disabled) for the
 *                       current plugin set. Caller obtains these from
 *                       `listPluginMcpRegistrations()`.
 * @param targetPath     Path to config.toml. Defaults to ~/.codex/config.toml.
 *                       Accepts an override so tests can use a temp file.
 */
export function preparePluginMcpCodexSync(
  registrations: PluginMcpRegistration[],
  targetPath?: string
): SyncOperation {
  const resolvedPath =
    targetPath ?? join(homedir(), ".codex", "config.toml");

  const existing = safeReadFile(resolvedPath) || "";

  // Build a set of all plugin-owned section keys (accepted + disabled).
  // We'll strip all of them first, then re-add the accepted ones.
  const pluginKeys = new Set(
    registrations.map((r) => `${r.pluginId}-${r.serverName}`)
  );

  // Strip all existing plugin-owned sections from the config using a line-based
  // approach. The previous regex `[^\[]*` stopped at the first `[` character,
  // which broke on inline TOML arrays (e.g. `args = ["a.js"]`) and on
  // `[mcp_servers.<key>.env]` sub-tables (orphaned child table bug, C1).
  //
  // Algorithm: iterate lines; when a section header belonging to a plugin-owned
  // key is encountered (parent or .env child), enter "skip mode" and drop lines
  // until the next section header or EOF; any other section header ends skip mode.
  const lines = existing.split("\n");
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    // Match any TOML section header: `[something]` on its own line.
    const headerMatch = line.match(/^\[([^\]]+)\]\s*$/);
    if (headerMatch) {
      const header = headerMatch[1];
      if (header.startsWith("mcp_servers.")) {
        // Could be `mcp_servers.<key>` or `mcp_servers.<key>.env` (or other sub-table).
        const rest = header.slice("mcp_servers.".length);
        const dotIdx = rest.indexOf(".");
        const baseKey = dotIdx === -1 ? rest : rest.slice(0, dotIdx);
        if (pluginKeys.has(baseKey)) {
          skipping = true;
          continue;
        }
      }
      // Any other section header ends skip mode.
      skipping = false;
    }
    if (!skipping) {
      kept.push(line);
    }
  }

  // Trim trailing whitespace/blank lines left by stripping, keep a tidy file.
  let content = kept.join("\n").trimEnd();

  // Append fresh sections for each accepted stdio registration.
  for (const reg of registrations) {
    if (reg.status !== "accepted") {
      // disabled / pending — already stripped above; nothing to add.
      continue;
    }

    const key = `${reg.pluginId}-${reg.serverName}`;

    if (reg.transport === "ainative-sdk") {
      // Codex doesn't speak the ainative-sdk transport — skip silently.
      // (Callers that need visibility can check their own logs.)
      continue;
    }

    // stdio transport — emit a [mcp_servers.<key>] section.
    const lines: string[] = [];
    lines.push(`[mcp_servers.${key}]`);
    if (reg.config.command) {
      lines.push(`command = "${reg.config.command}"`);
    }
    if (reg.config.args && reg.config.args.length > 0) {
      const argsStr = reg.config.args.map((a) => `"${a}"`).join(", ");
      lines.push(`args = [${argsStr}]`);
    }
    if (reg.config.env && Object.keys(reg.config.env).length > 0) {
      lines.push(`[mcp_servers.${key}.env]`);
      for (const [k, v] of Object.entries(reg.config.env)) {
        lines.push(`${k} = "${v}"`);
      }
    }

    content = content + "\n\n" + lines.join("\n") + "\n";
  }

  // Ensure file ends with a single newline.
  content = content.trimEnd() + "\n";

  return {
    targetPath: resolvedPath,
    content,
    isNew: !existing,
    existingContent: existing || null,
  };
}

/**
 * Orchestrator: load all plugin MCP registrations and sync them into
 * ~/.codex/config.toml, then write the result to disk.
 *
 * Call this before creating a new CodexAppServerClient so the next
 * Codex session picks up the current plugin set.
 *
 * Dynamic import of listPluginMcpRegistrations is required per TDR-032
 * (avoids module-load cycles that would cause ReferenceError at runtime).
 */
export async function syncPluginMcpToCodex(): Promise<void> {
  const { listPluginMcpRegistrations } = await import(
    "@/lib/plugins/mcp-loader"
  );
  const registrations = await listPluginMcpRegistrations();
  const op = preparePluginMcpCodexSync(registrations);
  writeFileSync(op.targetPath, op.content, "utf8");
}
