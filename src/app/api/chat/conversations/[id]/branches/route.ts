import { NextRequest, NextResponse } from "next/server";
import { getConversation, getConversationFamily } from "@/lib/data/chat";
import { isBranchingEnabled } from "@/lib/chat/branching/flag";

/**
 * GET /api/chat/conversations/[id]/branches
 * Returns { family: ConversationRow[] } — every conversation in the same
 * branching tree, rooted at the topmost ancestor. Used by the tree dialog.
 *
 * Returns 404 when:
 * - The branching flag is off (feature is invisible to clients)
 * - The conversation does not exist
 */
export async function GET(
  _req: NextRequest,
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

  const family = await getConversationFamily(id);
  return NextResponse.json({ family });
}
