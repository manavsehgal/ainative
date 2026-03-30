import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

export function settingsTools(_ctx: ToolContext) {
  return [
    defineTool(
      "get_settings",
      "Get current Stagent settings including auth method, budget limits, active runtime, and workspace context. Read-only.",
      {
        key: z
          .string()
          .optional()
          .describe(
            'Specific setting key (e.g. "auth_method", "budget_max_tokens", "default_runtime", "workspace_cwd", "workspace_is_worktree"). Omit to get all settings.'
          ),
      },
      async (args) => {
        try {
          const { getSetting } = await import("@/lib/settings/helpers");
          const { getWorkspaceContext } = await import(
            "@/lib/environment/workspace-context"
          );

          // Handle workspace_* keys from workspace context
          if (args.key?.startsWith("workspace_")) {
            const ws = getWorkspaceContext();
            const wsEntries: Record<string, string | null> = {
              workspace_cwd: ws.cwd,
              workspace_git_branch: ws.gitBranch,
              workspace_is_worktree: ws.isWorktree ? "true" : "false",
              workspace_folder_name: ws.folderName,
            };
            return ok({
              key: args.key,
              value: wsEntries[args.key] ?? null,
            });
          }

          if (args.key) {
            const value = await getSetting(args.key);
            return ok({ key: args.key, value });
          }

          // Return common settings + workspace context
          const keys = [
            "auth_method",
            "default_runtime",
            "runtime.sdkTimeoutSeconds",
            "budget_max_tokens_per_task",
            "budget_max_cost_per_task",
            "budget_max_daily_cost",
          ];
          const entries: Record<string, string | null> = {};
          for (const key of keys) {
            entries[key] = await getSetting(key);
          }

          // Append workspace context
          const ws = getWorkspaceContext();
          entries.workspace_cwd = ws.cwd;
          entries.workspace_git_branch = ws.gitBranch;
          entries.workspace_is_worktree = ws.isWorktree ? "true" : "false";
          entries.workspace_folder_name = ws.folderName;

          return ok(entries);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get settings");
        }
      }
    ),
  ];
}
