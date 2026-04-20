/**
 * Chat tools for managing Kind-5 plugin bundles loaded from
 * `~/.ainative/plugins/`.
 *
 * TDR-032 / CLAUDE.md NON-NEGOTIABLE: every handler MUST import
 * `@/lib/plugins/registry` via dynamic `await import()` inside the
 * function body. A static import here would be transitively reachable
 * from `src/lib/agents/runtime/catalog.ts` (via the chat tool aggregator)
 * and would risk the module-load cycle that surfaces at runtime as
 * `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`.
 * Unit tests cannot catch this — only the T18 smoke test will.
 */

import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

export function pluginTools(_ctx: ToolContext) {
  return [
    defineTool(
      "list_plugins",
      "List Kind-5 primitive bundles currently loaded from ~/.ainative/plugins/. Each entry includes id, status (loaded/disabled), and the namespaced primitive ids it contributes (profiles, blueprints, tables).",
      {},
      async () => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { listPlugins } = await import("@/lib/plugins/registry");
          return ok(listPlugins());
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
      "Reload a single plugin bundle by id WITHOUT touching other plugins' cache entries. Use this after editing one plugin so other plugins' in-flight tasks aren't disrupted. Returns the freshly-loaded plugin, or { id, status: 'removed' } if the plugin directory was deleted.",
      {
        id: z.string().describe("The plugin id to reload"),
      },
      async (args) => {
        try {
          // Dynamic import — see TDR-032 note at top of file.
          const { reloadPlugin } = await import("@/lib/plugins/registry");
          const plugin = await reloadPlugin(args.id);
          if (!plugin) return ok({ id: args.id, status: "removed" });
          return ok(plugin);
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
  ];
}
