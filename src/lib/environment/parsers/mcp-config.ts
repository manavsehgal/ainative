/**
 * Parse MCP server configurations from Claude Code and Codex.
 * Claude: .mcp.json (JSON format)
 * Codex: config.toml [mcp_servers] section
 */

import type { EnvironmentArtifact, ToolPersona, ArtifactScope } from "../types";
import { computeHash, safePreview, safeStat, safeReadFile } from "./utils";
import { parseTOML } from "./toml";

interface McpServerEntry {
  command?: string;
  args?: string[];
  url?: string;
  [key: string]: unknown;
}

/** Parse Claude Code .mcp.json file. */
export function parseClaudeMcpConfig(
  filePath: string,
  scope: ArtifactScope,
  baseDir: string
): EnvironmentArtifact[] {
  const content = safeReadFile(filePath);
  if (!content) return [];

  const stat = safeStat(filePath);
  if (!stat) return [];

  try {
    const config = JSON.parse(content) as { mcpServers?: Record<string, McpServerEntry> };
    const servers = config.mcpServers || {};

    return Object.entries(servers).map(([name, entry]) => ({
      tool: "claude-code" as ToolPersona,
      category: "mcp-server" as const,
      scope,
      name,
      relPath: filePath.replace(baseDir, "").replace(/^\//, ""),
      absPath: filePath,
      contentHash: computeHash(JSON.stringify(entry)),
      preview: `${name}: ${entry.command || entry.url || "unknown"} ${(entry.args || []).join(" ")}`.trim(),
      metadata: { ...entry },
      sizeBytes: stat.size,
      modifiedAt: stat.mtimeMs,
    }));
  } catch {
    return [];
  }
}

/** Parse Codex config.toml for MCP servers. */
export function parseCodexMcpConfig(
  filePath: string,
  baseDir: string
): EnvironmentArtifact[] {
  const content = safeReadFile(filePath);
  if (!content) return [];

  const stat = safeStat(filePath);
  if (!stat) return [];

  const config = parseTOML(content);
  if (!config) return [];

  const servers = (config.mcp_servers || {}) as Record<string, unknown>;

  return Object.entries(servers).map(([name, entry]) => ({
    tool: "codex" as ToolPersona,
    category: "mcp-server" as const,
    scope: "user" as const,
    name,
    relPath: filePath.replace(baseDir, "").replace(/^\//, ""),
    absPath: filePath,
    contentHash: computeHash(JSON.stringify(entry)),
    preview: `${name}: ${JSON.stringify(entry).slice(0, 200)}`,
    metadata: { ...(entry as Record<string, unknown>) },
    sizeBytes: stat.size,
    modifiedAt: stat.mtimeMs,
  }));
}
