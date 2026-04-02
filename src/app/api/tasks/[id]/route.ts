import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, projects, workflows, schedules, usageLedger, documents } from "@/lib/db/schema";
import { eq, sum, min, max } from "drizzle-orm";
import { updateTaskSchema } from "@/lib/validators/task";
import { isValidTransition, type TaskStatus } from "@/lib/constants/task-status";
import { validateRuntimeProfileAssignment } from "@/lib/agents/profiles/assignment-validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Join relationship names
  let projectName: string | undefined;
  let workflowName: string | undefined;
  let scheduleName: string | undefined;

  if (task.projectId) {
    const [p] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, task.projectId));
    projectName = p?.name;
  }
  if (task.workflowId) {
    const [w] = await db.select({ name: workflows.name }).from(workflows).where(eq(workflows.id, task.workflowId));
    workflowName = w?.name;
  }
  if (task.scheduleId) {
    const [s] = await db.select({ name: schedules.name }).from(schedules).where(eq(schedules.id, task.scheduleId));
    scheduleName = s?.name;
  }

  // Aggregate usage from usage_ledger
  const [usage] = await db
    .select({
      inputTokens: sum(usageLedger.inputTokens),
      outputTokens: sum(usageLedger.outputTokens),
      totalTokens: sum(usageLedger.totalTokens),
      costMicros: sum(usageLedger.costMicros),
      modelId: max(usageLedger.modelId),
      startedAt: min(usageLedger.startedAt),
      finishedAt: max(usageLedger.finishedAt),
    })
    .from(usageLedger)
    .where(eq(usageLedger.taskId, id));

  const hasUsage = usage?.totalTokens != null;

  return NextResponse.json({
    ...task,
    projectName,
    workflowName,
    scheduleName,
    usage: hasUsage
      ? {
          inputTokens: usage.inputTokens ? Number(usage.inputTokens) : null,
          outputTokens: usage.outputTokens ? Number(usage.outputTokens) : null,
          totalTokens: usage.totalTokens ? Number(usage.totalTokens) : null,
          costMicros: usage.costMicros ? Number(usage.costMicros) : null,
          modelId: usage.modelId ?? null,
          startedAt: usage.startedAt instanceof Date ? usage.startedAt.toISOString() : usage.startedAt,
          finishedAt: usage.finishedAt instanceof Date ? usage.finishedAt.toISOString() : usage.finishedAt,
        }
      : undefined,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const compatibilityError = validateRuntimeProfileAssignment({
    profileId:
      parsed.data.agentProfile !== undefined
        ? parsed.data.agentProfile
        : existing.agentProfile,
    runtimeId:
      parsed.data.assignedAgent !== undefined
        ? parsed.data.assignedAgent
        : existing.assignedAgent,
    context: "Task profile",
  });
  if (compatibilityError) {
    return NextResponse.json({ error: compatibilityError }, { status: 400 });
  }

  // Validate status transitions
  if (parsed.data.status && parsed.data.status !== existing.status) {
    if (!isValidTransition(existing.status as TaskStatus, parsed.data.status as TaskStatus)) {
      return NextResponse.json(
        { error: `Invalid transition from ${existing.status} to ${parsed.data.status}` },
        { status: 400 }
      );
    }
  }

  // Extract documentIds before spreading into task update (not a task column)
  const { documentIds, ...taskFields } = parsed.data;
  const now = new Date();

  await db
    .update(tasks)
    .set({ ...taskFields, updatedAt: now })
    .where(eq(tasks.id, id));

  // Handle document linking/unlinking
  if (documentIds !== undefined) {
    try {
      // Unlink documents previously linked to this task that are no longer selected
      const currentDocs = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.taskId, id));
      const newDocSet = new Set(documentIds);
      for (const doc of currentDocs) {
        if (!newDocSet.has(doc.id)) {
          await db.update(documents)
            .set({ taskId: null, updatedAt: now })
            .where(eq(documents.id, doc.id));
        }
      }
      // Link newly selected documents
      for (const docId of documentIds) {
        await db.update(documents)
          .set({
            taskId: id,
            projectId: existing.projectId,
            updatedAt: now,
          })
          .where(eq(documents.id, docId));
      }
    } catch (err) {
      console.error("[tasks] Document association failed:", err);
    }
  }

  const [updated] = await db.select().from(tasks).where(eq(tasks.id, id));
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(tasks).where(eq(tasks.id, id));
  return NextResponse.json({ success: true });
}
