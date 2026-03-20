import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { views } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * PATCH /api/views/[id]
 * Update a saved view.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, filters, sorting, columns, density, isDefault } = body;

  const [existing] = await db.select().from(views).where(eq(views.id, id));
  if (!existing) {
    return NextResponse.json({ error: "View not found" }, { status: 404 });
  }

  const now = new Date();

  // If setting as default, clear other defaults for this surface
  if (isDefault) {
    await db
      .update(views)
      .set({ isDefault: false, updatedAt: now })
      .where(and(eq(views.surface, existing.surface), eq(views.isDefault, true)));
  }

  await db
    .update(views)
    .set({
      ...(name !== undefined && { name }),
      ...(filters !== undefined && { filters: JSON.stringify(filters) }),
      ...(sorting !== undefined && { sorting: JSON.stringify(sorting) }),
      ...(columns !== undefined && { columns: JSON.stringify(columns) }),
      ...(density !== undefined && { density }),
      ...(isDefault !== undefined && { isDefault }),
      updatedAt: now,
    })
    .where(eq(views.id, id));

  const [updated] = await db.select().from(views).where(eq(views.id, id));
  return NextResponse.json(updated);
}

/**
 * DELETE /api/views/[id]
 * Delete a saved view.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = db.delete(views).where(eq(views.id, id)).run();

  if (result.changes === 0) {
    return NextResponse.json({ error: "View not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
