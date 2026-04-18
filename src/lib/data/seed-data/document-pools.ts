import { db } from "@/lib/db";
import {
  projectDocumentDefaults,
  workflowDocumentInputs,
  scheduleDocumentInputs,
  tableDocumentInputs,
  workflowTableInputs,
  scheduleTableInputs,
  taskTableInputs,
} from "@/lib/db/schema";

/**
 * Wire up the document-pool and table-pool junctions so that each
 * project has default documents available, workflows bind inputs
 * to specific steps, schedules attach policy docs, and tables join
 * via task/workflow/schedule input sets. This gives every surface
 * that reads from these pools a non-empty state for screengrabs.
 */
export async function createDocumentPools(params: {
  projectIds: string[];
  workflowIds: string[];
  scheduleIds: string[];
  taskIds: string[];
  documentIds: string[];
  tableIds: string[];
}): Promise<{
  projectDefaults: number;
  workflowInputs: number;
  scheduleInputs: number;
  tableDocInputs: number;
  workflowTableInputs: number;
  scheduleTableInputs: number;
  taskTableInputs: number;
}> {
  const {
    projectIds,
    workflowIds,
    scheduleIds,
    taskIds,
    documentIds,
    tableIds,
  } = params;

  const now = new Date();
  let projectDefaults = 0;
  let workflowInputs = 0;
  let scheduleInputs = 0;
  let tableDocInputs = 0;
  let wfTableInputs = 0;
  let schedTableInputs = 0;
  let taskTbInputs = 0;

  // ── Project document defaults ─────────────────────────────────────
  // Give the first 3 projects a default-doc each (e.g., brand brief,
  // playbook, policy doc) so the project detail page shows defaults.
  const defaultDocCount = Math.min(3, projectIds.length, documentIds.length);
  for (let i = 0; i < defaultDocCount; i++) {
    await db.insert(projectDocumentDefaults).values({
      id: crypto.randomUUID(),
      projectId: projectIds[i],
      documentId: documentIds[i],
      createdAt: now,
    });
    projectDefaults++;
  }

  // ── Workflow document inputs ──────────────────────────────────────
  // First workflow: 2 global docs (stepId null) + 1 step-scoped.
  // Second workflow: 2 global docs.
  if (workflowIds.length > 0 && documentIds.length >= 3) {
    await db.insert(workflowDocumentInputs).values([
      {
        id: crypto.randomUUID(),
        workflowId: workflowIds[0],
        documentId: documentIds[0],
        stepId: null,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        workflowId: workflowIds[0],
        documentId: documentIds[1],
        stepId: null,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        workflowId: workflowIds[0],
        documentId: documentIds[2],
        stepId: "copy",
        createdAt: now,
      },
    ]);
    workflowInputs += 3;
  }
  if (workflowIds.length > 1 && documentIds.length >= 5) {
    await db.insert(workflowDocumentInputs).values([
      {
        id: crypto.randomUUID(),
        workflowId: workflowIds[1],
        documentId: documentIds[3],
        stepId: null,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        workflowId: workflowIds[1],
        documentId: documentIds[4],
        stepId: null,
        createdAt: now,
      },
    ]);
    workflowInputs += 2;
  }

  // ── Schedule document inputs ──────────────────────────────────────
  // Heartbeat-style schedules benefit most from a policy doc + checklist.
  const schedDocCount = Math.min(3, scheduleIds.length);
  for (let i = 0; i < schedDocCount; i++) {
    if (!documentIds[i]) continue;
    await db.insert(scheduleDocumentInputs).values({
      id: crypto.randomUUID(),
      scheduleId: scheduleIds[i],
      documentId: documentIds[i],
      createdAt: now,
    });
    scheduleInputs++;
  }

  // ── Table ↔ Document inputs ───────────────────────────────────────
  // Attach the first document to the first 2 tables so the table detail
  // page's "Linked Documents" section has content.
  const tableDocCount = Math.min(2, tableIds.length);
  for (let i = 0; i < tableDocCount; i++) {
    if (!documentIds[i]) continue;
    await db.insert(tableDocumentInputs).values({
      id: crypto.randomUUID(),
      tableId: tableIds[i],
      documentId: documentIds[i],
      createdAt: now,
    });
    tableDocInputs++;
  }

  // ── Workflow ↔ Table inputs ───────────────────────────────────────
  // First workflow reads from the first user table as global context.
  if (workflowIds.length > 0 && tableIds.length > 0) {
    await db.insert(workflowTableInputs).values({
      id: crypto.randomUUID(),
      workflowId: workflowIds[0],
      tableId: tableIds[0],
      stepId: null,
      createdAt: now,
    });
    wfTableInputs++;
  }

  // ── Schedule ↔ Table inputs ───────────────────────────────────────
  // Heartbeat schedule reads from Account Health Scores for watchlists.
  if (scheduleIds.length > 0 && tableIds.length > 2) {
    await db.insert(scheduleTableInputs).values({
      id: crypto.randomUUID(),
      scheduleId: scheduleIds[0],
      tableId: tableIds[2],
      createdAt: now,
    });
    schedTableInputs++;
  }

  // ── Task ↔ Table inputs ───────────────────────────────────────────
  // Attach the first table to 2 seeded tasks so the task detail shows it.
  const taskTableCount = Math.min(2, taskIds.length, tableIds.length);
  for (let i = 0; i < taskTableCount; i++) {
    await db.insert(taskTableInputs).values({
      id: crypto.randomUUID(),
      taskId: taskIds[i],
      tableId: tableIds[i],
      createdAt: now,
    });
    taskTbInputs++;
  }

  return {
    projectDefaults,
    workflowInputs,
    scheduleInputs,
    tableDocInputs,
    workflowTableInputs: wfTableInputs,
    scheduleTableInputs: schedTableInputs,
    taskTableInputs: taskTbInputs,
  };
}
