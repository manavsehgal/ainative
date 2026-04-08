import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows, tasks, documents } from "@/lib/db/schema";
import { eq, and, inArray, count, desc, sql as drizzleSql } from "drizzle-orm";
import { parseWorkflowState } from "@/lib/workflows/engine";

/** Collect output documents for workflow step tasks + input documents from parent task */
async function getWorkflowDocuments(
  state: { stepStates: Array<{ taskId?: string }> } | null,
  sourceTaskId?: string
) {
  const stepDocuments: Record<string, Array<{ id: string; originalName: string; mimeType: string; storagePath: string; direction: string }>> = {};
  const parentDocuments: Array<{ id: string; originalName: string; mimeType: string; storagePath: string; direction: string }> = [];

  try {
    // Collect step task IDs that have completed
    const stepTaskIds = (state?.stepStates ?? [])
      .map((s) => s.taskId)
      .filter((id): id is string => !!id);

    if (stepTaskIds.length > 0) {
      const outputDocs = await db
        .select({
          id: documents.id,
          taskId: documents.taskId,
          originalName: documents.originalName,
          mimeType: documents.mimeType,
          storagePath: documents.storagePath,
          direction: documents.direction,
        })
        .from(documents)
        .where(and(inArray(documents.taskId, stepTaskIds), eq(documents.direction, "output")));

      for (const doc of outputDocs) {
        if (!doc.taskId) continue;
        if (!stepDocuments[doc.taskId]) stepDocuments[doc.taskId] = [];
        stepDocuments[doc.taskId].push({
          id: doc.id,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          storagePath: doc.storagePath,
          direction: doc.direction,
        });
      }
    }

    // Parent task input documents
    if (sourceTaskId) {
      const inputDocs = await db
        .select({
          id: documents.id,
          originalName: documents.originalName,
          mimeType: documents.mimeType,
          storagePath: documents.storagePath,
          direction: documents.direction,
        })
        .from(documents)
        .where(and(eq(documents.taskId, sourceTaskId), eq(documents.direction, "input")));

      parentDocuments.push(...inputDocs);
    }
  } catch (error) {
    console.error("[workflow-status] Failed to query workflow documents:", error);
  }

  return { stepDocuments, parentDocuments };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id));

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const runHistory = await db
    .select({
      runNumber: tasks.workflowRunNumber,
      taskCount: count(tasks.id),
      completedCount: drizzleSql<number>`SUM(CASE WHEN ${tasks.status} = 'completed' THEN 1 ELSE 0 END)`,
      failedCount: drizzleSql<number>`SUM(CASE WHEN ${tasks.status} = 'failed' THEN 1 ELSE 0 END)`,
    })
    .from(tasks)
    .where(eq(tasks.workflowId, id))
    .groupBy(tasks.workflowRunNumber)
    .orderBy(desc(tasks.workflowRunNumber));

  const { definition, state, loopState } = parseWorkflowState(workflow.definition);
  const sourceTaskId: string | undefined = definition.sourceTaskId;
  const { stepDocuments, parentDocuments } = await getWorkflowDocuments(state, sourceTaskId);

  // Loop pattern returns loop-specific data instead of step states
  if (definition.pattern === "loop") {
    return NextResponse.json({
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      projectId: workflow.projectId,
      definition: workflow.definition,
      pattern: definition.pattern,
      loopConfig: definition.loopConfig,
      swarmConfig: definition.swarmConfig,
      loopState,
      steps: definition.steps,
      stepDocuments,
      parentDocuments,
      runNumber: workflow.runNumber,
      runHistory,
    });
  }

  return NextResponse.json({
    id: workflow.id,
    name: workflow.name,
    status: workflow.status,
    resumeAt: workflow.resumeAt ?? null,
    projectId: workflow.projectId,
    definition: workflow.definition,
    pattern: definition.pattern,
    swarmConfig: definition.swarmConfig,
    steps: definition.steps.map((step, i) => ({
      ...step,
      state: state?.stepStates[i] ?? { stepId: step.id, status: "pending" },
    })),
    workflowState: state,
    stepDocuments,
    parentDocuments,
    runNumber: workflow.runNumber,
    runHistory,
  });
}
