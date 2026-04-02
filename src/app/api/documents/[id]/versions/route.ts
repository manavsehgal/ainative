import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, tasks } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // First, get the document to find its originalName and projectId
  const [doc] = await db
    .select({
      originalName: documents.originalName,
      projectId: documents.projectId,
      direction: documents.direction,
    })
    .from(documents)
    .where(eq(documents.id, id));

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Only output documents have version history
  if (doc.direction !== "output" || !doc.projectId) {
    return NextResponse.json([]);
  }

  // Find all output documents with same originalName + projectId
  const versions = await db
    .select({
      id: documents.id,
      version: documents.version,
      size: documents.size,
      status: documents.status,
      createdAt: documents.createdAt,
      workflowRunNumber: tasks.workflowRunNumber,
    })
    .from(documents)
    .leftJoin(tasks, eq(documents.taskId, tasks.id))
    .where(
      and(
        eq(documents.originalName, doc.originalName),
        eq(documents.projectId, doc.projectId),
        eq(documents.direction, "output")
      )
    )
    .orderBy(desc(documents.version));

  return NextResponse.json(versions);
}
