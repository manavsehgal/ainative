/**
 * Chat tools for managing ainative plugin bundles loaded from
 * `~/.ainative/plugins/`.
 *
 * Tool inventory (as of M3 Phase D / T15):
 *   Kind-5 primitive bundles: list_plugins, reload_plugins, reload_plugin
 *     (list_plugins / reload_plugin now ALSO cover Kind-1 chat-tools plugins)
 *   Kind-1 capability controls: set_plugin_tool_approval (T10),
 *     set_plugin_accept_expiry (T11), revoke_plugin_capabilities (T12),
 *     grant_plugin_capabilities (T15)
 *
 * TDR-032 / CLAUDE.md NON-NEGOTIABLE: every handler MUST import
 * `@/lib/plugins/*` via dynamic `await import()` inside the function
 * body. A static import here would be transitively reachable from
 * `src/lib/agents/runtime/catalog.ts` (via the chat tool aggregator) and
 * would risk the module-load cycle that surfaces at runtime as
 * `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`.
 * Unit tests structurally cannot catch this — only the T18 smoke test will.
 * Any future handler added to this module MUST follow the same discipline.
 */

import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

export function pluginTools(_ctx: ToolContext) {
  return [
    defineTool(
      "list_plugins",
      "List all plugins currently installed in ~/.ainative/plugins/. Returns { kind5, kind1 }: kind5 is the list of primitive bundles from the plugin registry (each with id, status, and namespaced profile/blueprint/table/schedule ids). kind1 is the list of chat-tools plugins with transport (stdio | ainative-sdk | null), toolCount (number of accepted MCP servers the plugin contributes — not raw tool count), capabilities, capabilityAcceptStatus (accepted | pending | stale | expired — note: revoke removes the lockfile entry so 'revoked' is indistinguishable from 'pending' and is reported as pending for M3 v1), and per-server status details. Each kind1 entry also includes manifestHash — pass it back to grant_plugin_capabilities as expectedHash to guard against silent-swap attacks.",
      {},
      async () => {
        try {
          // Dynamic imports — see TDR-032 note at top of file.
          const [
            { listPlugins },
            { listPluginMcpRegistrations },
            { deriveManifestHash, isCapabilityAccepted },
            { getAinativePluginsDir },
          ] = await Promise.all([
            import("@/lib/plugins/registry"),
            import("@/lib/plugins/mcp-loader"),
            import("@/lib/plugins/capability-check"),
            import("@/lib/utils/ainative-paths"),
          ]);
          const fs = await import("node:fs");
          const path = await import("node:path");
          const yaml = await import("js-yaml");

          const kind5 = listPlugins();
          const registrations = await listPluginMcpRegistrations();

          // Group Kind-1 registrations by pluginId.
          const byPlugin = new Map<string, typeof registrations>();
          for (const reg of registrations) {
            const bucket = byPlugin.get(reg.pluginId) ?? [];
            bucket.push(reg);
            byPlugin.set(reg.pluginId, bucket);
          }

          const pluginsDir = getAinativePluginsDir();
          const kind1 = Array.from(byPlugin.entries()).map(
            ([pluginId, regs]) => {
              // Read manifest to extract capabilities + compute current hash.
              // Fall back gracefully on any parse failure — list is a view,
              // not a gate. Log-free: mcp-loader already logged malformed
              // manifests during its own scan.
              let capabilities: string[] = [];
              let manifestHash: string | undefined;
              let capabilityAcceptStatus:
                | "accepted"
                | "pending"
                | "stale"
                | "expired" = "pending";
              try {
                const pluginYamlPath = path.join(
                  pluginsDir,
                  pluginId,
                  "plugin.yaml",
                );
                if (fs.existsSync(pluginYamlPath)) {
                  const content = fs.readFileSync(pluginYamlPath, "utf-8");
                  const rawManifest = yaml.load(content);
                  if (
                    rawManifest !== null &&
                    typeof rawManifest === "object" &&
                    !Array.isArray(rawManifest)
                  ) {
                    const record = rawManifest as Record<string, unknown>;
                    if (Array.isArray(record.capabilities)) {
                      capabilities = record.capabilities.filter(
                        (c): c is string => typeof c === "string",
                      );
                    }
                  }
                  try {
                    manifestHash = deriveManifestHash(content);
                    const check = isCapabilityAccepted(
                      pluginId,
                      manifestHash,
                    );
                    if (check.accepted) {
                      capabilityAcceptStatus = "accepted";
                    } else if (check.reason === "hash_drift") {
                      capabilityAcceptStatus = "stale";
                    } else if (check.reason === "expired") {
                      capabilityAcceptStatus = "expired";
                    } else {
                      // "not_accepted" → pending (also the bucket for
                      // "revoked" since M3 v1 doesn't track a distinct
                      // revoked state — see tool description).
                      capabilityAcceptStatus = "pending";
                    }
                  } catch {
                    // Hash derivation may throw on scalar/null YAML. Fall back.
                    capabilityAcceptStatus = "pending";
                  }
                }
              } catch {
                // Any other I/O error — keep default fallback.
              }

              const accepted = regs.filter((r) => r.status === "accepted");
              const transport: "stdio" | "ainative-sdk" | null =
                accepted.length > 0 ? accepted[0].transport : null;

              return {
                pluginId,
                transport,
                // toolCount = number of accepted MCP servers for this plugin.
                // The exact tool count requires an MCP handshake against each
                // server (too heavy for a list call); this matches the spec's
                // "how many tool-emitting servers" intent.
                toolCount: accepted.length,
                capabilities,
                capabilityAcceptStatus,
                manifestHash,
                servers: regs.map((r) => ({
                  serverName: r.serverName,
                  transport: r.transport,
                  status: r.status,
                  ...(r.disabledReason !== undefined && {
                    disabledReason: r.disabledReason,
                  }),
                  ...(r.disabledDetail !== undefined && {
                    disabledDetail: r.disabledDetail,
                  }),
                })),
              };
            },
          );

          return ok({ kind5, kind1 });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list plugins");
        }
      }
    ),

    defineTool(
      "reload_plugins",
      "Rescan ~/.ainative/plugins/ and re-register all primitives. Use after adding, removing, or editing a plugin bundle on disk. Returns { loaded, disabled } summary.",
      {},
      async () => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { reloadPlugins } = await import("@/lib/plugins/registry");
          const plugins = await reloadPlugins();
          return ok({
            loaded: plugins
              .filter((p) => p.status === "loaded")
              .map((p) => ({
                id: p.id,
                profiles: p.profiles,
                blueprints: p.blueprints,
                tables: p.tables,
                schedules: p.schedules,
              })),
            disabled: plugins
              .filter((p) => p.status === "disabled")
              .map((p) => ({
                id: p.id,
                error: p.error,
              })),
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to reload plugins"
          );
        }
      }
    ),

    defineTool(
      "reload_plugin",
      "Reload a single plugin by id WITHOUT touching other plugins' cache entries. Transport-aware: calls both the Kind-5 registry reload (profiles/blueprints/tables/schedules) AND the Kind-1 MCP loader reload (busts require.cache for in-process SDK servers, re-scans fresh registrations). Use after editing one plugin so other plugins' in-flight tasks aren't disrupted. Returns { kind5, kind1 } — kind5 is the freshly-loaded LoadedPlugin or { id, status: 'removed' } if the Kind-5 bundle was deleted; kind1 is { bustedInProcessEntries, registrations } with fresh PluginMcpRegistration entries for this pluginId (empty if this plugin is Kind-5 only).",
      {
        id: z.string().describe("The plugin id to reload"),
      },
      async (args) => {
        try {
          // Dynamic imports — see TDR-032 note at top of file.
          const [{ reloadPlugin }, { reloadPluginMcpRegistrations }] =
            await Promise.all([
              import("@/lib/plugins/registry"),
              import("@/lib/plugins/mcp-loader"),
            ]);

          // Always call both — Kind-5 reloadPlugin returns null gracefully
          // when the plugin has no primitives-bundle manifest; Kind-1 reload
          // returns empty registrations when the plugin has no chat-tools
          // manifest. Calling both is idempotent for either kind.
          const [plugin, kind1] = await Promise.all([
            reloadPlugin(args.id),
            reloadPluginMcpRegistrations(args.id),
          ]);
          const kind5 = plugin ?? { id: args.id, status: "removed" };
          return ok({ kind5, kind1 });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to reload plugin"
          );
        }
      }
    ),

    defineTool(
      "set_plugin_tool_approval",
      "Set the per-tool approval mode for a plugin-shipped MCP tool. Modes: 'never' (auto-allow, trusted), 'prompt' (ask each time via MCP elicitation / notification), 'approve' (blocking permission modal). The plugin must already be capability-accepted. The tool name should be the full MCP-prefixed form, e.g. mcp__echo-server__echo.",
      {
        pluginId: z.string().describe("The plugin id"),
        toolName: z.string().describe("The full MCP-prefixed tool name, e.g. mcp__echo-server__echo"),
        mode: z.enum(["never", "prompt", "approve"]).describe("Approval mode"),
      },
      async (args) => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { setPluginToolApproval } = await import("@/lib/plugins/capability-check");
          setPluginToolApproval(args.pluginId, args.toolName, args.mode);
          return ok({
            pluginId: args.pluginId,
            toolName: args.toolName,
            mode: args.mode,
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to set tool approval"
          );
        }
      }
    ),

    defineTool(
      "set_plugin_accept_expiry",
      "Set an expiration date for a plugin's capability acceptance. After the expiry date, the plugin transitions to pending_capability_reaccept and must be re-granted. Supported day values: 30, 90, 180, 365. The plugin must already be capability-accepted. Default behavior (no expiry) is preserved — this tool is opt-in.",
      {
        pluginId: z.string().describe("The plugin id"),
        days: z
          .union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)])
          .describe("Days until the acceptance expires (30, 90, 180, or 365)"),
      },
      async (args) => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { setPluginAcceptExpiry } = await import("@/lib/plugins/capability-check");
          const expiresAt = setPluginAcceptExpiry(args.pluginId, args.days);
          return ok({
            pluginId: args.pluginId,
            days: args.days,
            expiresAt,
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to set accept expiry"
          );
        }
      }
    ),

    defineTool(
      "revoke_plugin_capabilities",
      "Revoke a plugin's capability acceptance. Removes the plugins.lock entry so the plugin is not loaded on future task runs. For in-process SDK plugins, busts Node's require.cache so stale modules are dropped. Creates an Inbox notification confirming the revoke with a re-accept hint. Returns { revoked: true, bustedEntries } on success, or { revoked: false, reason: 'no_entry' } if the plugin had no accepted capabilities (graceful no-op — users may double-click revoke).",
      {
        pluginId: z.string().describe("The plugin id to revoke"),
      },
      async (args) => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { revokePluginCapabilities } = await import("@/lib/plugins/capability-check");
          const result = await revokePluginCapabilities(args.pluginId);
          return ok(result);
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to revoke plugin capabilities"
          );
        }
      }
    ),

    defineTool(
      "grant_plugin_capabilities",
      "Grant capabilities to a Kind-1 plugin. Writes the plugins.lock entry pinning the current manifest hash, preserves any existing toolApprovals/expiresAt set on this plugin, and reloads the plugin's MCP registrations (busts require.cache for in-process SDK entries). Pass `expectedHash` (from a prior list_plugins call — each kind1 entry includes its manifestHash) to guard against silent-swap attacks — if the on-disk manifest hash has drifted since you reviewed it, the grant rejects with reason: 'hash_drift' and returns currentHash so the caller can re-review. Emits an Inbox notification confirming the grant. Returns { granted: true, hash, bustedInProcessEntries } on success, or { granted: false, reason: 'not_found' | 'hash_drift' | 'not_chat_tools', detail?, currentHash? } on failure.",
      {
        pluginId: z.string().describe("The plugin id to grant"),
        expectedHash: z
          .string()
          .optional()
          .describe(
            "Optional silent-swap guard: the manifestHash observed when reviewing this plugin. If on-disk hash has drifted, grant rejects.",
          ),
      },
      async (args) => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { grantPluginCapabilities } = await import(
            "@/lib/plugins/capability-check"
          );
          const result = await grantPluginCapabilities(args.pluginId, {
            ...(args.expectedHash !== undefined && {
              expectedHash: args.expectedHash,
            }),
          });
          return ok(result);
        } catch (e) {
          return err(
            e instanceof Error
              ? e.message
              : "Failed to grant plugin capabilities",
          );
        }
      },
    ),
  ];
}
