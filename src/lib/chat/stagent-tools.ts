import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────────────────

const VALID_TASK_STATUSES = [
  "planned",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

const VALID_PROJECT_STATUSES = ["active", "paused", "completed"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Create an in-process MCP server exposing Stagent CRUD tools.
 * The `projectId` closure auto-scopes operations to the active project.
 */
export function createStagentMcpServer(projectId?: string | null) {
  return createSdkMcpServer({
    name: "stagent",
    version: "1.0.0",
    tools: [
      // ── Projects ─────────────────────────────────────────────────────

      tool(
        "list_projects",
        "List all projects with task counts. Optionally filter by status.",
        {
          status: z
            .enum(VALID_PROJECT_STATUSES)
            .optional()
            .describe("Filter by project status"),
        },
        async (args) => {
          try {
            const conditions = [];
            if (args.status) conditions.push(eq(projects.status, args.status));

            const result = await db
              .select({
                id: projects.id,
                name: projects.name,
                description: projects.description,
                workingDirectory: projects.workingDirectory,
                status: projects.status,
                createdAt: projects.createdAt,
                taskCount: count(tasks.id),
              })
              .from(projects)
              .leftJoin(tasks, eq(tasks.projectId, projects.id))
              .where(conditions.length > 0 ? and(...conditions) : undefined)
              .groupBy(projects.id)
              .orderBy(projects.createdAt);

            return ok(result);
          } catch (e) {
            return err(e instanceof Error ? e.message : "Failed to list projects");
          }
        }
      ),

      tool(
        "create_project",
        "Create a new project in Stagent.",
        {
          name: z.string().min(1).max(100).describe("Project name"),
          description: z.string().max(500).optional().describe("Project description"),
          workingDirectory: z
            .string()
            .max(500)
            .optional()
            .describe("Absolute path to the project's working directory"),
        },
        async (args) => {
          try {
            const now = new Date();
            const id = crypto.randomUUID();

            await db.insert(projects).values({
              id,
              name: args.name,
              description: args.description ?? null,
              workingDirectory: args.workingDirectory ?? null,
              status: "active",
              createdAt: now,
              updatedAt: now,
            });

            const [project] = await db
              .select()
              .from(projects)
              .where(eq(projects.id, id));

            return ok(project);
          } catch (e) {
            return err(e instanceof Error ? e.message : "Failed to create project");
          }
        }
      ),

      // ── Tasks ────────────────────────────────────────────────────────

      tool(
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
            const effectiveProjectId = args.projectId ?? projectId ?? undefined;
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

      tool(
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
        },
        async (args) => {
          try {
            const effectiveProjectId = args.projectId ?? projectId ?? null;
            const now = new Date();
            const id = crypto.randomUUID();

            await db.insert(tasks).values({
              id,
              title: args.title,
              description: args.description ?? null,
              projectId: effectiveProjectId,
              priority: args.priority ?? 2,
              status: "planned",
              createdAt: now,
              updatedAt: now,
            });

            const [task] = await db
              .select()
              .from(tasks)
              .where(eq(tasks.id, id));

            return ok(task);
          } catch (e) {
            return err(e instanceof Error ? e.message : "Failed to create task");
          }
        }
      ),

      tool(
        "update_task",
        "Update an existing task's status, title, description, or priority.",
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
        },
        async (args) => {
          try {
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

            await db
              .update(tasks)
              .set(updates)
              .where(eq(tasks.id, args.taskId));

            const [task] = await db
              .select()
              .from(tasks)
              .where(eq(tasks.id, args.taskId));

            return ok(task);
          } catch (e) {
            return err(e instanceof Error ? e.message : "Failed to update task");
          }
        }
      ),

      tool(
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
            return ok(task);
          } catch (e) {
            return err(e instanceof Error ? e.message : "Failed to get task");
          }
        }
      ),
    ],
  });
}
