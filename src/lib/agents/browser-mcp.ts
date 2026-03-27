import { getSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

// ── MCP server config type (matches Claude Agent SDK shape) ──────────

interface McpServerConfig {
  command: string;
  args: string[];
}

// ── Read-only browser tools — auto-approved in chat & task permission callbacks

export const BROWSER_READ_ONLY_TOOLS = new Set([
  // Chrome DevTools MCP — read-only
  "mcp__chrome-devtools__take_screenshot",
  "mcp__chrome-devtools__take_snapshot",
  "mcp__chrome-devtools__take_memory_snapshot",
  "mcp__chrome-devtools__list_pages",
  "mcp__chrome-devtools__list_console_messages",
  "mcp__chrome-devtools__list_network_requests",
  "mcp__chrome-devtools__get_console_message",
  "mcp__chrome-devtools__get_network_request",
  "mcp__chrome-devtools__lighthouse_audit",
  "mcp__chrome-devtools__performance_start_trace",
  "mcp__chrome-devtools__performance_stop_trace",
  "mcp__chrome-devtools__performance_analyze_insight",
  // Playwright MCP — read-only
  "mcp__playwright__browser_snapshot",
  "mcp__playwright__browser_console_messages",
  "mcp__playwright__browser_network_requests",
  "mcp__playwright__browser_tabs",
  "mcp__playwright__browser_take_screenshot",
]);

// ── Helper: check if a tool name belongs to a browser MCP server ─────

export function isBrowserTool(toolName: string): boolean {
  return (
    toolName.startsWith("mcp__chrome-devtools__") ||
    toolName.startsWith("mcp__playwright__")
  );
}

export function isBrowserReadOnly(toolName: string): boolean {
  return BROWSER_READ_ONLY_TOOLS.has(toolName);
}

// ── Config builder ───────────────────────────────────────────────────

function parseExtraArgs(config: string | null): string[] {
  if (!config) return [];
  const trimmed = config.trim();
  if (!trimmed) return [];

  // Try JSON array first (e.g. '["--browser", "firefox"]')
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((a): a is string => typeof a === "string");
    } catch {
      // Fall through to space-split
    }
  }

  // Plain string: split on whitespace (e.g. "--headless --browser-url http://localhost:9222")
  return trimmed.split(/\s+/).filter(Boolean);
}

/**
 * Read browser MCP settings from DB and return MCP server configs
 * for any enabled browser servers.
 *
 * Returns `{}` when neither server is enabled — zero overhead.
 */
export async function getBrowserMcpServers(): Promise<Record<string, McpServerConfig>> {
  const [chromeEnabled, playwrightEnabled, chromeConfig, playwrightConfig] =
    await Promise.all([
      getSetting(SETTINGS_KEYS.BROWSER_MCP_CHROME_DEVTOOLS_ENABLED),
      getSetting(SETTINGS_KEYS.BROWSER_MCP_PLAYWRIGHT_ENABLED),
      getSetting(SETTINGS_KEYS.BROWSER_MCP_CHROME_DEVTOOLS_CONFIG),
      getSetting(SETTINGS_KEYS.BROWSER_MCP_PLAYWRIGHT_CONFIG),
    ]);

  const servers: Record<string, McpServerConfig> = {};

  if (chromeEnabled === "true") {
    const extraArgs = parseExtraArgs(chromeConfig);
    servers["chrome-devtools"] = {
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest", ...extraArgs],
    };
  }

  if (playwrightEnabled === "true") {
    const extraArgs = parseExtraArgs(playwrightConfig);
    servers.playwright = {
      command: "npx",
      args: ["-y", "@playwright/mcp@latest", ...extraArgs],
    };
  }

  return servers;
}

/**
 * Build the allowedTools glob patterns for enabled browser MCP servers.
 * Returns an empty array when no browser servers are enabled.
 */
export async function getBrowserAllowedToolPatterns(): Promise<string[]> {
  const [chromeEnabled, playwrightEnabled] = await Promise.all([
    getSetting(SETTINGS_KEYS.BROWSER_MCP_CHROME_DEVTOOLS_ENABLED),
    getSetting(SETTINGS_KEYS.BROWSER_MCP_PLAYWRIGHT_ENABLED),
  ]);

  const patterns: string[] = [];
  if (chromeEnabled === "true") patterns.push("mcp__chrome-devtools__*");
  if (playwrightEnabled === "true") patterns.push("mcp__playwright__*");
  return patterns;
}
