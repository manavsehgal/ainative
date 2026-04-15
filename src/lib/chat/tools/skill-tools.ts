import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { defineTool } from "../tool-registry";
import { ok, err, type ToolContext } from "./helpers";

/**
 * Stagent MCP tools for conversation-scoped skill management.
 *
 * Primary consumer: Ollama — the HTTP chat-completion API has no native
 * concept of skills, so Stagent takes over: activate a skill (persist to
 * conversations.active_skill_id) → context builder injects its SKILL.md
 * into Tier 0 of every subsequent turn.
 *
 * Secondary consumer: Claude and Codex runtimes may also call these tools
 * for a programmatic skill-activation path alongside their native Skill
 * handling. The tools themselves are runtime-agnostic — they just bind
 * skill IDs to conversation rows.
 *
 * See `features/chat-ollama-native-skills.md`.
 */

/**
 * Merge legacy `active_skill_id` (single) with the new `active_skill_ids`
 * JSON array, dedupe, and return the canonical "currently active skills"
 * list. Order: legacy first (preserves prior behavior for read paths),
 * then composed adds in insertion order.
 */
export function mergeActiveSkillIds(
  legacyId: string | null | undefined,
  composed: string[] | null | undefined
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (legacyId) { out.push(legacyId); seen.add(legacyId); }
  if (composed) {
    for (const id of composed) {
      if (id && !seen.has(id)) { out.push(id); seen.add(id); }
    }
  }
  return out;
}

