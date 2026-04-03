import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userTableViews } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ id: string; chartId: string }>;
}

/** PATCH /api/tables/[id]/charts/[chartId] — Update a chart */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id, chartId } = await params;

  const chart = db
    .select()
    .from(userTableViews)
    .where(
      and(
        eq(userTableViews.id, chartId),
        eq(userTableViews.tableId, id),
        eq(userTableViews.type, "chart")
      )
    )
    .get();

  if (!chart) {
    return NextResponse.json({ error: "Chart not found" }, { status: 404 });
  }

  const body = await req.json();
  const existingConfig = chart.config ? JSON.parse(chart.config) : {};
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updates.name = body.title;

  // Merge config fields
  const configUpdates: Record<string, unknown> = {};
  if (body.type !== undefined) configUpdates.type = body.type;
  if (body.xColumn !== undefined) configUpdates.xColumn = body.xColumn;
  if (body.yColumn !== undefined) configUpdates.yColumn = body.yColumn;
  if (body.aggregation !== undefined) configUpdates.aggregation = body.aggregation;

  if (Object.keys(configUpdates).length > 0) {
    updates.config = JSON.stringify({ ...existingConfig, ...configUpdates });
  }

  db.update(userTableViews)
    .set(updates)
    .where(eq(userTableViews.id, chartId))
    .run();

  const updated = db
    .select()
    .from(userTableViews)
    .where(eq(userTableViews.id, chartId))
    .get();

  return NextResponse.json({
    ...updated,
    config: updated?.config ? JSON.parse(updated.config) : null,
  });
}

/** DELETE /api/tables/[id]/charts/[chartId] — Remove a chart */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id, chartId } = await params;

  const chart = db
    .select()
    .from(userTableViews)
    .where(
      and(
        eq(userTableViews.id, chartId),
        eq(userTableViews.tableId, id),
        eq(userTableViews.type, "chart")
      )
    )
    .get();

  if (!chart) {
    return NextResponse.json({ error: "Chart not found" }, { status: 404 });
  }

  db.delete(userTableViews)
    .where(eq(userTableViews.id, chartId))
    .run();

  return new NextResponse(null, { status: 204 });
}
