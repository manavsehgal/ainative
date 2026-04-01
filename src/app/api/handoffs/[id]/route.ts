import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [message] = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.id, id));

  if (!message) {
    return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
  }

  return NextResponse.json(message);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { action, approvedBy } = body as {
    action?: "approve" | "reject";
    approvedBy?: string;
  };

  const [message] = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.id, id));

  if (!message) {
    return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
  }

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  if (message.status !== "pending") {
    return NextResponse.json(
      { error: `Cannot ${action} a handoff with status: ${message.status}` },
      { status: 409 }
    );
  }

  const now = new Date();
  const newStatus = action === "approve" ? "accepted" : "rejected";

  await db
    .update(agentMessages)
    .set({
      status: newStatus,
      approvedBy: approvedBy ?? "user",
      respondedAt: now,
    })
    .where(eq(agentMessages.id, id));

  const [updated] = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.id, id));

  return NextResponse.json(updated);
}
