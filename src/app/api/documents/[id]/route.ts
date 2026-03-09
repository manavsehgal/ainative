import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id));

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if ("taskId" in body) updates.taskId = body.taskId;
  if ("projectId" in body) updates.projectId = body.projectId;
  if ("category" in body) updates.category = body.category;

  await db
    .update(documents)
    .set(updates)
    .where(eq(documents.id, id));

  const [updated] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id));

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id));

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    await unlink(doc.storagePath);
  } catch {
    // File may already be deleted
  }

  await db.delete(documents).where(eq(documents.id, id));

  return new NextResponse(null, { status: 204 });
}
