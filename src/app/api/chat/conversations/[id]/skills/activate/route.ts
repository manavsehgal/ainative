import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { activateSkill } from "@/lib/chat/skill-composition";

const ActivateBody = z.object({
  skillId: z.string().min(1),
  mode: z.enum(["replace", "add"]).optional().default("replace"),
  force: z.boolean().optional().default(false),
});

/**
 * POST /api/chat/conversations/[id]/skills/activate
 *
 * Thin HTTP wrapper over the activateSkill composition service so the chat UI
 * can reach composition logic without going through MCP.
 *
 * Returns:
 *   200  { activatedSkillId, activeSkillIds, skillName }             — success
 *   200  { requiresConfirmation: true, conflicts: [...] }            — needs confirm
 *   400  { error: string }                                           — validation / logic error
 *   404  { error: string }                                           — conversation not found
 *
 * See `features/chat-composition-ui-v1.md`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ActivateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const { skillId, mode, force } = parsed.data;
  const result = await activateSkill({ conversationId, skillId, mode, force });

  if (result.kind === "error") {
    const isNotFound =
      result.message.startsWith("Conversation not found") ||
      result.message.startsWith("Skill not found");
    return NextResponse.json(
      { error: result.message },
      { status: isNotFound ? 404 : 400 }
    );
  }

  if (result.kind === "conflicts") {
    return NextResponse.json({
      requiresConfirmation: true,
      conflicts: result.conflicts,
      hint: result.hint,
    });
  }

  // kind === "ok"
  return NextResponse.json({
    activatedSkillId: result.activatedSkillId,
    activeSkillIds: result.activeSkillIds,
    skillName: result.skillName,
    ...(result.note ? { note: result.note } : {}),
  });
}
