import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseWorkflowState } from "@/lib/workflows/engine";

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

  const { definition, state, loopState } = parseWorkflowState(workflow.definition);

  // Loop pattern returns loop-specific data instead of step states
  if (definition.pattern === "loop") {
    return NextResponse.json({
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      pattern: definition.pattern,
      loopConfig: definition.loopConfig,
      loopState,
      steps: definition.steps,
    });
  }

  return NextResponse.json({
    id: workflow.id,
    name: workflow.name,
    status: workflow.status,
    pattern: definition.pattern,
    steps: definition.steps.map((step, i) => ({
      ...step,
      state: state?.stepStates[i] ?? { stepId: step.id, status: "pending" },
    })),
    workflowState: state,
  });
}
