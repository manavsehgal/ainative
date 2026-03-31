import { defineTool } from "../tool-registry";
import { z } from "zod";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ok, err, type ToolContext } from "./helpers";
import {
  DEFAULT_AGENT_RUNTIME,
  isAgentRuntimeId,
  SUPPORTED_AGENT_RUNTIMES,
} from "@/lib/agents/runtime/catalog";

const VALID_TASK_STATUSES = [
  "planned",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export function taskTools(ctx: ToolContext) {
  return [
    defineTool(
      "list_tasks",
      "List tasks, optionally filtered by project or status. If a project is active in this conversation, tasks are scoped to it by default.",
      {
        projectId: z
          .string()
          .optional()
          .describe(
            "Filter by project ID. Omit to use the active project (if any)."
          ),
        status: z
          .enum(VALID_TASK_STATUSES)
          .optional()
          .describe("Filter by task status"),
      },
      async (args) => {
        try {
          const effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined;
          const conditions = [];
          if (effectiveProjectId)
            conditions.push(eq(tasks.projectId, effectiveProjectId));
          if (args.status) conditions.push(eq(tasks.status, args.status));

          const result = await db
            .select()
            .from(tasks)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(tasks.priority, desc(tasks.createdAt))
            .limit(50);

          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list tasks");
        }
      }
    ),

    defineTool(
      "create_task",
      "Create a new task record in Stagent. Use this when the user asks to create, add, or plan a task.",
      {
        title: z.string().min(1).max(200).describe("Task title"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("Task description with details about what needs to be done"),
        projectId: z
          .string()
          .optional()
          .describe(
            "Project ID to assign the task to. Omit to use the active project."
          ),
        priority: z
          .number()
          .min(0)
          .max(3)
          .optional()
          .describe(
            "Priority: 0 = critical, 1 = high, 2 = medium (default), 3 = low"
          ),
        assignedAgent: z
          .string()
          .optional()
          .describe(
            `Runtime ID: ${SUPPORTED_AGENT_RUNTIMES.join(", ")}`
          ),
        agentProfile: z
          .string()
          .optional()
          .describe(
            "Agent profile ID (e.g. general, code-reviewer, researcher, reddit-researcher)"
          ),
      },
      async (args) => {
        try {
          if (args.assignedAgent && !isAgentRuntimeId(args.assignedAgent)) {
            return err(
              `Invalid runtime "${args.assignedAgent}". Valid: ${SUPPORTED_AGENT_RUNTIMES.join(", ")}`
            );
          }

          const effectiveProjectId = args.projectId ?? ctx.projectId ?? null;
          const now = new Date();
          const id = crypto.randomUUID();

          await db.insert(tasks).values({
            id,
            title: args.title,
            description: args.description ?? null,
            projectId: effectiveProjectId,
            priority: args.priority ?? 2,
            status: "planned",
            assignedAgent: args.assignedAgent ?? null,
            agentProfile: args.agentProfile ?? null,
            createdAt: now,
            updatedAt: now,
          });

          const [task] = await db
            .select()
            .from(tasks)
            .where(eq(tasks.id, id));

          ctx.onToolResult?.("create_task", task);
          return ok(task);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create task");
        }
      }
    ),

    defineTool(
      "update_task",
      "Update an existing task's status, title, description, priority, runtime, or profile.",
      {
        taskId: z.string().describe("The task ID to update"),
        title: z.string().min(1).max(200).optional().describe("New title"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("New description"),
        status: z
          .enum(VALID_TASK_STATUSES)
          .optional()
          .describe("New status"),
        priority: z
          .number()
          .min(0)
          .max(3)
          .optional()
          .describe("New priority (0-3)"),
        assignedAgent: z
          .string()
          .optional()
          .describe(
            `Runtime ID: ${SUPPORTED_AGENT_RUNTIMES.join(", ")}`
          ),
        agentProfile: z
          .string()
          .optional()
          .describe(
            "Agent profile ID (e.g. general, code-reviewer, researcher, reddit-researcher)"
          ),
      },
      async (args) => {
        try {
          if (args.assignedAgent && !isAgentRuntimeId(args.assignedAgent)) {
            return err(
              `Invalid runtime "${args.assignedAgent}". Valid: ${SUPPORTED_AGENT_RUNTIMES.join(", ")}`
            );
          }

          const existing = await db
            .select()
            .from(tasks)
            .where(eq(tasks.id, args.taskId))
            .get();

          if (!existing) return err(`Task not found: ${args.taskId}`);

          const updates: Record<string, unknown> = { updatedAt: new Date() };
          if (args.title !== undefined) updates.title = args.title;
          if (args.description !== undefined)
            updates.description = args.description;
          if (args.status !== undefined) updates.status = args.status;
          if (args.priority !== undefined) updates.priority = args.priority;
          if (args.assignedAgent !== undefined)
            updates.assignedAgent = args.assignedAgent;
          if (args.agentProfile !== undefined)
            updates.agentProfile = args.agentProfile;

          await db
            .update(tasks)
            .set(updates)
            .where(eq(tasks.id, args.taskId));

          const [task] = await db
            .select()
            .from(tasks)
            .where(eq(tasks.id, args.taskId));

          ctx.onToolResult?.("update_task", task);
          return ok(task);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to update task");
        }
      }
    ),

    defineTool(
      "get_task",
      "Get full details for a specific task by ID.",
      {
        taskId: z.string().describe("The task ID to look up"),
      },
      async (args) => {
        try {
          const task = await db
            .select()
            .from(tasks)
            .where(eq(tasks.id, args.taskId))
            .get();

          if (!task) return err(`Task not found: ${args.taskId}`);
          ctx.onToolResult?.("get_task", task);
          return ok(task);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get task");
        }
      }
    ),

    defineTool(
      "execute_task",
      `Queue and execute a task with an AI agent. Returns immediately — execution runs in the background. Requires approval. Valid runtime IDs: ${SUPPORTED_AGENT_RUNTIMES.join(", ")}.`,
      {
        taskId: z.string().describe("The task ID to execute"),
        assignedAgent: z
          .string()
          .optional()
          .describe(
            `Runtime ID: ${SUPPORTED_AGENT_RUNTIMES.join(", ")}. Defaults to task's assigned agent or ${DEFAULT_AGENT_RUNTIME}.`
          ),
      },
      async (args) => {
        try {
          if (args.assignedAgent && !isAgentRuntimeId(args.assignedAgent)) {
            return err(
              `Invalid runtime "${args.assignedAgent}". Valid: ${SUPPORTED_AGENT_RUNTIMES.join(", ")}`
            );
          }

          const task = await db
            .select()
            .from(tasks)
            .where(eq(tasks.id, args.taskId))
            .get();

          if (!task) return err(`Task not found: ${args.taskId}`);
          if (task.status === "running") return err("Task is already running");

          const runtimeId = args.assignedAgent ?? task.assignedAgent ?? DEFAULT_AGENT_RUNTIME;

          // Set status to queued
          await db
            .update(tasks)
            .set({ status: "queued", assignedAgent: runtimeId, updatedAt: new Date() })
            .where(eq(tasks.id, args.taskId));

          // Fire-and-forget execution
          const { executeTaskWithAgent } = await import("@/lib/agents/router");
          executeTaskWithAgent(args.taskId, runtimeId).catch(() => {});

          ctx.onToolResult?.("execute_task", { id: args.taskId, title: task.title });
          return ok({ message: "Execution started", taskId: args.taskId, runtime: runtimeId });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to execute task");
        }
      }
    ),

    defineTool(
      "cancel_task",
      "Cancel a running task. Requires approval.",
      {
        taskId: z.string().describe("The task ID to cancel"),
      },
      async (args) => {
        try {
          const task = await db
            .select()
            .from(tasks)
            .where(eq(tasks.id, args.taskId))
            .get();

          if (!task) return err(`Task not found: ${args.taskId}`);
          if (task.status !== "running") return err(`Task is not running (status: ${task.status})`);

          const { getExecution } = await import("@/lib/agents/execution-manager");
          const execution = getExecution(args.taskId);
          if (execution?.abortController) {
            execution.abortController.abort();
          }

          await db
            .update(tasks)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(tasks.id, args.taskId));

          return ok({ message: "Task cancelled", taskId: args.taskId });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to cancel task");
        }
      }
    ),
  ];
}
