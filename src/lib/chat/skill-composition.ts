/**
 * Shared composition service — single source of truth for activate_skill /
 * deactivate_skill logic, used by both the chat tool handler and the thin
 * HTTP routes (POST /api/chat/conversations/[id]/skills/activate|deactivate).
 *
 * The chat tool delegates here so the UI can reach the same behaviour over
 * HTTP without going through MCP.
 *
 * See `features/chat-composition-ui-v1.md`.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { mergeActiveSkillIds } from "@/lib/chat/active-skills";
import type { SkillConflict } from "@/lib/chat/skill-conflict";

export type ActivateSkillResult =
  | {
      kind: "ok";
      activatedSkillId: string;
      activeSkillIds: string[];
      skillName: string;
      note?: string;
    }
  | {
      kind: "conflicts";
      activeSkillIds: string[];
      conflicts: SkillConflict[];
      hint: string;
    }
  | { kind: "error"; message: string };

export type DeactivateSkillResult =
  | { kind: "ok"; previousSkillId: string | null }
  | { kind: "error"; message: string };

/**
 * Activate a skill on a conversation, respecting runtime composition limits.
 *
 * @param conversationId  Target conversation.
 * @param skillId         Opaque skill id from list_skills.
 * @param mode            "replace" (default) clears prior active skills; "add"
 *                        appends — runtime must support composition.
 * @param force           When mode="add", skip conflict heuristic warnings.
 */
export async function activateSkill(args: {
  conversationId: string;
  skillId: string;
  mode?: "replace" | "add";
  force?: boolean;
}): Promise<ActivateSkillResult> {
  const { conversationId, skillId, mode = "replace", force = false } = args;

  try {
    const { getSkill } = await import("@/lib/environment/list-skills");
    const skill = getSkill(skillId);
    if (!skill) return { kind: "error", message: `Skill not found: ${skillId}` };

    const existing = await db
      .select({
        id: conversations.id,
        activeSkillId: conversations.activeSkillId,
        activeSkillIds: conversations.activeSkillIds,
        runtimeId: conversations.runtimeId,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!existing) {
      return { kind: "error", message: `Conversation not found: ${conversationId}` };
    }

    if (mode === "add") {
      const { getRuntimeFeatures } = await import("@/lib/agents/runtime/catalog");
      let features;
      try {
        features = getRuntimeFeatures(
          existing.runtimeId as Parameters<typeof getRuntimeFeatures>[0]
        );
      } catch {
        return {
          kind: "error",
          message: `Unknown runtime '${existing.runtimeId ?? "(none)"}' — cannot determine composition support`,
        };
      }

      if (!features.supportsSkillComposition) {
        return {
          kind: "error",
          message: `Runtime '${existing.runtimeId}' does not support skill composition — switch to a Claude/Codex/direct runtime to compose skills`,
        };
      }

      const currentIds = mergeActiveSkillIds(existing.activeSkillId, existing.activeSkillIds);

      if (currentIds.includes(skillId)) {
        return {
          kind: "ok",
          activatedSkillId: skillId,
          activeSkillIds: currentIds,
          skillName: skill.name,
          note: "skill already active",
        };
      }

      if (currentIds.length >= features.maxActiveSkills) {
        return {
          kind: "error",
          message: `Max active skills (${features.maxActiveSkills}) reached on '${existing.runtimeId}' — deactivate one first`,
        };
      }

      if (!force && currentIds.length > 0) {
        const { detectSkillConflicts } = await import("@/lib/chat/skill-conflict");
        const allConflicts: SkillConflict[] = [];
        for (const otherId of currentIds) {
          const other = getSkill(otherId);
          if (!other) continue;
          const conflicts = detectSkillConflicts(
            { id: skill.id, name: skill.name, content: skill.content },
            { id: other.id, name: other.name, content: other.content }
          );
          allConflicts.push(...conflicts);
        }
        if (allConflicts.length > 0) {
          return {
            kind: "conflicts",
            activeSkillIds: currentIds,
            conflicts: allConflicts,
            hint: "Re-call with force=true to add anyway",
          };
        }
      }

      // Append: store ALL composed IDs in the new column. Keep legacy
      // activeSkillId as-is so single-skill read paths still work.
      const newComposed = [...(existing.activeSkillIds ?? []), skillId];
      await db
        .update(conversations)
        .set({ activeSkillIds: newComposed, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      return {
        kind: "ok",
        activatedSkillId: skillId,
        activeSkillIds: mergeActiveSkillIds(existing.activeSkillId, newComposed),
        skillName: skill.name,
      };
    }

    // mode === "replace" (legacy / default)
    await db
      .update(conversations)
      .set({
        activeSkillId: skillId,
        activeSkillIds: [],
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return {
      kind: "ok",
      activatedSkillId: skillId,
      activeSkillIds: [skillId],
      skillName: skill.name,
    };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : "activate_skill failed",
    };
  }
}

/**
 * Clear the active skill (and composed skills) on a conversation.
 */
export async function deactivateSkill(args: {
  conversationId: string;
}): Promise<DeactivateSkillResult> {
  const { conversationId } = args;
  try {
    const existing = await db
      .select({
        id: conversations.id,
        activeSkillId: conversations.activeSkillId,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!existing) {
      return { kind: "error", message: `Conversation not found: ${conversationId}` };
    }

    await db
      .update(conversations)
      .set({ activeSkillId: null, activeSkillIds: [], updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return { kind: "ok", previousSkillId: existing.activeSkillId ?? null };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : "deactivate_skill failed",
    };
  }
}
