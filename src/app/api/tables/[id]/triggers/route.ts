import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { userTableTriggers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTable } from "@/lib/data/tables";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const table = await getTable(id);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const triggers = db
      .select()
      .from(userTableTriggers)
      .where(eq(userTableTriggers.tableId, id))
      .all();

    return NextResponse.json(triggers);
  } catch (err) {
    console.error("[tables/triggers] GET error:", err);
    return NextResponse.json({ error: "Failed to list triggers" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const table = await getTable(id);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, triggerEvent, condition, actionType, actionConfig } = body as {
      name?: string;
      triggerEvent?: string;
      condition?: unknown;
      actionType?: string;
      actionConfig?: unknown;
    };

    if (!name || !triggerEvent || !actionType || !actionConfig) {
      return NextResponse.json(
        { error: "name, triggerEvent, actionType, and actionConfig are required" },
        { status: 400 }
      );
    }

    const now = new Date();
    const triggerId = randomUUID();

    db.insert(userTableTriggers)
      .values({
        id: triggerId,
        tableId: id,
        name,
        triggerEvent: triggerEvent as "row_added" | "row_updated" | "row_deleted",
        condition: condition ? JSON.stringify(condition) : null,
        actionType: actionType as "run_workflow" | "create_task",
        actionConfig: JSON.stringify(actionConfig),
        status: "active",
        fireCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const trigger = db
      .select()
      .from(userTableTriggers)
      .where(eq(userTableTriggers.id, triggerId))
      .get();

    return NextResponse.json(trigger, { status: 201 });
  } catch (err) {
    console.error("[tables/triggers] POST error:", err);
    return NextResponse.json({ error: "Failed to create trigger" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {

  try {
    const body = await req.json();
    const { triggerId, status } = body as { triggerId?: string; status?: string };

    if (!triggerId || !status) {
      return NextResponse.json(
        { error: "triggerId and status are required" },
        { status: 400 }
      );
    }

    db.update(userTableTriggers)
      .set({
        status: status as "active" | "paused",
        updatedAt: new Date(),
      })
      .where(eq(userTableTriggers.id, triggerId))
      .run();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[tables/triggers] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update trigger" }, { status: 500 });
  }
}
