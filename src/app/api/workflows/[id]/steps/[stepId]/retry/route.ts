import { NextRequest, NextResponse } from "next/server";
import { retryWorkflowStep } from "@/lib/workflows/engine";

export async function POST(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; stepId: string }>;
  }
) {
  const { id, stepId } = await params;

  retryWorkflowStep(id, stepId).catch((error) => {
    console.error(`Workflow ${id} step ${stepId} retry failed:`, error);
  });

  return NextResponse.json(
    { status: "retry_started", workflowId: id, stepId },
    { status: 202 }
  );
}
