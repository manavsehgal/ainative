import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resumeWorkflow } from "@/lib/workflows/engine";

/**
 * POST /api/workflows/[id]/resume
 *
 * Manually resume a workflow that was paused at a delay step. Called by the
 * "Resume Now" button in WorkflowStatusView to skip the remaining delay. The
 * scheduler tick also calls resumeWorkflow() directly (not through this route)
 * when workflows.resume_at is reached.
 *
 * Response codes:
 *   202 Accepted   — resume dispatched (fire-and-forget)
 *   404 Not Found  — workflow does not exist
 *   409 Conflict   — workflow is not in paused state (already resumed, racing
 *                    scheduler, or was never paused). resumeWorkflow handles
 *                    this internally with its atomic status transition, so the
 *                    conflict is reported here for correct UX feedback.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id));

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  if (workflow.status !== "paused") {
    return NextResponse.json(
      {
        error: `Workflow is not paused (current status: ${workflow.status})`,
        status: workflow.status,
      },
      { status: 409 },
    );
  }

  // Fire-and-forget. resumeWorkflow performs its own atomic status check, so
  // if the scheduler tick beats this request by microseconds, the DB UPDATE
  // will match zero rows and resumeWorkflow returns silently without harm.
  resumeWorkflow(id).catch((error) => {
    console.error(`Workflow ${id} resume failed:`, error);
  });

  return NextResponse.json(
    { status: "resuming", workflowId: id },
    { status: 202 },
  );
}
