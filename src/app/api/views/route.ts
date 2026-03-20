import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { views } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * GET /api/views?surface=tasks
 * List saved views for a surface.
 */
export async function GET(req: NextRequest) {
  const surface = req.nextUrl.searchParams.get("surface");
  if (!surface) {
    return NextResponse.json({ error: "surface param required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(views)
    .where(eq(views.surface, surface))
    .orderBy(desc(views.isDefault), views.name);

  return NextResponse.json(rows);
}

/**
 * POST /api/views
 * Create a new saved view.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { surface, name, filters, sorting, columns, density, isDefault } = body;

  if (!surface || !name) {
    return NextResponse.json(
      { error: "surface and name are required" },
      { status: 400 }
    );
  }

  const now = new Date();
  const id = randomUUID();

  // If setting as default, clear other defaults for this surface
  if (isDefault) {
    await db
      .update(views)
      .set({ isDefault: false, updatedAt: now })
      .where(and(eq(views.surface, surface), eq(views.isDefault, true)));
  }

  await db.insert(views).values({
    id,
    surface,
    name,
    filters: filters ? JSON.stringify(filters) : null,
    sorting: sorting ? JSON.stringify(sorting) : null,
    columns: columns ? JSON.stringify(columns) : null,
    density: density ?? "comfortable",
    isDefault: isDefault ?? false,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(views).where(eq(views.id, id));
  return NextResponse.json(created, { status: 201 });
}
