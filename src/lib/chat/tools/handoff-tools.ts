import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";
import { sendHandoff } from "@/lib/agents/handoff/bus";

export function handoffTools(_ctx: ToolContext) {
  return [
    defineTool(
      "send_handoff",
      "Hand off a task from one agent profile to another. Creates an async handoff request that the target agent will pick up. Use this when a task requires expertise from a different agent profile.",
      {
        toProfile: z
          .string()
          .describe("Target agent profile ID (e.g. code-reviewer, researcher, document-writer)"),
        subject: z
          .string()
          .min(1)
          .max(200)
          .describe("Brief subject line for the handoff"),
        body: z
          .string()
          .min(1)
          .max(4000)
          .describe("Detailed description of what the target agent should do"),
        fromProfile: z
          .string()
          .optional()
          .describe("Source agent profile ID. Defaults to 'general'."),
        sourceTaskId: z
          .string()
          .optional()
          .describe("Source task ID that initiated this handoff"),
        priority: z
          .number()
          .min(0)
          .max(3)
          .optional()
          .describe("Priority: 0 = critical, 1 = high, 2 = medium (default), 3 = low"),
        requiresApproval: z
          .boolean()
          .optional()
          .describe("Whether human approval is required before the handoff is processed. Defaults to false."),
      },
      async (args) => {
        try {
          const messageId = await sendHandoff({
            fromProfileId: args.fromProfile ?? "general",
            toProfileId: args.toProfile,
            sourceTaskId: args.sourceTaskId ?? "",
            subject: args.subject,
            body: args.body,
            priority: args.priority,
            requiresApproval: args.requiresApproval,
          });

          return ok({
            message: "Handoff created successfully",
            messageId,
            from: args.fromProfile ?? "general",
            to: args.toProfile,
            subject: args.subject,
            requiresApproval: args.requiresApproval ?? false,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create handoff");
        }
      }
    ),
  ];
}
