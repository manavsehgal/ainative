/**
 * Pure helper for combining the legacy `conversations.active_skill_id`
 * column with the new `conversations.active_skill_ids` JSON array
 * (`features/chat-skill-composition.md`).
 *
 * Lives in its own module (no DB imports) so client components can use
 * it without pulling server-only code into the bundle. The original
 * lived alongside the chat-tool definition in `tools/skill-tools.ts`,
 * which can only run server-side.
 */

export function mergeActiveSkillIds(
  legacyId: string | null | undefined,
  composed: string[] | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (legacyId) {
    out.push(legacyId);
    seen.add(legacyId);
  }
  if (composed) {
    for (const id of composed) {
      if (id && !seen.has(id)) {
        out.push(id);
        seen.add(id);
      }
    }
  }
  return out;
}
