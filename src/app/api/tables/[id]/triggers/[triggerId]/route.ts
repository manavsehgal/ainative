import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userTableTriggers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ id: string; triggerId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id, triggerId } = await params;

  const trigger = db
    .select()
    .from(userTableTriggers)
    .where(and(eq(userTableTriggers.id, triggerId), eq(userTableTriggers.tableId, id)))
    .get();

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) updates.name = body.name;
  if (body.triggerEvent !== undefined) updates.triggerEvent = body.triggerEvent;
  if (body.status !== undefined) updates.status = body.status;
  if (body.condition !== undefined) updates.condition = body.condition ? JSON.stringify(body.condition) : null;
  if (body.actionType !== undefined) updates.actionType = body.actionType;
  if (body.actionConfig !== undefined) updates.actionConfig = JSON.stringify(body.actionConfig);

  db.update(userTableTriggers)
    .set(updates)
    .where(eq(userTableTriggers.id, triggerId))
    .run();

  const updated = db
    .select()
    .from(userTableTriggers)
    .where(eq(userTableTriggers.id, triggerId))
    .get();

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id, triggerId } = await params;

  const trigger = db
    .select()
    .from(userTableTriggers)
    .where(and(eq(userTableTriggers.id, triggerId), eq(userTableTriggers.tableId, id)))
    .get();

  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  db.delete(userTableTriggers)
    .where(eq(userTableTriggers.id, triggerId))
    .run();

  return new NextResponse(null, { status: 204 });
}
