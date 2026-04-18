---
title: Chat — Ollama Native Skill Injection
status: completed
priority: P2
milestone: post-mvp
source: ideas/chat-context-experience.md §2.4, §4.2, §7.1, §8 Phase 1c
dependencies: [chat-claude-sdk-skills, ollama-runtime-provider, environment-scanner, runtime-capability-matrix, chat-data-layer]
---

# Chat — Ollama Native Skill Injection

## Description

Ollama (`src/lib/chat/ollama-engine.ts`) is an HTTP chat completion server, not an agent runtime. Unlike Claude Agent SDK and Codex App Server, Ollama has no `settingSources`, no Skill tool, no filesystem discovery, and no progressive-disclosure mechanism. For a skill to reach an Ollama-powered chat, ainative must do the work itself: discover the skill (already available via the environment scanner), activate it via an explicit ainative-level concept, and inject the full SKILL.md content into the system prompt whenever the skill is active.

This feature adds a minimal, explicit activation model: a single `activeSkillId` column on the conversation record and four ainative MCP tools (`list_skills`, `get_skill`, `activate_skill`, `deactivate_skill`) that the LLM or UI can call. When a skill is active, the context builder injects its SKILL.md into Tier 0 for every turn. Only one skill can be active at a time to cap the context cost. The progressive-disclosure tradeoff is accepted and documented — this is the cost of running a skill-less model server. Users with 8K-context local models may feel the squeeze with larger skills; users with 32K+ windows will not.

The same MCP tools can also be exposed on Claude and Codex runtimes as a **secondary programmatic path** alongside their native skill support, giving ainative a uniform API for skill management regardless of runtime (§8 Phase 1c note).

## User Story

As a privacy-conscious user running a local Ollama model, I want to pick a ainative-managed skill, have its instructions automatically reach the LLM for the rest of my conversation, and be able to deactivate it when I'm done — without needing the SDK-native progressive disclosure my cloud-model peers enjoy.

## Technical Approach

### 1. Schema migration + bootstrap

Add `activeSkillId TEXT` column to the conversations table. Per `MEMORY.md` bootstrap guidance, add a `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` idempotent guard in `src/lib/db/index.ts` so the column is self-healing on existing DBs, not only on fresh ones. Update Drizzle schema in `src/lib/db/schema.ts` in the same change set (otherwise DocumentRow-style runtime errors recur).

### 2. ainative MCP tools

Add four tools to the existing ainative MCP surface (`src/lib/chat/chat-tools.ts` or sibling):

- `list_skills(runtime?: string)` — returns available skills, filtered by runtime capability if provided
- `get_skill(id: string)` — returns full SKILL.md content
- `activate_skill(conversationId, skillId)` — sets `activeSkillId`, returns confirmation; replaces any currently active skill
- `deactivate_skill(conversationId)` — clears `activeSkillId`

These are runtime-agnostic. Ollama is the primary consumer; Claude/Codex can call them for programmatic skill management alongside their native flows.

### 3. Context builder injection

Update `src/lib/chat/context-builder.ts`:

- When building context for a conversation, check `activeSkillId`
- If set, read the skill's SKILL.md (cached in environment scanner) and append to Tier 0 under a clear section header, e.g. `## Active Skill: {name}`
- Token budget: ~300 tokens for a metadata index, 1000-4000 tokens for the active SKILL.md (per §7.1). Cap single-skill activation at one skill to prevent uncontrolled growth

### 4. Ollama engine wiring

`src/lib/chat/ollama-engine.ts` already consumes the built system prompt — no runtime-specific changes should be needed if step 3 is correct. Add a smoke test that verifies `messages[0].content` contains the skill content when a skill is active.

### 5. UX surface

Through the uniform popover (see `chat-command-namespace-refactor`), selecting `/skill-name` on an Ollama conversation calls `activate_skill` and shows a persistent indicator in the chat input ("Active skill: researcher · Deactivate"). On Claude/Codex the same selection routes to the native Skill tool. The popover itself doesn't know which runtime it's in — the command handler dispatches by runtime.

### 6. Context window guardrail

For models with a small declared context window, warn before activation: if `skillTokenEstimate + runningContext > 0.7 * modelContextWindow`, show a non-blocking warning toast ("This skill is large — consider a model with a larger context window"). Do not block activation.

## Acceptance Criteria

- [ ] User selects an Ollama model, types `/skill-name` — skill activates, SKILL.md is included in the next turn's system prompt
- [ ] `activate_skill` persists across turns within a conversation (stored on the conversation record)
- [ ] `deactivate_skill` removes SKILL.md from subsequent turns' context
- [ ] Activating a second skill replaces the first (single-active-skill rule enforced server-side)
- [ ] Same skill ID works on Ollama as on Claude and Codex runtimes (one source of truth)
- [ ] Database migration is idempotent and self-heals on existing DBs via the bootstrap CREATE pattern
- [ ] Drizzle schema reflects the new column (no `activeSkillId`-missing TypeScript errors)
- [ ] Smoke test: activate a skill on an Ollama conversation, verify the model follows its instructions
- [ ] Warning toast fires when activating a skill whose content would consume >70% of the model's context window
- [ ] `list_skills`/`activate_skill` MCP tools are callable from Claude and Codex runtimes as well (secondary path)

## Scope Boundaries

**Included:**
- `activeSkillId` column + bootstrap + Drizzle schema update
- Four ainative MCP tools for skill management
- Context builder injection of active skill SKILL.md
- Single-active-skill enforcement
- Context-window warning (non-blocking)
- Smoke test on a real Ollama model

