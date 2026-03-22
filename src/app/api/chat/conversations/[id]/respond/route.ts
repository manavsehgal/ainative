import { NextRequest, NextResponse } from "next/server";
import {
  resolvePendingRequest,
  hasPendingRequest,
} from "@/lib/chat/permission-bridge";
import { updateMessageStatus } from "@/lib/data/chat";
import { addAllowedPermission } from "@/lib/settings/permissions";
import { buildPermissionPattern } from "@/lib/notifications/permissions";

/**
 * POST /api/chat/conversations/[id]/respond
 *
 * Resolves a pending permission or question request in an active chat turn.
 * The permission bridge stores in-memory Promises that block the SDK's
 * canUseTool callback — this endpoint resolves them.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const body = await req.json();

  const {
    requestId,
    messageId,
    behavior,
    updatedInput,
    message,
    alwaysAllow,
    permissionPattern,
    toolName,
    toolInput,
  } = body;

  if (!requestId || !behavior) {
    return NextResponse.json(
      { error: "requestId and behavior are required" },
      { status: 400 }
    );
  }

  if (!hasPendingRequest(requestId)) {
    return NextResponse.json(
      { error: "No pending request found (may have timed out)" },
      { status: 404 }
    );
  }

  // Resolve the in-memory Promise — this unblocks the SDK
  const resolved = resolvePendingRequest(requestId, {
    behavior,
    updatedInput: behavior === "allow" ? updatedInput : undefined,
    message: behavior === "deny" ? (message ?? "User denied this action") : undefined,
  });

  if (!resolved) {
    return NextResponse.json(
      { error: "Failed to resolve request" },
      { status: 500 }
    );
  }

  // If "Always Allow" was selected, persist the permission pattern
  if (alwaysAllow && behavior === "allow") {
    const pattern = permissionPattern ?? (toolName && toolInput
      ? buildPermissionPattern(toolName, toolInput)
      : null);
    if (pattern) {
      await addAllowedPermission(pattern);
    }
  }

  // Update the system message status to reflect the response
  if (messageId) {
    await updateMessageStatus(messageId, behavior === "allow" ? "complete" : "error");
  }

  return NextResponse.json({ ok: true });
}
