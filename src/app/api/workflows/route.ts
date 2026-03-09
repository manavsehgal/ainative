import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import type { WorkflowDefinition } from "@/lib/workflows/types";

export async function GET() {
  const result = await db
    .select()
    .from(workflows)
    .orderBy(desc(workflows.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, projectId, definition } = body as {
    name?: string;
    projectId?: string;
    definition?: WorkflowDefinition;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!definition?.pattern || !definition?.steps?.length) {
    return NextResponse.json(
      { error: "Definition must include pattern and at least one step" },
      { status: 400 }
    );
  }

  const validPatterns = ["sequence", "planner-executor", "checkpoint"];
  if (!validPatterns.includes(definition.pattern)) {
    return NextResponse.json(
      { error: `Pattern must be one of: ${validPatterns.join(", ")}` },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(workflows).values({
    id,
    name: name.trim(),
    projectId: projectId || null,
    definition: JSON.stringify(definition),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(workflows).where(eq(workflows.id, id));

  return NextResponse.json(created, { status: 201 });
}
