import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  updateConversation,
  deleteConversation,
  getMessages,
} from "@/lib/data/chat";

/**
 * GET /api/chat/conversations/[id]
 * Get a conversation with message count.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = await getConversation(id);

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const messages = await getMessages(id);

  return NextResponse.json({
    ...conversation,
    messageCount: messages.length,
  });
}

/**
 * PATCH /api/chat/conversations/[id]
 * Update title, status, or modelId.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { title, status, modelId } = body;

  const existing = await getConversation(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (status !== undefined) {
    if (!["active", "archived"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'active' or 'archived'" },
        { status: 400 }
      );
    }
    updates.status = status;
  }
  if (modelId !== undefined) updates.modelId = modelId;

  const updated = await updateConversation(id, updates);
  return NextResponse.json(updated);
}

/**
 * DELETE /api/chat/conversations/[id]
 * Delete a conversation and all its messages.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getConversation(id);

  if (!existing) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  await deleteConversation(id);
  return new NextResponse(null, { status: 204 });
}
