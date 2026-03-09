import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeWorkflow } from "@/lib/workflows/engine";

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

  // Fire-and-forget execution
  executeWorkflow(id).catch((error) => {
    console.error(`Workflow ${id} execution failed:`, error);
  });

  return NextResponse.json({ status: "started", workflowId: id }, { status: 202 });
}
