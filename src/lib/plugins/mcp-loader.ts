/**
 * mcp-loader.ts — Plugin-MCP loader skeleton (TDR-035 §2)
 *
 * Scans <AINATIVE_DATA_DIR>/plugins/ for kind: chat-tools entries, parses
 * each plugin's .mcp.json, resolves env templates, verifies binary/entry
 * existence, gates on capability-check (T2), and returns a normalized
 * Record<serverName, NormalizedMcpConfig> ready for adapter consumption.
 *
 * Scope: discovery + capability gate + env-template resolution + file-existence
 * checks + logging. Transport spawning is deferred to T4.
 *
 * Public API:
 *   loadPluginMcpServers(opts?)  — thin projection to accepted Record<name, config>
 *   listPluginMcpRegistrations(opts?)  — full list including disabled entries
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";

import { PluginManifestSchema } from "@/lib/plugins/sdk/types";
import {
  deriveManifestHash,
  isCapabilityAccepted,
} from "@/lib/plugins/capability-check";
import { parseMcpConfigFile } from "@/lib/environment/parsers/mcp-config";
import { getRuntimeFeatures } from "@/lib/agents/runtime/catalog";
import type { AgentRuntimeId } from "@/lib/agents/runtime/catalog";
import {
  getAinativePluginsDir,
  getAinativeDataDir,
  getAinativeLogsDir,
} from "@/lib/utils/ainative-paths";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Normalized MCP server config ready for adapter consumption. */
export interface NormalizedMcpConfig {
  // stdio transport fields
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // in-process SDK transport fields
  transport?: "ainative-sdk";
  entry?: string; // resolved absolute path
}

/** Full registration record including disabled entries. */
export interface PluginMcpRegistration {
  pluginId: string;
  serverName: string;
  transport: "stdio" | "ainative-sdk";
  config: NormalizedMcpConfig;
  status: "accepted" | "disabled" | "pending_capability_accept" | "pending_capability_reaccept";
  disabledReason?:
    | "mcp_parse_error"
    | "server_not_found"
    | "sdk_entry_not_found"
    | "capability_not_accepted"
    | "capability_accept_stale"
    | "invalid_mcp_transport"
    | "ambiguous_mcp_transport"
    | "safe_mode";
  manifestHash?: string;
}

// ---------------------------------------------------------------------------
// Module-level dedup trackers
// ---------------------------------------------------------------------------

/** Once-per-session dedup set for Ollama runtime skip logs: "<pluginId>@<runtime>" */
const ollamaSkipLogged = new Set<string>();

// ---------------------------------------------------------------------------
// Logging — third use of this pattern; extracted inline per DRY rule (extract
// on 3rd use). When a fourth module needs it, promote to plugin-logger.ts.
// ---------------------------------------------------------------------------

function logToFile(line: string): void {
  try {
    const logsDir = getAinativeLogsDir();
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "plugins.log"),
      `${new Date().toISOString()} ${line}\n`
    );
  } catch {
    /* swallow log errors — never let logging break the loader */
  }
}

// ---------------------------------------------------------------------------
// Env template resolution
// ---------------------------------------------------------------------------

/**
 * Resolve ${HOME}, ${AINATIVE_DATA_DIR}, and ${PLUGIN_DIR} in a string.
 * No shell expansion, no nested templates — simple string replace only.
 */
function resolveTemplate(value: string, context: { rootDir: string }): string {
  return value
    .replace(/\$\{HOME\}/g, os.homedir())
    .replace(/\$\{AINATIVE_DATA_DIR\}/g, getAinativeDataDir())
    .replace(/\$\{PLUGIN_DIR\}/g, context.rootDir);
}

/** Apply resolveTemplate to all values in an env object. */
function resolveEnvTemplates(
  env: Record<string, string> | undefined,
  context: { rootDir: string }
): Record<string, string> | undefined {
  if (!env) return undefined;
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, resolveTemplate(v, context)])
  );
}

