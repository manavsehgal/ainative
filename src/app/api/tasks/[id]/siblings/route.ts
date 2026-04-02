import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [task] = await db
    .select({
      workflowId: tasks.workflowId,
      workflowRunNumber: tasks.workflowRunNumber,
    })
    .from(tasks)
    .where(eq(tasks.id, id));

  if (!task || !task.workflowId || task.workflowRunNumber == null) {
    return NextResponse.json([]);
  }

  const siblings = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.workflowId, task.workflowId),
        eq(tasks.workflowRunNumber, task.workflowRunNumber),
        ne(tasks.id, id)
      )
    )
    .orderBy(tasks.createdAt);

  return NextResponse.json(siblings);
}
