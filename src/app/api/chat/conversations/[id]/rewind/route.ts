import { NextRequest, NextResponse } from "next/server";
import { getConversation, markPairRewound } from "@/lib/data/chat";
import { isBranchingEnabled } from "@/lib/chat/branching/flag";

/**
 * POST /api/chat/conversations/[id]/rewind
 * Body: { assistantMessageId: string }
 * Marks the (user, assistant) pair containing this assistant message as
 * rewound. Returns { rewoundUserContent } so the client can pre-fill the
 * composer for ⌘Z editing.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isBranchingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const assistantMessageId = body?.assistantMessageId;
  if (typeof assistantMessageId !== "string" || assistantMessageId.length === 0) {
    return NextResponse.json(
      { error: "assistantMessageId is required" },
      { status: 400 }
    );
  }

  const result = await markPairRewound(assistantMessageId);
  return NextResponse.json(result);
}
