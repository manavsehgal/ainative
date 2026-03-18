import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows, tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { WorkflowDefinition } from "@/lib/workflows/types";
import { validateWorkflowDefinition } from "@/lib/workflows/definition-validation";
import { validateWorkflowDefinitionAssignments } from "@/lib/agents/profiles/assignment-validation";
import { executeWorkflow } from "@/lib/workflows/engine";

interface FromAssistBody {
  name?: string;
  projectId?: string;
  definition?: WorkflowDefinition;
  priority?: number;
  assignedAgent?: string;
  executeImmediately?: boolean;
  parentTask?: {
    title: string;
    description: string;
    agentProfile?: string;
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as FromAssistBody;
  const { name, projectId, definition, priority, assignedAgent, executeImmediately } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!definition) {
    return NextResponse.json(
      { error: "Definition must include pattern and at least one step" },
      { status: 400 }
    );
  }

  const definitionError = validateWorkflowDefinition(definition);
  if (definitionError) {
    return NextResponse.json({ error: definitionError }, { status: 400 });
  }

  const compatibilityError = validateWorkflowDefinitionAssignments(definition);
  if (compatibilityError) {
    return NextResponse.json({ error: compatibilityError }, { status: 400 });
  }

  // Transaction: create workflow + step tasks atomically (no phantom parent task)
  const workflowId = crypto.randomUUID();
  const now = new Date();
  const taskIds: string[] = [];

  try {
    db.transaction((tx) => {
      // Create workflow — no sourceTaskId needed since there's no parent task
      tx.insert(workflows)
        .values({
          id: workflowId,
          name: name.trim(),
          projectId: projectId || null,
          definition: JSON.stringify(definition),
          status: executeImmediately ? "active" : "draft",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Create tasks for each step (with workflowId — hidden from dashboard kanban)
      for (const step of definition.steps) {
        const taskId = crypto.randomUUID();
        taskIds.push(taskId);

        tx.insert(tasks)
          .values({
            id: taskId,
            title: step.name,
            description: step.prompt,
            projectId: projectId || null,
            workflowId,
            status: "planned",
            assignedAgent: step.assignedAgent ?? assignedAgent ?? null,
            agentProfile: step.agentProfile ?? null,
            priority: priority ?? 2,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    });
  } catch (error) {
    console.error("Failed to create workflow from assist:", error);
    return NextResponse.json(
      { error: "Failed to create workflow and tasks" },
      { status: 500 }
    );
  }

  // Fire-and-forget execution if requested
  if (executeImmediately) {
    executeWorkflow(workflowId).catch((error) => {
      console.error(`Workflow ${workflowId} execution failed:`, error);
    });
  }

  const [created] = await db.select().from(workflows).where(eq(workflows.id, workflowId));

  return NextResponse.json(
    {
      workflow: created,
      taskIds,
      parentTaskId: null,
      status: executeImmediately ? "started" : "created",
    },
    { status: 201 }
  );
}
