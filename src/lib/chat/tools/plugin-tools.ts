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
  ];
}
