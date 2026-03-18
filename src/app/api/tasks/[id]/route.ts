import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, projects, workflows, schedules, usageLedger } from "@/lib/db/schema";
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

  await db
    .update(tasks)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(tasks.id, id));

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
