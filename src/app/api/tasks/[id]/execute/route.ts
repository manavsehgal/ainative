import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { classifyTaskProfile } from "@/lib/agents/router";
import { validateRuntimeProfileAssignment } from "@/lib/agents/profiles/assignment-validation";
import {
  BudgetLimitExceededError,
  enforceTaskBudgetGuardrails,
} from "@/lib/settings/budget-guardrails";
import { ensureFreshScan } from "@/lib/environment/auto-scan";
import { resolveTaskExecutionTarget } from "@/lib/agents/runtime/execution-target";
import { startTaskExecution } from "@/lib/agents/task-dispatch";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await enforceTaskBudgetGuardrails(id);
  } catch (error) {
    if (error instanceof BudgetLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  // Atomic check-and-claim: only one request can transition queued → running
  const claimed = db
    .update(tasks)
    .set({ status: "running", updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.status, "queued")))
    .returning()
    .all();

  if (claimed.length === 0) {
    // Either not found or not in queued status
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Task must be queued to execute, current status: ${task.status}` },
      { status: 400 }
    );
  }

  const task = claimed[0];
  let taskProfile = task.agentProfile;

  // Auto-scan environment if the task's project has a workingDirectory
  if (task.projectId) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, task.projectId));
    if (project?.workingDirectory) {
      ensureFreshScan(project.workingDirectory, task.projectId);
    }
  }

  let executionTarget;
  try {
    executionTarget = await resolveTaskExecutionTarget({
      title: task.title,
      description: task.description,
      requestedRuntimeId: task.assignedAgent,
      profileId: taskProfile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    db.update(tasks)
      .set({
        status: "failed",
        result: message,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .run();
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Auto-classify profile if none was set. Use the resolved runtime so the
  // chosen profile is compatible with the runtime we will actually launch.
  if (!taskProfile) {
    const autoProfile = classifyTaskProfile(
      task.title,
      task.description,
      executionTarget.effectiveRuntimeId
    );
    db.update(tasks)
      .set({ agentProfile: autoProfile, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .run();
    taskProfile = autoProfile;
    try {
      executionTarget = await resolveTaskExecutionTarget({
        title: task.title,
        description: task.description,
        requestedRuntimeId: task.assignedAgent,
        profileId: taskProfile,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      db.update(tasks)
        .set({
          status: "failed",
          result: message,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id))
        .run();
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const compatibilityError = validateRuntimeProfileAssignment({
    profileId: taskProfile,
    runtimeId: executionTarget.effectiveRuntimeId,
    context: "Task profile",
  });
  if (compatibilityError) {
    db.update(tasks)
      .set({
        status: "failed",
        result: compatibilityError,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .run();
    return NextResponse.json({ error: compatibilityError }, { status: 400 });
  }

  // Fire-and-forget — task already marked as running
  startTaskExecution(id, { requestedRuntimeId: task.assignedAgent }).catch(
    (err) => console.error(`Task ${id} execution error:`, err)
  );

  return NextResponse.json({ message: "Execution started" }, { status: 202 });
}