/** Apply resolveTemplate to all elements of an args array. */
function resolveArgsTemplates(
  args: string[] | undefined,
  context: { rootDir: string }
): string[] | undefined {
  if (!args) return undefined;
  return args.map((a) => resolveTemplate(a, context));
}

// ---------------------------------------------------------------------------
// Command existence check
// ---------------------------------------------------------------------------

/**
 * Determine if a stdio `command` string refers to a relative path (starts
 * with `./` or `../`) that must be resolved and existence-checked.
 * PATH-only commands like "python" or "node" are assumed present.
 */
function isRelativeCommand(command: string): boolean {
  return command.startsWith("./") || command.startsWith("../");
}

// ---------------------------------------------------------------------------
// Per-plugin scan (isolated — exceptions caught at scan loop level)
// ---------------------------------------------------------------------------

interface ScanResult {
  registrations: PluginMcpRegistration[];
}

function scanPlugin(pluginDir: string, pluginId: string): ScanResult {
  const registrations: PluginMcpRegistration[] = [];

  // --- Read plugin.yaml ---
  const pluginYamlPath = path.join(pluginDir, "plugin.yaml");
  let pluginYamlContent: string;
  try {
    pluginYamlContent = fs.readFileSync(pluginYamlPath, "utf-8");
  } catch {
    // Missing plugin.yaml — not a valid plugin directory, skip silently.
    return { registrations };
  }

  // --- Parse manifest ---
  let rawManifest: unknown;
  try {
    rawManifest = yaml.load(pluginYamlContent);
  } catch {
    logToFile(`[mcp-loader] plugin ${pluginId}: plugin.yaml is not valid YAML — skipped`);
    return { registrations };
  }

  const parsed = PluginManifestSchema.safeParse(rawManifest);
  if (!parsed.success) {
    logToFile(
      `[mcp-loader] plugin ${pluginId}: plugin.yaml failed schema validation — skipped`
    );
    return { registrations };
  }

  const manifest = parsed.data;

  // --- Only process kind: chat-tools ---
  if (manifest.kind !== "chat-tools") {
    return { registrations }; // Kind 5 (primitives-bundle) etc. — not our concern
  }

  // --- Parse .mcp.json ---
  const mcpJsonPath = path.join(pluginDir, ".mcp.json");
  const mcpServers = parseMcpConfigFile(mcpJsonPath);
  if (mcpServers === null) {
    logToFile(
      `[mcp-loader] plugin ${pluginId}: .mcp.json missing or invalid JSON (mcp_parse_error)`
    );
    registrations.push({
      pluginId,
      serverName: "",
      transport: "stdio",
      config: {},
      status: "disabled",
      disabledReason: "mcp_parse_error",
    });
    return { registrations };
  }

  // --- Capability check ---
  const manifestHash = deriveManifestHash(pluginYamlContent);
  const capCheck = isCapabilityAccepted(pluginId, manifestHash);

  if (!capCheck.accepted) {
    const reason = capCheck.reason;
    const status =
      reason === "hash_drift" ? "pending_capability_reaccept" : "pending_capability_accept";
    const disabledReason =
      reason === "hash_drift" ? "capability_accept_stale" : "capability_not_accepted";

    logToFile(
      `[mcp-loader] plugin ${pluginId}: capability check failed (${disabledReason})`
    );

    // Emit one registration per server, all in pending state.
    const serverNames = Object.keys(mcpServers);
    if (serverNames.length === 0) {
      registrations.push({
        pluginId,
        serverName: "",
        transport: "stdio",
        config: {},
        status,
        disabledReason,
        manifestHash,
      });
    } else {
      for (const serverName of serverNames) {
        registrations.push({
          pluginId,
          serverName,
          transport: "stdio",
          config: {},
          status,
          disabledReason,
          manifestHash,
        });
      }
    }
    return { registrations };
  }

  // --- Process each server entry ---
  const context = { rootDir: pluginDir };

  for (const [serverName, rawEntry] of Object.entries(mcpServers)) {
    const hasCommand = typeof rawEntry.command === "string" && rawEntry.command.length > 0;
    const isAinativeSdk = rawEntry.transport === "ainative-sdk";

    // Ambiguous: both command and ainative-sdk transport declared
    if (hasCommand && isAinativeSdk) {
      logToFile(
        `[mcp-loader] plugin ${pluginId} server "${serverName}": both command and transport:ainative-sdk declared (ambiguous_mcp_transport)`
      );
      registrations.push({
        pluginId,
        serverName,
        transport: "stdio",
        config: {},
        status: "disabled",
        disabledReason: "ambiguous_mcp_transport",
        manifestHash,
      });
      continue;
    }

    // Invalid: neither command nor ainative-sdk transport
    if (!hasCommand && !isAinativeSdk) {
      logToFile(
        `[mcp-loader] plugin ${pluginId} server "${serverName}": no command or transport:ainative-sdk (invalid_mcp_transport)`
      );
      registrations.push({
        pluginId,
        serverName,
        transport: "stdio",
        config: {},
        status: "disabled",
        disabledReason: "invalid_mcp_transport",
        manifestHash,
      });
      continue;
    }

    // --- Stdio transport ---
    if (hasCommand) {
      const rawCommand = rawEntry.command!;
      const resolvedArgs = resolveArgsTemplates(rawEntry.args, context);
      const resolvedEnv = resolveEnvTemplates(rawEntry.env, context);

      // Existence check for relative commands only
      if (isRelativeCommand(rawCommand)) {
        const absCommand = path.resolve(pluginDir, rawCommand);
        if (!fs.existsSync(absCommand)) {
          logToFile(
            `[mcp-loader] plugin ${pluginId} server "${serverName}": command "${rawCommand}" not found at ${absCommand} (server_not_found)`
          );
          registrations.push({
            pluginId,
            serverName,
            transport: "stdio",
            config: {},
            status: "disabled",
            disabledReason: "server_not_found",
            manifestHash,
          });
          continue;
        }
        // Use absolute path in normalized config
        const config: NormalizedMcpConfig = {
          command: absCommand,
          ...(resolvedArgs !== undefined && { args: resolvedArgs }),
          ...(resolvedEnv !== undefined && { env: resolvedEnv }),
        };
        registrations.push({
          pluginId,
          serverName,
          transport: "stdio",
          config,
          status: "accepted",
          manifestHash,
        });
      } else {
        // PATH-only or absolute command — assume present
        const config: NormalizedMcpConfig = {
          command: rawCommand,
          ...(resolvedArgs !== undefined && { args: resolvedArgs }),
          ...(resolvedEnv !== undefined && { env: resolvedEnv }),
        };
        registrations.push({
          pluginId,
          serverName,
          transport: "stdio",
          config,
          status: "accepted",
          manifestHash,
        });
      }
      continue;
    }

    // --- Ainative-SDK transport ---
    if (isAinativeSdk) {
      const rawEntry2 = rawEntry;
      const entryField = typeof rawEntry2.entry === "string" ? rawEntry2.entry : "";
      if (!entryField) {
        logToFile(
          `[mcp-loader] plugin ${pluginId} server "${serverName}": transport:ainative-sdk missing entry field (sdk_entry_not_found)`
        );
        registrations.push({
          pluginId,
          serverName,
          transport: "ainative-sdk",
          config: {},
          status: "disabled",
          disabledReason: "sdk_entry_not_found",
          manifestHash,
        });
        continue;
      }

      const absEntry = path.resolve(pluginDir, entryField);
      if (!fs.existsSync(absEntry)) {
        logToFile(
          `[mcp-loader] plugin ${pluginId} server "${serverName}": entry "${entryField}" not found at ${absEntry} (sdk_entry_not_found)`
        );
        registrations.push({
          pluginId,
          serverName,
          transport: "ainative-sdk",
          config: {},
          status: "disabled",
          disabledReason: "sdk_entry_not_found",
          manifestHash,
        });
        continue;
      }

      const resolvedEnv = resolveEnvTemplates(rawEntry2.env, context);
      const config: NormalizedMcpConfig = {
        transport: "ainative-sdk",
        entry: absEntry,
        ...(resolvedEnv !== undefined && { env: resolvedEnv }),
      };
      registrations.push({
        pluginId,
        serverName,
        transport: "ainative-sdk",
        config,
        status: "accepted",
        manifestHash,
      });
    }
  }

  return { registrations };
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

/**
 * Scan all plugins and return full registration list (including disabled entries).
 * This is the authoritative source; loadPluginMcpServers projects to accepted-only.
 */
export async function listPluginMcpRegistrations(opts?: {
  runtime?: AgentRuntimeId;
}): Promise<PluginMcpRegistration[]> {
  // Short-circuit: safe mode
  if (process.env.AINATIVE_SAFE_MODE === "true") {
    return [];
  }

  // Short-circuit: runtime that doesn't support plugin MCP servers
  if (opts?.runtime) {
    const features = getRuntimeFeatures(opts.runtime);
    if (!features.supportsPluginMcpServers) {
      // Log once per (pluginId, runtime) pair — we don't have plugin ids yet,
      // so log a single summary and return.
      const logKey = `__summary@${opts.runtime}`;
      if (!ollamaSkipLogged.has(logKey)) {
        ollamaSkipLogged.add(logKey);
        logToFile(
          `[mcp-loader] runtime "${opts.runtime}" has supportsPluginMcpServers=false — skipping all plugins`
        );
      }
      return [];
    }
  }

  const pluginsDir = getAinativePluginsDir();

  // If the plugins directory doesn't exist yet, return empty.
  if (!fs.existsSync(pluginsDir)) {
    return [];
  }

  let pluginDirEntries: string[];
  try {
    pluginDirEntries = fs.readdirSync(pluginsDir);
  } catch {
    logToFile(`[mcp-loader] could not read plugins directory: ${pluginsDir}`);
    return [];
  }

  const allRegistrations: PluginMcpRegistration[] = [];

  for (const entry of pluginDirEntries) {
    const pluginDir = path.join(pluginsDir, entry);

    // Only process directories
    let stat: fs.Stats;
    try {
      stat = fs.statSync(pluginDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    const pluginId = entry;

    // Log per-plugin Ollama skip (if runtime filter would have blocked it)
    // Note: this branch is only reached when supportsPluginMcpServers=true,
    // so per-plugin Ollama skip logging happens via the summary above.

    try {
      const result = scanPlugin(pluginDir, pluginId);
      allRegistrations.push(...result.registrations);
    } catch (err) {
      // Per-plugin isolation: one broken plugin cannot crash the loader.
      logToFile(
        `[mcp-loader] plugin ${pluginId}: unexpected error during scan — ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return allRegistrations;
}

/**
 * Load plugin-shipped MCP servers for adapter consumption.
 *
 * Returns a Record<serverName, NormalizedMcpConfig> containing only accepted
 * registrations. Disabled / pending entries are omitted (but still logged).
 *
 * Short-circuits to {} when:
 *   - AINATIVE_SAFE_MODE=true (T13)
 *   - opts.runtime has supportsPluginMcpServers=false (e.g. Ollama)
 */
export async function loadPluginMcpServers(opts?: {
  runtime?: AgentRuntimeId;
}): Promise<Record<string, NormalizedMcpConfig>> {
  const regs = await listPluginMcpRegistrations(opts);
  return Object.fromEntries(
    regs
      .filter((r) => r.status === "accepted")
      .map((r) => [r.serverName, r.config])
  );
}