export function skillTools(_ctx: ToolContext) {
  return [
    defineTool(
      "list_skills",
      "List all Stagent-discoverable skills across user (~/.claude, ~/.codex) and project (.claude, .agents) scopes. Returns id, name, tool persona, scope, and a short preview for each. Pass `enriched: true` for additional per-skill metadata (healthScore, syncStatus, linkedProfileId). Read-only.",
      {
        enriched: z
          .boolean()
          .optional()
          .describe(
            "When true, include healthScore ('healthy'|'stale'|'aging'|'unknown'), syncStatus ('synced'|'claude-only'|'codex-only'|'shared'), and linkedProfileId per skill."
          ),
      },
      async (args) => {
        try {
          if (args.enriched) {
            const { listSkillsEnriched } = await import("@/lib/environment/list-skills");
            const skills = listSkillsEnriched();
            return ok({
              count: skills.length,
              skills: skills.map((s) => ({
                id: s.id,
                name: s.name,
                tool: s.tool,
                scope: s.scope,
                preview: s.preview,
                sizeBytes: s.sizeBytes,
                healthScore: s.healthScore,
                syncStatus: s.syncStatus,
                linkedProfileId: s.linkedProfileId,
              })),
            });
          }
          const { listSkills } = await import("@/lib/environment/list-skills");
          const skills = listSkills();
          return ok({
            count: skills.length,
            skills: skills.map((s) => ({
              id: s.id,
              name: s.name,
              tool: s.tool,
              scope: s.scope,
              preview: s.preview,
              sizeBytes: s.sizeBytes,
            })),
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "list_skills failed");
        }
      }
    ),

    defineTool(
      "get_skill",
      "Return the full SKILL.md content plus metadata for a single skill, identified by the id returned from list_skills. Use this to preview a skill before activating it.",
      {
        id: z
          .string()
          .describe("Opaque skill ID (from list_skills). Typically the relative path."),
      },
      async (args) => {
        try {
          const { getSkill } = await import("@/lib/environment/list-skills");
          const skill = getSkill(args.id);
          if (!skill) return err(`Skill not found: ${args.id}`);
          return ok({
            id: skill.id,
            name: skill.name,
            tool: skill.tool,
            scope: skill.scope,
            sizeBytes: skill.sizeBytes,
            content: skill.content,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "get_skill failed");
        }
      }
    ),

    defineTool(
      "activate_skill",
      "Activate a skill on a conversation. While active, the skill's SKILL.md is injected into the system prompt on every subsequent turn. Default mode 'replace' clears any prior active skills and binds just this one. Pass mode='add' to compose multiple skills (gated by runtime — Ollama refuses; Claude/Codex/direct allow up to 3). Pass force=true to skip conflict warnings on add.",
      {
        conversationId: z.string().describe("ID of the conversation to bind the skill to."),
        skillId: z.string().describe("Opaque skill ID from list_skills (typically the relative path)."),
        mode: z
          .enum(["replace", "add"])
          .optional()
          .default("replace")
          .describe("'replace' (default) clears prior active skills; 'add' appends — runtime must support composition."),
        force: z
          .boolean()
          .optional()
          .default(false)
          .describe("When mode='add', skip the conflict heuristic check and add anyway."),
      },
      async (args) => {
        try {
          const { getSkill } = await import("@/lib/environment/list-skills");
          const skill = getSkill(args.skillId);
          if (!skill) return err(`Skill not found: ${args.skillId}`);

          const existing = await db
            .select({
              id: conversations.id,
              activeSkillId: conversations.activeSkillId,
              activeSkillIds: conversations.activeSkillIds,
              runtimeId: conversations.runtimeId,
            })
            .from(conversations)
            .where(eq(conversations.id, args.conversationId))
            .get();
          if (!existing) return err(`Conversation not found: ${args.conversationId}`);

          if (args.mode === "add") {
            const { getRuntimeFeatures } = await import("@/lib/agents/runtime/catalog");
            let features;
            try {
              features = getRuntimeFeatures(
                existing.runtimeId as Parameters<typeof getRuntimeFeatures>[0]
              );
            } catch {
              return err(`Unknown runtime '${existing.runtimeId ?? "(none)"}' — cannot determine composition support`);
            }
            if (!features.supportsSkillComposition) {
              return err(`Runtime '${existing.runtimeId}' does not support skill composition — switch to a Claude/Codex/direct runtime to compose skills`);
            }
            const currentIds = mergeActiveSkillIds(existing.activeSkillId, existing.activeSkillIds);
            if (currentIds.includes(args.skillId)) {
              return ok({
                conversationId: args.conversationId,
                activeSkillIds: currentIds,
                note: "skill already active",
              });
            }
            if (currentIds.length >= features.maxActiveSkills) {
              return err(`Max active skills (${features.maxActiveSkills}) reached on '${existing.runtimeId}' — deactivate one first`);
            }
            if (!args.force && currentIds.length > 0) {
              const { detectSkillConflicts } = await import("@/lib/chat/skill-conflict");
              const allConflicts = [];
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
                return ok({
                  conversationId: args.conversationId,
                  requiresConfirmation: true,
                  conflicts: allConflicts,
                  hint: "Re-call activate_skill with force=true to add anyway",
                });
              }
            }
            // Append: store ALL composed IDs in the new column. Keep legacy
            // activeSkillId as-is so single-skill read paths still work.
            const newComposed = [...(existing.activeSkillIds ?? []), args.skillId];
            await db
              .update(conversations)
              .set({ activeSkillIds: newComposed, updatedAt: new Date() })
              .where(eq(conversations.id, args.conversationId));
            return ok({
              conversationId: args.conversationId,
              activatedSkillId: args.skillId,
              activeSkillIds: mergeActiveSkillIds(existing.activeSkillId, newComposed),
              skillName: skill.name,
            });
          }

          // mode === "replace" (legacy / default)
          await db
            .update(conversations)
            .set({
              activeSkillId: args.skillId,
              activeSkillIds: [],
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, args.conversationId));

          return ok({
            conversationId: args.conversationId,
            activatedSkillId: args.skillId,
            skillName: skill.name,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "activate_skill failed");
        }
      }
    ),

    defineTool(
      "deactivate_skill",
      "Clear the active skill on a conversation. After this call, subsequent turns will not include any Stagent-injected SKILL.md in the system prompt.",
      {
        conversationId: z
          .string()
          .describe("ID of the conversation to clear the active skill from."),
      },
      async (args) => {
        try {
          const existing = await db
            .select({
              id: conversations.id,
              activeSkillId: conversations.activeSkillId,
            })
            .from(conversations)
            .where(eq(conversations.id, args.conversationId))
            .get();
          if (!existing) {
            return err(`Conversation not found: ${args.conversationId}`);
          }

          await db
            .update(conversations)
            .set({
              activeSkillId: null,
              activeSkillIds: [],
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, args.conversationId));

          return ok({
            conversationId: args.conversationId,
            previousSkillId: existing.activeSkillId ?? null,
            activeSkillId: null,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "deactivate_skill failed");
        }
      }
    ),
  ];
}
