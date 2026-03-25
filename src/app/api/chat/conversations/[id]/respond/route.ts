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

  // Resolve the in-memory Promise if it still exists (unblocks SDK).
  // The request may already be gone (timeout, HMR restart, connection drop)
  // — that's fine, we still update DB and UI below.
  const isPending = hasPendingRequest(requestId);
  if (isPending) {
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

  // Always update the system message status — even for stale requests
  // so the UI reflects the user's action on reload
  if (messageId) {
    await updateMessageStatus(messageId, behavior === "allow" ? "complete" : "error");
  }

  return NextResponse.json({ ok: true, stale: !isPending });
}
