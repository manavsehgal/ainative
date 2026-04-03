import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { userTableViews } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTable } from "@/lib/data/tables";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/tables/[id]/charts — List chart views for a table */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const charts = db
    .select()
    .from(userTableViews)
    .where(and(eq(userTableViews.tableId, id), eq(userTableViews.type, "chart")))
    .all();

  return NextResponse.json(
    charts.map((c) => ({
      ...c,
      config: c.config ? JSON.parse(c.config) : null,
    }))
  );
}

/** POST /api/tables/[id]/charts — Save a new chart configuration */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const table = await getTable(id);
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const body = await req.json();
  const { type, title, xColumn, yColumn, aggregation } = body as {
    type?: string;
    title?: string;
    xColumn?: string;
    yColumn?: string;
    aggregation?: string;
  };

  if (!type || !title || !xColumn) {
    return NextResponse.json(
      { error: "type, title, and xColumn are required" },
      { status: 400 }
    );
  }

  const viewId = randomUUID();
  const now = new Date();

  db.insert(userTableViews)
    .values({
      id: viewId,
      tableId: id,
      name: title,
      type: "chart",
      config: JSON.stringify({ type, xColumn, yColumn, aggregation }),
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return NextResponse.json({ id: viewId, name: title }, { status: 201 });
}
