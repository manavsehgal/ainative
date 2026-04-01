import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentMessages } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { sendHandoff } from "@/lib/agents/handoff/bus";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const profileId = searchParams.get("profileId");

  const conditions = [];
  if (status) {
    conditions.push(eq(agentMessages.status, status as "pending" | "accepted" | "in_progress" | "completed" | "rejected" | "expired"));
  }
  if (profileId) {
    conditions.push(eq(agentMessages.toProfileId, profileId));
  }

  const result = await db
    .select()
    .from(agentMessages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agentMessages.createdAt))
    .limit(100);

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    fromProfileId,
    toProfileId,
    sourceTaskId,
    subject,
    body: messageBody,
    priority,
    requiresApproval,
    parentMessageId,
  } = body as {
    fromProfileId?: string;
    toProfileId?: string;
    sourceTaskId?: string;
    subject?: string;
    body?: string;
    priority?: number;
    requiresApproval?: boolean;
    parentMessageId?: string;
  };

  if (!fromProfileId?.trim()) {
    return NextResponse.json({ error: "fromProfileId is required" }, { status: 400 });
  }
  if (!toProfileId?.trim()) {
    return NextResponse.json({ error: "toProfileId is required" }, { status: 400 });
  }
  if (!subject?.trim()) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (!messageBody?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  try {
    const messageId = await sendHandoff({
      fromProfileId: fromProfileId.trim(),
      toProfileId: toProfileId.trim(),
      sourceTaskId: sourceTaskId ?? "",
      subject: subject.trim(),
      body: messageBody.trim(),
      priority,
      requiresApproval,
      parentMessageId,
    });

    const [created] = await db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.id, messageId));

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
