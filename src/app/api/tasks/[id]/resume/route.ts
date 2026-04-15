import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { MAX_RESUME_COUNT } from "@/lib/constants/task-status";
import {
  BudgetLimitExceededError,
  enforceTaskBudgetGuardrails,
} from "@/lib/settings/budget-guardrails";
import { resolveResumeExecutionTarget } from "@/lib/agents/runtime/execution-target";
import { resumeTaskExecution } from "@/lib/agents/task-dispatch";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check task exists and has a session
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!task.sessionId) {
    return NextResponse.json(
      { error: "No session to resume — use Retry instead" },
      { status: 400 }
    );
  }

  if (task.resumeCount >= MAX_RESUME_COUNT) {
    return NextResponse.json(
      { error: "Resume limit reached. Re-queue for fresh start." },
      { status: 400 }
    );
  }

  try {
    await enforceTaskBudgetGuardrails(id, { isResume: true });
  } catch (error) {
    if (error instanceof BudgetLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  // Atomic claim: failed/cancelled → running
  const claimed = db
    .update(tasks)
    .set({ status: "running", updatedAt: new Date() })
    .where(
      and(
        eq(tasks.id, id),
        inArray(tasks.status, ["failed", "cancelled"])
      )
    )
    .returning()
    .all();

  if (claimed.length === 0) {
    return NextResponse.json(
      {
        error: `Task must be failed or cancelled to resume, current status: ${task.status}`,
      },
      { status: 400 }
    );
  }

  try {
    await resolveResumeExecutionTarget({
      requestedRuntimeId: task.assignedAgent,
      effectiveRuntimeId: task.effectiveRuntimeId,
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

  // Fire-and-forget
  resumeTaskExecution(id, {
    requestedRuntimeId: task.assignedAgent,
    effectiveRuntimeId: task.effectiveRuntimeId,
  }).catch((err) =>
    console.error(`Task ${id} resume error:`, err)
  );

  return NextResponse.json({ message: "Resume started" }, { status: 202 });
}
