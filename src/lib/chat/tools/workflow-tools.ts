import { defineTool } from "../tool-registry";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  workflows,
  tasks,
  agentLogs,
  notifications,
  documents,
  workflowDocumentInputs,
} from "@/lib/db/schema";
import { eq, and, desc, inArray, like } from "drizzle-orm";
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
    defineTool(
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

    defineTool(
      "create_workflow",
      "Create a new workflow with a definition. The definition must include a pattern (sequence, parallel, checkpoint, planner-executor, swarm, loop) and steps array. Sequence-pattern steps can be either task steps (with prompt + assignedAgent/agentProfile) or delay steps (with delayDuration like '3d', '2h', '30m', '1w') that pause the workflow between tasks — use delay steps for time-distributed sequences (outreach cadences, drip campaigns, cooling periods) rather than creating separate workflows or schedules. IMPORTANT: for the 'run agent on every row of a table' pattern, prefer enrich_table over create_workflow — enrich_table generates the optimal loop configuration, binds each row as {{row.field}} context, wires up the postAction row writeback, and handles idempotent skip of already-populated rows. Hand-rolled equivalents miss these safeguards.",
      {
        name: z.string().min(1).max(200).describe("Workflow name"),
        projectId: z
          .string()
          .optional()
          .describe("Project ID. Omit to use the active project."),
        definition: z
          .string()
          .describe(
            'Workflow definition as JSON string. Must include "pattern" and "steps" array. ' +
            'Task step example: {"id":"s1","name":"Research","prompt":"Do X","assignedAgent":"claude"}. ' +
            'Delay step example (sequence pattern only): {"id":"s2","name":"Wait 3 days","delayDuration":"3d"}. ' +
            'A complete drip sequence: {"pattern":"sequence","steps":[{"id":"s1","name":"Initial","prompt":"Send first email","assignedAgent":"claude"},{"id":"s2","name":"Wait","delayDuration":"3d"},{"id":"s3","name":"Follow-up","prompt":"Send follow-up","assignedAgent":"claude"}]}. ' +
            'Delay bounds: 1m to 30d. Delay steps must NOT have prompt/profile fields.'
          ),
        documentIds: z
          .array(z.string())
          .optional()
          .describe(
            "Optional array of document IDs from the project pool to attach as input context. These documents will be injected into all workflow steps at execution time."
          ),
        runtime: z
          .string()
          .optional()
          .describe(
            "Runtime to use for workflow execution (e.g., 'openai-direct', 'anthropic-direct'). Use list_runtimes to see available options. Omit to use the system default."
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

          // Auto-assign IDs to steps that don't have them (chat LLMs often omit IDs)
          for (const step of parsedDef.steps) {
            if (!step.id) {
              step.id = crypto.randomUUID();
            }
          }
          args.definition = JSON.stringify(parsedDef);

          // Validate runtime if provided
          let runtimeId: string | null = null;
          if (args.runtime) {
            const { isAgentRuntimeId } = await import("@/lib/agents/runtime/catalog");
            if (!isAgentRuntimeId(args.runtime)) {
              return err(`Invalid runtime "${args.runtime}". Use list_runtimes to see available options.`);
            }
            runtimeId = args.runtime;
          }

          const effectiveProjectId = args.projectId ?? ctx.projectId ?? null;
          const now = new Date();
          const id = crypto.randomUUID();

          await db.insert(workflows).values({
            id,
            name: args.name,
            projectId: effectiveProjectId,
            definition: args.definition,
            runtimeId,
            status: "draft",
            createdAt: now,
            updatedAt: now,
          });

          // Attach global pool documents if provided
          const attachedDocs: string[] = [];
          if (args.documentIds && args.documentIds.length > 0) {
            for (const docId of args.documentIds) {
              try {
                await db.insert(workflowDocumentInputs).values({
                  id: crypto.randomUUID(),
                  workflowId: id,
                  documentId: docId,
                  stepId: null,
                  createdAt: now,
                });
                attachedDocs.push(docId);
              } catch {
                // Skip duplicates or invalid doc IDs
              }
            }
          }

          // Attach per-step documents from step definitions
          let stepDocCount = 0;
          for (const step of parsedDef.steps) {
            if (step.documentIds && Array.isArray(step.documentIds)) {
              for (const docId of step.documentIds) {
                try {
                  await db.insert(workflowDocumentInputs).values({
                    id: crypto.randomUUID(),
                    workflowId: id,
                    documentId: docId,
                    stepId: step.id,
                    createdAt: now,
                  });
                  stepDocCount++;
                } catch {
                  // Skip duplicates or invalid doc IDs
                }
              }
            }
          }

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
            runtimeId: workflow.runtimeId,
            createdAt: workflow.createdAt,
            attachedDocuments: attachedDocs.length,
            stepScopedDocuments: stepDocCount,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to create workflow");
        }
      }
    ),

    defineTool(
      "get_workflow",
      "Get full workflow details including definition and step information.",
      {
        workflowId: z.string().describe("The workflow ID to look up"),
      },
      async (args) => {
        try {
          const workflow = db
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

    defineTool(
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
          const existing = db
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

    defineTool(
      "delete_workflow",
      "Delete a workflow and its child tasks, logs, and notifications. Cannot delete an active workflow. Requires approval.",
      {
        workflowId: z.string().describe("The workflow ID to delete"),
      },
      async (args) => {
        try {
          const existing = db
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

    defineTool(
      "execute_workflow",
      "Start executing a workflow. Returns immediately — execution runs in the background. Requires approval.",
      {
        workflowId: z.string().describe("The workflow ID to execute"),
      },
      async (args) => {
        try {
          const workflow = db
            .select()
            .from(workflows)
            .where(eq(workflows.id, args.workflowId))
            .get();

          if (!workflow) return err(`Workflow not found: ${args.workflowId}`);

          // Allow re-execution from crashed "active" if no live tasks
          if (workflow.status === "active") {
            const liveTasks = await db
              .select({ id: tasks.id })
              .from(tasks)
              .where(
                and(
                  eq(tasks.workflowId, args.workflowId),
                  inArray(tasks.status, ["running", "queued"])
                )
              );
            if (liveTasks.length > 0) {
              return err("Workflow is already running");
            }
            // Crashed — fall through to reset + re-execute
          }

          if (
            workflow.status !== "draft" &&
            workflow.status !== "paused" &&
            workflow.status !== "failed" &&
            workflow.status !== "active" &&
            workflow.status !== "completed"
          ) {
            return err(`Cannot execute a workflow in '${workflow.status}' status`);
          }

          // Reset state for re-execution from non-draft status
          if (workflow.status !== "draft") {
            // Cancel orphaned tasks
            await db
              .update(tasks)
              .set({ status: "cancelled", updatedAt: new Date() })
              .where(
                and(
                  eq(tasks.workflowId, args.workflowId),
                  inArray(tasks.status, ["running", "queued"])
                )
              );

            // Clear execution state
            const { parseWorkflowState } = await import("@/lib/workflows/engine");
            const { definition } = parseWorkflowState(workflow.definition);
            await db
              .update(workflows)
              .set({
                definition: JSON.stringify(definition),
                status: "draft",
                updatedAt: new Date(),
              })
              .where(eq(workflows.id, args.workflowId));
          }

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

    defineTool(
      "resume_workflow",
      "Resume a workflow that is paused at a delay step, immediately skipping the remaining delay. Use when the user says 'resume now' or 'skip the wait' for a paused workflow. Only works if the workflow status is 'paused' — a 409 response means the scheduler already resumed it. Requires approval.",
      {
        workflowId: z.string().describe("The workflow ID to resume"),
      },
      async (args) => {
        try {
          const workflow = db
            .select()
            .from(workflows)
            .where(eq(workflows.id, args.workflowId))
            .get();

          if (!workflow) return err(`Workflow not found: ${args.workflowId}`);

          if (workflow.status !== "paused") {
            return err(
              `Workflow is not paused (current status: ${workflow.status}). Only paused workflows can be resumed.`,
            );
          }

          const { resumeWorkflow } = await import("@/lib/workflows/engine");
          // Fire-and-forget: resumeWorkflow performs atomic status transition internally.
          resumeWorkflow(args.workflowId).catch((error) => {
            console.error(`Workflow ${args.workflowId} resume failed:`, error);
          });

          ctx.onToolResult?.("resume_workflow", { id: args.workflowId, name: workflow.name });
          return ok({
            message: "Workflow resume dispatched",
            workflowId: args.workflowId,
            name: workflow.name,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to resume workflow");
        }
      },
    ),

    defineTool(
      "get_workflow_status",
      "Get the current execution status of a workflow, including step-by-step progress.",
      {
        workflowId: z.string().describe("The workflow ID to check"),
      },
      async (args) => {
        try {
          const workflow = db
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

    defineTool(
      "find_related_documents",
      "Search for documents in the project pool that could be used as context for a workflow. Returns output documents from completed workflows and uploaded documents. Use this proactively when creating follow-up workflows to discover relevant context.",
      {
        projectId: z
          .string()
          .optional()
          .describe("Project ID to search in. Omit to use the active project."),
        query: z
          .string()
          .optional()
          .describe("Search query to match against document names"),
        direction: z
          .enum(["input", "output"])
          .optional()
          .describe('Filter by direction. Use "output" to find documents produced by other workflows.'),
        sourceWorkflowId: z
          .string()
          .optional()
          .describe("Filter to documents produced by a specific workflow"),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of documents to return (default: 20)"),
      },
      async (args) => {
        try {
          const effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined;
          if (!effectiveProjectId) {
            return err("No project context — specify a projectId or set an active project");
          }

          const conditions = [
            eq(documents.projectId, effectiveProjectId),
            eq(documents.status, "ready"),
          ];

          if (args.direction) {
            conditions.push(eq(documents.direction, args.direction));
          }

          if (args.query) {
            conditions.push(like(documents.originalName, `%${args.query}%`));
          }

          if (args.sourceWorkflowId) {
            // Find task IDs belonging to the source workflow
            const workflowTasks = await db
              .select({ id: tasks.id })
              .from(tasks)
              .where(eq(tasks.workflowId, args.sourceWorkflowId));

            const taskIds = workflowTasks.map((t) => t.id);
            if (taskIds.length > 0) {
              conditions.push(inArray(documents.taskId, taskIds));
            } else {
              return ok([]); // No tasks for this workflow
            }
          }

          const result = await db
            .select({
              id: documents.id,
              originalName: documents.originalName,
              mimeType: documents.mimeType,
              size: documents.size,
              direction: documents.direction,
              category: documents.category,
              status: documents.status,
              taskId: documents.taskId,
              createdAt: documents.createdAt,
            })
            .from(documents)
            .where(and(...conditions))
            .orderBy(desc(documents.createdAt))
            .limit(args.limit ?? 20);

          // Enrich with source workflow name
          const enriched = await Promise.all(
            result.map(async (doc) => {
              let sourceWorkflowName: string | null = null;
              if (doc.taskId) {
                const [task] = await db
                  .select({ workflowId: tasks.workflowId })
                  .from(tasks)
                  .where(eq(tasks.id, doc.taskId));
                if (task?.workflowId) {
                  const [wf] = await db
                    .select({ name: workflows.name })
                    .from(workflows)
                    .where(eq(workflows.id, task.workflowId));
                  sourceWorkflowName = wf?.name ?? null;
                }
              }
              return {
                ...doc,
                sourceWorkflow: sourceWorkflowName,
              };
            })
          );

          return ok(enriched);
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to find documents"
          );
        }
      }
    ),
  ];
}
