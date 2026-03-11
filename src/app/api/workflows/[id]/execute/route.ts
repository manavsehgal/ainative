import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { executeWorkflow } from "@/lib/workflows/engine";
import type { WorkflowDefinition } from "@/lib/workflows/types";

export async function POST(
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

  if (workflow.status === "active") {
    return NextResponse.json(
      { error: "Workflow is already running" },
      { status: 409 }
    );
  }

  // Re-run: reset state for completed/failed workflows
  if (workflow.status === "completed" || workflow.status === "failed") {
    try {
      const def = JSON.parse(workflow.definition) as WorkflowDefinition & {
        _state?: unknown;
        _loopState?: unknown;
      };
      delete def._state;
      delete def._loopState;

      await db
        .update(workflows)
        .set({
          definition: JSON.stringify(def),
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, id));
    } catch {
      return NextResponse.json(
        { error: "Failed to reset workflow state" },
        { status: 500 }
      );
    }
  }

  // Atomic claim: transition to "active" only if still in draft state.
  // Prevents concurrent double-execution from parallel requests.
  const claimResult = db
    .update(workflows)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(
        eq(workflows.id, id),
        eq(workflows.status, "draft")
      )
    )
    .run();

  if (claimResult.changes === 0) {
    return NextResponse.json(
      { error: "Workflow is already running" },
      { status: 409 }
    );
  }

  // Fire-and-forget execution
  executeWorkflow(id).catch((error) => {
    console.error(`Workflow ${id} execution failed:`, error);
  });

  return NextResponse.json({ status: "started", workflowId: id }, { status: 202 });
}
