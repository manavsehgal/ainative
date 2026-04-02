import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq, and, ne, isNull } from "drizzle-orm";

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

  if (!task || !task.workflowId) {
    return NextResponse.json([]);
  }
  // Match siblings by workflowId + workflowRunNumber.
  // For pre-existing tasks (workflowRunNumber is NULL), match all tasks
  // in the same workflow that also have NULL workflowRunNumber.
  const runCondition = task.workflowRunNumber != null
    ? eq(tasks.workflowRunNumber, task.workflowRunNumber)
    : isNull(tasks.workflowRunNumber);

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
        runCondition,
        ne(tasks.id, id)
      )
    )
    .orderBy(tasks.createdAt);

  return NextResponse.json(siblings);
}