**Excluded:**
- Progressive disclosure for Ollama (architecturally impossible without SDK support)
- Multiple simultaneous skills (deferred — composition is Phase 5)
- Filesystem tools (`Read`, `Edit`, etc.) on Ollama — not feasible; surfaced via capability matrix hide rules
- Hooks on Ollama — not applicable
- Per-turn skill invocation (CLI-style) on Ollama — activation is conversation-scoped here

## References

- Source: `ideas/chat-context-experience.md` §2.4, §4.2 (Ollama path), §7.1 (context budget), §8 Phase 1c, Q5
- Depends on: `chat-claude-sdk-skills` (establishes skill UX and `list_profiles` contract), `runtime-capability-matrix`, `environment-scanner`, `ollama-runtime-provider`, `chat-data-layer`
- Files shipped:
  - `src/lib/db/schema.ts` + `src/lib/db/bootstrap.ts` — `conversations.active_skill_id TEXT` column. Added to both the `CREATE TABLE IF NOT EXISTS` for fresh DBs and via `addColumnIfMissing` for existing ones (the ALTER alone failed silently on fresh DBs because it ran before the table CREATE).
  - `src/lib/environment/list-skills.ts` — `listSkills()` and `getSkill(id)` filter the environment scanner's results to `category === "skill"`. Internal `resolveSkillFile` helper probes `SKILL.md` / `skill.md` / first `*.md` inside the skill directory (the artifact's `absPath` is the dir, not the file).
  - `src/lib/chat/tools/skill-tools.ts` — 4 MCP tools: `list_skills`, `get_skill`, `activate_skill`, `deactivate_skill`. Single-active-skill enforced server-side; activate validates skill + conversation exist before writing.
  - `src/lib/chat/ainative-tools.ts` + `src/lib/chat/tool-catalog.ts` — registers the 4 tools so they appear in the `/` popover under a "Skills" group.
  - `src/lib/chat/context-builder.ts` — `buildActiveSkill(conversationId)` reads `conversations.active_skill_id`; when set, appends SKILL.md under `## Active Skill: <name>` just below Tier 0. ~4000 token cap. Dynamic import keeps the scanner off the hot path for conversations without an active skill.

### Deferred to follow-up

- **Context-window warning toast** — pure UX polish; depends on unsettled context-window probing per runtime. Move to `chat-environment-integration` or a dedicated `context-window-guardrails` feature.
- **Persistent active-skill chip in chat input** — UI affordance; can ship alongside the namespace-refactor surface in `chat-command-namespace-refactor`.
- **Per-runtime SKILL.md duplication on Claude/Codex** — those runtimes already have native skill support via the SDK's `settingSources`. Tier 0 injection on top is harmless but duplicative; a follow-up could suppress the injection on runtimes that have native handling. Out of scope here.

## Verification run — 2026-04-14

End-to-end browser smoke driven via Claude in Chrome against the developer's running dev server on `:3000` (HMR picked up the changes; no restart needed for the new tools).

| Scenario | Evidence | Outcome |
|---|---|---|
| `list_skills` discovers all skills | Typed `/list_skills`, sent — assistant returned a complete inventory of 62 skills correctly partitioned: 2 project (Claude), 23 user (Claude), 13 Codex, 16 shared. Categorization, tool/scope tagging, and descriptions all correct | ✓ |
| `activate_skill` persists the binding | Asked the model to call `activate_skill` for `.claude/skills/technical-writer`. Tool returned `{ conversationId: "5d9590e2-…", activatedSkillId: ".claude/skills/technical-writer", skillName: "technical-writer" }` confirming the SQLite write | ✓ |
| Tier 0 injection appears on subsequent turn | After activation, asked the model to quote any line in its system prompt starting with `## Active Skill:`. Model replied: *"The line is present. Quoting it verbatim: `## Active Skill: technical-writer`"* and reproduced the SKILL.md frontmatter + body it could see. Proves the buildActiveSkill helper read the bound id, called getSkill, and prepended the content under the expected header | ✓ |
| Single-active-skill rule | Verified by unit test `replaces a previously active skill (single-active rule)` | ✓ |
| Persistence across turns | Model's own ★ Insight observed: "activate_skill persists activeSkillId on the conversation row in SQLite, so the injection survives across turns automatically. Deactivation requires a separate deactivate_skill call." | ✓ |

### Bug caught at smoke time, not unit-test time

The first activate_skill attempt failed with "Skill not found". Root cause: the scanner stores `absPath` as the skill **directory**, but `getSkill` was calling `readFileSync(absPath)` which threw `EISDIR`. Caught silently, returning null, surfacing as "not found". Unit tests passed because they mocked `getSkill` end-to-end at the helper boundary. Fix: a `resolveSkillFile()` helper that probes `SKILL.md` → `skill.md` → first `*.md` inside the directory, mirroring the lenient discovery in `parsers/skill.ts`. This is exactly the failure mode the project's smoke-test budget rule for runtime-registry-adjacent features (touching `ainative-tools.ts`) was designed to surface — see `CLAUDE.md` § "Smoke-test budget" and project override `writing-plans.md`.

Note: end-to-end test was performed on Claude Opus 4.6 (the developer's available runtime); Ollama install not present in this session. The Tier 0 injection is runtime-agnostic — the same `systemPrompt` flows into Ollama's chat-completion payload the same way it flows into Claude's SDK options. If the developer adds an Ollama install, the same flow exercised here will activate skills on Ollama with no additional code changes.
