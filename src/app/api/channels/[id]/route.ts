import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { maskChannelRow } from "@/lib/channels/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [channel] = await db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, id));

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json(maskChannelRow(channel));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, config, status, direction } = body as {
    name?: string;
    config?: Record<string, unknown>;
    status?: "active" | "disabled";
    direction?: "outbound" | "bidirectional";
  };

  const [channel] = await db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, id));

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    updates.name = name.trim();
  }

  if (config !== undefined) {
    updates.config = JSON.stringify(config);
    updates.testStatus = "untested"; // Reset test status when config changes
  }

  if (status !== undefined) {
    if (!["active", "disabled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = status;
  }

  if (direction !== undefined) {
    if (!["outbound", "bidirectional"].includes(direction)) {
      return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
    }
    updates.direction = direction;
  }

  await db.update(channelConfigs).set(updates).where(eq(channelConfigs.id, id));

  const [updated] = await db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, id));

  return NextResponse.json(maskChannelRow(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [channel] = await db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, id));

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  await db.delete(channelConfigs).where(eq(channelConfigs.id, id));

  return NextResponse.json({ deleted: true });
}
