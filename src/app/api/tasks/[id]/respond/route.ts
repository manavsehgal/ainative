import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const respondSchema = z.object({
  notificationId: z.string().min(1),
  behavior: z.enum(["allow", "deny"]),
  message: z.string().optional(),
  updatedInput: z.unknown().optional(),
  alwaysAllow: z.boolean().optional(),
  permissionPattern: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = respondSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "notificationId (string) and behavior ('allow' | 'deny') are required" },
      { status: 400 }
    );
  }

  const { notificationId, behavior, message, updatedInput, alwaysAllow, permissionPattern } = parsed.data;

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

  // Validate updatedInput keys against the original tool input to prevent injection
  let sanitizedUpdatedInput = updatedInput;
  if (updatedInput !== undefined && updatedInput !== null && typeof updatedInput === "object" && !Array.isArray(updatedInput)) {
    try {
      const originalToolInput = typeof notification.toolInput === "string" ? JSON.parse(notification.toolInput) : (notification.toolInput ?? {});
      if (typeof originalToolInput === "object" && originalToolInput !== null) {
        const allowedKeys = new Set(Object.keys(originalToolInput));
        const inputRecord = updatedInput as Record<string, unknown>;
        const extraKeys = Object.keys(inputRecord).filter((k) => !allowedKeys.has(k));
        if (extraKeys.length > 0) {
          return NextResponse.json(
            { error: `updatedInput contains disallowed keys: ${extraKeys.join(", ")}` },
            { status: 400 }
          );
        }
      }
    } catch {
      // If we can't parse the original notification data, reject updatedInput entirely
      sanitizedUpdatedInput = undefined;
    }
  }

  // Write response — the polling loop in claude-agent.ts will detect this
  const responseData = { behavior, message, updatedInput: sanitizedUpdatedInput, alwaysAllow };
  await db
    .update(notifications)
    .set({
      response: JSON.stringify(responseData),
      respondedAt: new Date(),
      read: true,
    })
    .where(eq(notifications.id, notificationId));

  // Save "Always Allow" permission if requested
  if (behavior === "allow" && alwaysAllow && permissionPattern) {
    const { addAllowedPermission } = await import("@/lib/settings/permissions");
    await addAllowedPermission(permissionPattern);
  }

  return NextResponse.json({ success: true });
}
