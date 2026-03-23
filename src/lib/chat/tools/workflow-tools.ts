import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { workflows, tasks, agentLogs, notifications, documents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ok, err, type ToolContext } from "./helpers";

const VALID_WORKFLOW_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "failed",
] as const;

export function workflowTools(ctx: ToolContext) {
  return [
    tool(
      "list_workflows",
      "List all workflows, optionally filtered by project or status.",
      {
        projectId: z
          .string()
          .optional()
          .describe("Filter by project ID. Omit to use the active project."),
        status: z
          .enum(VALID_WORKFLOW_STATUSES)
          .optional()
          .describe("Filter by workflow status"),
      },
      async (args) => {
        try {
          const effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined;
          const conditions = [];
          if (effectiveProjectId)
            conditions.push(eq(workflows.projectId, effectiveProjectId));
          if (args.status) conditions.push(eq(workflows.status, args.status));

          const result = await db
            .select()
            .from(workflows)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(workflows.updatedAt))
            .limit(50);

          // Return without the raw definition JSON (too large for chat)
          return ok(
            result.map((w) => ({
              id: w.id,
              name: w.name,
              projectId: w.projectId,
              status: w.status,
              createdAt: w.createdAt,
              updatedAt: w.updatedAt,
            }))
          );
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list workflows");
        }
      }
    ),

    tool(
      "create_workflow",
      "Create a new workflow with a definition. The definition must include a pattern (sequence, parallel, checkpoint, planner-executor, swarm, loop) and steps array.",
      {
        name: z.string().min(1).max(200).describe("Workflow name"),
        projectId: z
          .string()
          .optional()
          .describe("Project ID. Omit to use the active project."),
        definition: z
          .string()
          .describe(
            'Workflow definition as JSON string. Must include "pattern" and "steps" array. Example: {"pattern":"sequence","steps":[{"name":"step1","prompt":"Do X","assignedAgent":"claude"}]}'
          ),
      },
      async (args) => {
        try {
          // Validate definition JSON
          let parsedDef;
          try {
            parsedDef = JSON.parse(args.definition);
          } catch {
            return err("Invalid JSON in definition");
          }

          if (!parsedDef.pattern || !Array.isArray(parsedDef.steps)) {
            return err('Definition must include "pattern" and "steps" array');
          }

          const effectiveProjectId = args.projectId ?? ctx.projectId ?? null;
          const now = new Date();
          const id = crypto.randomUUID();

          await db.insert(workflows).values({
            id,
            name: args.name,
            projectId: effectiveProjectId,
            definition: args.definition,
            status: "draft",
            createdAt: now,
            updatedAt: now,
          });

          const [workflow] = await db
            .select()
            .from(workflows)
            .where(eq(workflows.id, id));

          ctx.onToolResult?.("create_workflow", workflow);
          return ok({
            id: workflow.id,
            name: workflow.name,
            projectId: workflow.projectId,
            status: workflow.status,
            createdAt: workflow.createdAt,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create workflow");
        }
      }
    ),

    tool(
      "get_workflow",
      "Get full workflow details including definition and step information.",
      {
        workflowId: z.string().describe("The workflow ID to look up"),
      },
      async (args) => {
        try {
          const workflow = await db
            .select()
            .from(workflows)
            .where(eq(workflows.id, args.workflowId))
            .get();

          if (!workflow) return err(`Workflow not found: ${args.workflowId}`);

          const { parseWorkflowState } = await import("@/lib/workflows/engine");
          const { definition, state } = parseWorkflowState(workflow.definition);

          ctx.onToolResult?.("get_workflow", workflow);
          return ok({
            id: workflow.id,
            name: workflow.name,
            projectId: workflow.projectId,
            status: workflow.status,
            pattern: definition.pattern,
            steps: definition.steps.map((s: { name: string; prompt?: string; assignedAgent?: string; requiresApproval?: boolean }) => ({
              name: s.name,
              prompt: s.prompt,
              assignedAgent: s.assignedAgent,
              requiresApproval: s.requiresApproval,
            })),
            executionState: state
              ? {
                  stepStates: state.stepStates.map((ss: { stepId: string; status: string; output?: string }) => ({
                    stepId: ss.stepId,
                    status: ss.status,
                    outputPreview: ss.output?.slice(0, 200),
                  })),
                }
              : null,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get workflow");
        }
      }
    ),

    tool(
      "update_workflow",
      "Update a draft workflow's name or definition. Only draft workflows can be edited.",
      {
        workflowId: z.string().describe("The workflow ID to update"),
        name: z.string().min(1).max(200).optional().describe("New name"),
        definition: z
          .string()
          .optional()
          .describe("New definition as JSON string"),
      },
      async (args) => {
        try {
          const existing = await db
            .select()
            .from(workflows)
            .where(eq(workflows.id, args.workflowId))
            .get();

          if (!existing) return err(`Workflow not found: ${args.workflowId}`);
          if (existing.status !== "draft")
            return err(`Cannot edit a workflow in '${existing.status}' status. Only draft workflows can be edited.`);

          if (args.definition) {
            try {
              const parsed = JSON.parse(args.definition);
              if (!parsed.pattern || !Array.isArray(parsed.steps))
                return err('Definition must include "pattern" and "steps" array');
            } catch {
              return err("Invalid JSON in definition");
            }
          }

          const updates: Record<string, unknown> = { updatedAt: new Date() };
          if (args.name !== undefined) updates.name = args.name;
          if (args.definition !== undefined) updates.definition = args.definition;

          await db
            .update(workflows)
            .set(updates)
            .where(eq(workflows.id, args.workflowId));

          const [workflow] = await db
            .select()
            .from(workflows)
            .where(eq(workflows.id, args.workflowId));

          ctx.onToolResult?.("update_workflow", workflow);
          return ok({
            id: workflow.id,
            name: workflow.name,
            status: workflow.status,
            updatedAt: workflow.updatedAt,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to update workflow");
        }
      }
    ),

    tool(
      "delete_workflow",
      "Delete a workflow and its child tasks, logs, and notifications. Cannot delete an active workflow. Requires approval.",
      {
        workflowId: z.string().describe("The workflow ID to delete"),
      },
      async (args) => {
        try {
          const existing = await db
            .select()
            .from(workflows)
            .where(eq(workflows.id, args.workflowId))
            .get();

          if (!existing) return err(`Workflow not found: ${args.workflowId}`);
          if (existing.status === "active")
            return err("Cannot delete an active workflow. Pause or stop it first.");

          // Cascade delete: notifications → logs → documents → tasks → workflow
          const childTasks = await db
            .select({ id: tasks.id })
            .from(tasks)
            .where(eq(tasks.workflowId, args.workflowId));

          const taskIds = childTasks.map((t) => t.id);
          for (const taskId of taskIds) {
            await db.delete(notifications).where(eq(notifications.taskId, taskId));
            await db.delete(agentLogs).where(eq(agentLogs.taskId, taskId));
            await db.delete(documents).where(eq(documents.taskId, taskId));
          }
          await db.delete(tasks).where(eq(tasks.workflowId, args.workflowId));
          await db.delete(workflows).where(eq(workflows.id, args.workflowId));

          return ok({ message: "Workflow deleted", workflowId: args.workflowId, name: existing.name });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to delete workflow");
        }
      }
    ),

    tool(
      "execute_workflow",
      "Start executing a workflow. Returns immediately — execution runs in the background. Requires approval.",
      {
        workflowId: z.string().describe("The workflow ID to execute"),
      },
      async (args) => {
        try {
          const workflow = await db
            .select()
            .from(workflows)
            .where(eq(workflows.id, args.workflowId))
            .get();

          if (!workflow) return err(`Workflow not found: ${args.workflowId}`);
          if (workflow.status === "active")
            return err("Workflow is already running");
          if (workflow.status !== "draft" && workflow.status !== "paused" && workflow.status !== "failed")
            return err(`Cannot execute a workflow in '${workflow.status}' status`);

          // Atomic claim: set to active
          await db
            .update(workflows)
            .set({ status: "active", updatedAt: new Date() })
            .where(eq(workflows.id, args.workflowId));

          // Fire-and-forget
          const { executeWorkflow } = await import("@/lib/workflows/engine");
          executeWorkflow(args.workflowId).catch(() => {});

          ctx.onToolResult?.("execute_workflow", { id: args.workflowId, name: workflow.name });
          return ok({ message: "Workflow execution started", workflowId: args.workflowId, name: workflow.name });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to execute workflow");
        }
      }
    ),

    tool(
      "get_workflow_status",
      "Get the current execution status of a workflow, including step-by-step progress.",
      {
        workflowId: z.string().describe("The workflow ID to check"),
      },
      async (args) => {
        try {
          const workflow = await db
            .select()
            .from(workflows)
            .where(eq(workflows.id, args.workflowId))
            .get();

          if (!workflow) return err(`Workflow not found: ${args.workflowId}`);

          const { parseWorkflowState } = await import("@/lib/workflows/engine");
          const { definition, state } = parseWorkflowState(workflow.definition);

          ctx.onToolResult?.("get_workflow_status", workflow);
          return ok({
            workflowId: workflow.id,
            name: workflow.name,
            status: workflow.status,
            pattern: definition.pattern,
            stepCount: definition.steps.length,
            steps: state
              ? state.stepStates.map((ss: { stepId: string; status: string; output?: string; error?: string }) => ({
                  stepId: ss.stepId,
                  status: ss.status,
                  outputPreview: ss.output?.slice(0, 300),
                  error: ss.error,
                }))
              : definition.steps.map((s: { name: string }) => ({
                  stepId: s.name,
                  status: "pending",
                })),
            updatedAt: workflow.updatedAt,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get workflow status");
        }
      }
    ),
  ];
}
