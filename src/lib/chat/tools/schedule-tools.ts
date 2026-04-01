import { defineTool } from "../tool-registry";
import { z } from "zod";
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ok, err, type ToolContext } from "./helpers";

const VALID_SCHEDULE_STATUSES = [
  "active",
  "paused",
  "completed",
  "expired",
] as const;

export function scheduleTools(ctx: ToolContext) {
  return [
    defineTool(
      "list_schedules",
      "List all scheduled prompt loops, optionally filtered by status.",
      {
        status: z
          .enum(VALID_SCHEDULE_STATUSES)
          .optional()
          .describe("Filter by schedule status"),
      },
      async (args) => {
        try {
          const conditions = [];
          if (args.status) conditions.push(eq(schedules.status, args.status));

          const result = await db
            .select()
            .from(schedules)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(schedules.updatedAt))
            .limit(50);

          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list schedules");
        }
      }
    ),

    defineTool(
      "create_schedule",
      'Create a new scheduled recurring task. Accepts human-friendly intervals like "every 30 minutes", "hourly", "daily at 9am".',
      {
        name: z.string().min(1).max(200).describe("Schedule name"),
        prompt: z.string().min(1).max(2000).describe("The prompt to execute on each firing"),
        interval: z
          .string()
          .min(1)
          .describe(
            'Human-friendly interval (e.g. "every 30 minutes", "hourly", "every 2 hours", "daily")'
          ),
        projectId: z
          .string()
          .optional()
          .describe("Project ID. Omit to use the active project."),
        assignedAgent: z.string().optional().describe("Runtime ID (e.g. 'claude')"),
        agentProfile: z.string().optional().describe("Agent profile ID to use"),
        maxFirings: z
          .number()
          .optional()
          .describe("Maximum number of times to fire. Omit for unlimited."),
        expiresInHours: z
          .number()
          .optional()
          .describe("Auto-expire after this many hours"),
      },
      async (args) => {
        try {
          const { parseInterval, computeNextFireTime } = await import(
            "@/lib/schedules/interval-parser"
          );
          const { parseNaturalLanguage } = await import(
            "@/lib/schedules/nlp-parser"
          );

          let cronExpression: string;
          // Try NLP first for natural language expressions,
          // then fall back to parseInterval for shorthand (5m, 2h) and raw cron
          const nlResult = parseNaturalLanguage(args.interval);
          if (nlResult) {
            cronExpression = nlResult.cronExpression;
          } else {
            try {
              cronExpression = parseInterval(args.interval);
            } catch (e) {
              return err(
                `Invalid interval "${args.interval}": ${e instanceof Error ? e.message : "parse error"}`
              );
            }
          }

          const effectiveProjectId = args.projectId ?? ctx.projectId ?? null;
          const now = new Date();
          const id = crypto.randomUUID();
          const nextFireAt = computeNextFireTime(cronExpression, now);
          const expiresAt = args.expiresInHours
            ? new Date(now.getTime() + args.expiresInHours * 60 * 60 * 1000)
            : null;

          await db.insert(schedules).values({
            id,
            name: args.name,
            prompt: args.prompt,
            cronExpression,
            projectId: effectiveProjectId,
            assignedAgent: args.assignedAgent ?? null,
            agentProfile: args.agentProfile ?? null,
            recurs: true,
            status: "active",
            maxFirings: args.maxFirings ?? null,
            firingCount: 0,
            expiresAt,
            nextFireAt,
            createdAt: now,
            updatedAt: now,
          });

          const [schedule] = await db
            .select()
            .from(schedules)
            .where(eq(schedules.id, id));

          ctx.onToolResult?.("create_schedule", schedule);
          return ok(schedule);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create schedule");
        }
      }
    ),

    defineTool(
      "get_schedule",
      "Get full details for a specific schedule.",
      {
        scheduleId: z.string().describe("The schedule ID to look up"),
      },
      async (args) => {
        try {
          const schedule = await db
            .select()
            .from(schedules)
            .where(eq(schedules.id, args.scheduleId))
            .get();

          if (!schedule) return err(`Schedule not found: ${args.scheduleId}`);
          ctx.onToolResult?.("get_schedule", schedule);
          return ok(schedule);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get schedule");
        }
      }
    ),

    defineTool(
      "update_schedule",
      "Update a schedule's fields or pause/resume it.",
      {
        scheduleId: z.string().describe("The schedule ID to update"),
        name: z.string().min(1).max(200).optional().describe("New name"),
        prompt: z.string().max(2000).optional().describe("New prompt"),
        interval: z
          .string()
          .optional()
          .describe("New interval (human-friendly)"),
        status: z
          .enum(VALID_SCHEDULE_STATUSES)
          .optional()
          .describe("New status (use 'paused' to pause, 'active' to resume)"),
        assignedAgent: z.string().optional().describe("New runtime ID"),
        agentProfile: z.string().optional().describe("New agent profile"),
      },
      async (args) => {
        try {
          const existing = await db
            .select()
            .from(schedules)
            .where(eq(schedules.id, args.scheduleId))
            .get();

          if (!existing) return err(`Schedule not found: ${args.scheduleId}`);

          const updates: Record<string, unknown> = { updatedAt: new Date() };
          if (args.name !== undefined) updates.name = args.name;
          if (args.prompt !== undefined) updates.prompt = args.prompt;
          if (args.status !== undefined) updates.status = args.status;
          if (args.assignedAgent !== undefined) updates.assignedAgent = args.assignedAgent;
          if (args.agentProfile !== undefined) updates.agentProfile = args.agentProfile;

          if (args.interval) {
            const { parseInterval, computeNextFireTime } = await import(
              "@/lib/schedules/interval-parser"
            );
            const { parseNaturalLanguage } = await import(
              "@/lib/schedules/nlp-parser"
            );
            try {
              const nlResult = parseNaturalLanguage(args.interval);
              const cron = nlResult
                ? nlResult.cronExpression
                : parseInterval(args.interval);
              updates.cronExpression = cron;
              updates.nextFireAt = computeNextFireTime(cron);
            } catch (e) {
              return err(
                `Invalid interval: ${e instanceof Error ? e.message : "parse error"}`
              );
            }
          }

          // Recompute next fire time on resume
          if (args.status === "active" && existing.status === "paused") {
            const { computeNextFireTime } = await import(
              "@/lib/schedules/interval-parser"
            );
            const cron = (updates.cronExpression as string) ?? existing.cronExpression;
            updates.nextFireAt = computeNextFireTime(cron);
          }

          await db
            .update(schedules)
            .set(updates)
            .where(eq(schedules.id, args.scheduleId));

          const [schedule] = await db
            .select()
            .from(schedules)
            .where(eq(schedules.id, args.scheduleId));

          ctx.onToolResult?.("update_schedule", schedule);
          return ok(schedule);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to update schedule");
        }
      }
    ),

    defineTool(
      "delete_schedule",
      "Delete a schedule permanently. Requires approval.",
      {
        scheduleId: z.string().describe("The schedule ID to delete"),
      },
      async (args) => {
        try {
          const existing = await db
            .select()
            .from(schedules)
            .where(eq(schedules.id, args.scheduleId))
            .get();

          if (!existing) return err(`Schedule not found: ${args.scheduleId}`);

          await db.delete(schedules).where(eq(schedules.id, args.scheduleId));
          return ok({ message: "Schedule deleted", scheduleId: args.scheduleId, name: existing.name });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to delete schedule");
        }
      }
    ),
  ];
}
