import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

export function settingsTools(_ctx: ToolContext) {
  return [
    tool(
      "get_settings",
      "Get current Stagent settings including auth method, budget limits, and active runtime. Read-only.",
      {
        key: z
          .string()
          .optional()
          .describe(
            'Specific setting key (e.g. "auth_method", "budget_max_tokens", "default_runtime"). Omit to get all settings.'
          ),
      },
      async (args) => {
        try {
          const { getSetting } = await import("@/lib/settings/helpers");

          if (args.key) {
            const value = await getSetting(args.key);
            return ok({ key: args.key, value });
          }

          // Return common settings
          const keys = [
            "auth_method",
            "default_runtime",
            "budget_max_tokens_per_task",
            "budget_max_cost_per_task",
            "budget_max_daily_cost",
          ];
          const entries: Record<string, string | null> = {};
          for (const key of keys) {
            entries[key] = await getSetting(key);
          }
          return ok(entries);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get settings");
        }
      }
    ),
  ];
}
