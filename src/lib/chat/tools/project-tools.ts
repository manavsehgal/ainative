import { defineTool } from "../tool-registry";
import { z } from "zod";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { ok, err, type ToolContext } from "./helpers";

const VALID_PROJECT_STATUSES = ["active", "paused", "completed"] as const;

export function projectTools(ctx: ToolContext) {
  return [
    defineTool(
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

    defineTool(
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

          ctx.onToolResult?.("create_project", project);
          return ok(project);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create project");
        }
      }
    ),

    defineTool(
      "delete_project",
      "Permanently delete a project and all its resources (tasks, tables, schedules, " +
        "documents, app instances). This is irreversible. Use to clean up orphaned or " +
        "unwanted projects. Always confirm with the user before calling.",
      {
        projectId: z
          .string()
          .describe("The ID of the project to delete"),
      },
      async (args) => {
        try {
          const { deleteProjectCascade } = await import(
            "@/lib/data/delete-project"
          );

          const deleted = deleteProjectCascade(args.projectId);
          if (!deleted) {
            return err(`Project "${args.projectId}" not found`);
          }

          return ok({
            projectId: args.projectId,
            message: `Project "${args.projectId}" and all its resources have been deleted.`,
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to delete project",
          );
        }
      }
    ),
  ];
}
