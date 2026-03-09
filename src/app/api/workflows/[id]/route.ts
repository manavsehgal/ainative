import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status } = body as { status?: string };

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id));

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  if (status === "paused") {
    if (workflow.status !== "active") {
      return NextResponse.json(
        { error: "Can only pause an active workflow" },
        { status: 409 }
      );
    }

    await db
      .update(workflows)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(workflows.id, id));

    return NextResponse.json({ id, status: "paused" });
  }

  if (status === "active") {
    return NextResponse.json(
      { error: "Use POST /api/workflows/[id]/execute to resume a workflow" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: `Invalid status transition: ${status}` },
    { status: 400 }
  );
}
