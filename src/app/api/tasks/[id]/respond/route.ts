import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { notificationId, behavior, message, updatedInput } = body;

  if (!notificationId || !behavior) {
    return NextResponse.json(
      { error: "notificationId and behavior are required" },
      { status: 400 }
    );
  }

  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId));

  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  if (notification.response) {
    return NextResponse.json({ error: "Already responded" }, { status: 409 });
  }

  // Write response — the polling loop in claude-agent.ts will detect this
  const responseData = { behavior, message, updatedInput };
  await db
    .update(notifications)
    .set({
      response: JSON.stringify(responseData),
      respondedAt: new Date(),
      read: true,
    })
    .where(eq(notifications.id, notificationId));

  return NextResponse.json({ success: true });
}
