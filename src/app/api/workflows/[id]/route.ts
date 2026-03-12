import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { WorkflowDefinition } from "@/lib/workflows/types";
import { validateWorkflowDefinitionAssignments } from "@/lib/agents/profiles/assignment-validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, name, definition } = body as {
    status?: string;
    name?: string;
    definition?: WorkflowDefinition;
  };

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id));

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  // Edit name/definition — draft only
  if (name !== undefined || definition !== undefined) {
    if (workflow.status !== "draft") {
      return NextResponse.json(
        { error: "Can only edit draft workflows" },
        { status: 409 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (definition !== undefined) {
      if (!definition.pattern || !definition.steps?.length) {
        return NextResponse.json(
          { error: "Definition must include pattern and at least one step" },
          { status: 400 }
        );
      }
      const validPatterns = ["sequence", "planner-executor", "checkpoint", "loop"];
      if (!validPatterns.includes(definition.pattern)) {
        return NextResponse.json(
          { error: `Pattern must be one of: ${validPatterns.join(", ")}` },
          { status: 400 }
        );
      }
      if (definition.pattern === "loop") {
        const loopConfig = definition.loopConfig;
        if (!loopConfig || typeof loopConfig.maxIterations !== "number" || loopConfig.maxIterations < 1) {
          return NextResponse.json(
            { error: "Loop pattern requires loopConfig with maxIterations >= 1" },
            { status: 400 }
          );
        }
      }

      const compatibilityError =
        validateWorkflowDefinitionAssignments(definition);
      if (compatibilityError) {
        return NextResponse.json(
          { error: compatibilityError },
          { status: 400 }
        );
      }
      updates.definition = JSON.stringify(definition);
    }

    await db.update(workflows).set(updates).where(eq(workflows.id, id));

    const [updated] = await db.select().from(workflows).where(eq(workflows.id, id));
    return NextResponse.json(updated);
  }

  // Status transitions
  if (!status) {
    return NextResponse.json({ error: "status, name, or definition is required" }, { status: 400 });
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

export async function DELETE(
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
      { error: "Cannot delete an active workflow — pause or wait for completion" },
      { status: 409 }
    );
  }

  await db.delete(workflows).where(eq(workflows.id, id));

  return NextResponse.json({ deleted: true });
}
