import { NextRequest, NextResponse } from "next/server";
import { deactivateSkill } from "@/lib/chat/skill-composition";

/**
 * POST /api/chat/conversations/[id]/skills/deactivate
 *
 * Clears both activeSkillId and activeSkillIds on the conversation row.
 * Idempotent — safe to call when no skill is active.
 *
 * Returns:
 *   200  { previousSkillId: string | null }  — success
 *   404  { error: string }                   — conversation not found
 *
 * See `features/chat-composition-ui-v1.md`.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  const result = await deactivateSkill({ conversationId });

  if (result.kind === "error") {
    const isNotFound = result.message.startsWith("Conversation not found");
    return NextResponse.json(
      { error: result.message },
      { status: isNotFound ? 404 : 400 }
    );
  }

  return NextResponse.json({ previousSkillId: result.previousSkillId });
}
