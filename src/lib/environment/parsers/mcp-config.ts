/**
 * Parse MCP server configurations from Claude Code and Codex.
 * Claude: .mcp.json (JSON format)
 * Codex: config.toml [mcp_servers] section
 */

import type { EnvironmentArtifact, ToolPersona, ArtifactScope } from "../types";
import { computeHash, safePreview, safeStat, safeReadFile } from "./utils";
import { parseTOML } from "./toml";

/**
 * Raw shape of a single MCP server entry in a .mcp.json file.
 * Extended by plugin-MCP loader; exported so both callers share the same type.
 */
export interface RawMcpServerEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  transport?: string;
  entry?: string;
  [key: string]: unknown;
}

/**
 * Parse a .mcp.json file and return its `mcpServers` map.
 *
 * Returns `null` when the file cannot be read or is not valid JSON.
 * Returns `{}` when the JSON parses but contains no `mcpServers` key.
 *
 * This is the authoritative low-level parser (TDR-035 §2). The environment
 * artifact builder and the plugin-MCP loader both delegate here.
 */
export function parseMcpConfigFile(
  filePath: string
): Record<string, RawMcpServerEntry> | null {
  const content = safeReadFile(filePath);
  if (!content) return null;
  try {
    const config = JSON.parse(content) as { mcpServers?: Record<string, RawMcpServerEntry> };
    return config.mcpServers ?? {};
  } catch {
    return null; // caller decides what to do with parse failures
  }
}

/** Parse Claude Code .mcp.json file. */
export function parseClaudeMcpConfig(
  filePath: string,
  scope: ArtifactScope,
  baseDir: string
): EnvironmentArtifact[] {
  const servers = parseMcpConfigFile(filePath);
  if (!servers) return [];

  const stat = safeStat(filePath);
  if (!stat) return [];

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
