import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  restoreLatestRewoundPair,
} from "@/lib/data/chat";
import { isBranchingEnabled } from "@/lib/chat/branching/flag";

/**
 * POST /api/chat/conversations/[id]/redo
 * Restores the most recently rewound (user, assistant) pair in this
 * conversation. Returns { restoredMessageIds }.
 *
 * Idempotent: when nothing is rewound, returns 200 with an empty array.
 */
export async function POST(
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

  const result = await restoreLatestRewoundPair(id);
  return NextResponse.json(result);
}
