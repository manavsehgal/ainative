import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

export function usageTools(_ctx: ToolContext) {
  return [
    tool(
      "get_usage_summary",
      "Get aggregated usage statistics: daily spending, token totals, and provider/model breakdown.",
      {
        days: z
          .number()
          .min(1)
          .max(90)
          .optional()
          .describe("Number of days to look back (default 7)"),
      },
      async (args) => {
        try {
          const days = args.days ?? 7;
          const {
            getDailySpendTotals,
            getDailyTokenTotals,
            getProviderModelBreakdown,
          } = await import("@/lib/usage/ledger");

          const startedAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const [spend, tokens, breakdown] = await Promise.all([
            getDailySpendTotals(days),
            getDailyTokenTotals(days),
            getProviderModelBreakdown({ startedAt }),
          ]);

          return ok({ period: `${days} days`, spend, tokens, breakdown });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get usage summary");
        }
      }
    ),
  ];
}
