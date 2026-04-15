import { z } from "zod";
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

// `mergeActiveSkillIds` lives in `@/lib/chat/active-skills` so client code
// can import the pure helper without pulling this module's `db` import.
// Re-exported here for back-compat with existing callers (tests, etc.).
import { mergeActiveSkillIds } from "@/lib/chat/active-skills";
export { mergeActiveSkillIds };

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
        const { activateSkill } = await import("@/lib/chat/skill-composition");
        const result = await activateSkill({
          conversationId: args.conversationId,
          skillId: args.skillId,
          mode: args.mode,
          force: args.force,
        });

        if (result.kind === "error") return err(result.message);

        if (result.kind === "conflicts") {
          return ok({
            conversationId: args.conversationId,
            requiresConfirmation: true,
            conflicts: result.conflicts,
            hint: "Re-call activate_skill with force=true to add anyway",
          });
        }

        // kind === "ok"
        if (result.note === "skill already active") {
          return ok({
            conversationId: args.conversationId,
            activeSkillIds: result.activeSkillIds,
            note: result.note,
          });
        }

        return ok({
          conversationId: args.conversationId,
          activatedSkillId: result.activatedSkillId,
          activeSkillIds: result.activeSkillIds,
          skillName: result.skillName,
        });
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
        const { deactivateSkill } = await import("@/lib/chat/skill-composition");
        const result = await deactivateSkill({ conversationId: args.conversationId });

        if (result.kind === "error") return err(result.message);

        return ok({
          conversationId: args.conversationId,
          previousSkillId: result.previousSkillId,
          activeSkillId: null,
        });
      }
    ),
  ];
}
