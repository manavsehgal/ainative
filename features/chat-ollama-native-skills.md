---
title: Chat — Ollama Native Skill Injection
status: planned
priority: P2
milestone: post-mvp
source: ideas/chat-context-experience.md §2.4, §4.2, §7.1, §8 Phase 1c
dependencies: [chat-claude-sdk-skills, ollama-runtime-provider, environment-scanner, runtime-capability-matrix, chat-data-layer]
---

# Chat — Ollama Native Skill Injection

## Description

Ollama (`src/lib/chat/ollama-engine.ts`) is an HTTP chat completion server, not an agent runtime. Unlike Claude Agent SDK and Codex App Server, Ollama has no `settingSources`, no Skill tool, no filesystem discovery, and no progressive-disclosure mechanism. For a skill to reach an Ollama-powered chat, Stagent must do the work itself: discover the skill (already available via the environment scanner), activate it via an explicit Stagent-level concept, and inject the full SKILL.md content into the system prompt whenever the skill is active.

This feature adds a minimal, explicit activation model: a single `activeSkillId` column on the conversation record and four Stagent MCP tools (`list_skills`, `get_skill`, `activate_skill`, `deactivate_skill`) that the LLM or UI can call. When a skill is active, the context builder injects its SKILL.md into Tier 0 for every turn. Only one skill can be active at a time to cap the context cost. The progressive-disclosure tradeoff is accepted and documented — this is the cost of running a skill-less model server. Users with 8K-context local models may feel the squeeze with larger skills; users with 32K+ windows will not.

The same MCP tools can also be exposed on Claude and Codex runtimes as a **secondary programmatic path** alongside their native skill support, giving Stagent a uniform API for skill management regardless of runtime (§8 Phase 1c note).

## User Story

As a privacy-conscious user running a local Ollama model, I want to pick a Stagent-managed skill, have its instructions automatically reach the LLM for the rest of my conversation, and be able to deactivate it when I'm done — without needing the SDK-native progressive disclosure my cloud-model peers enjoy.

## Technical Approach

### 1. Schema migration + bootstrap

Add `activeSkillId TEXT` column to the conversations table. Per `MEMORY.md` bootstrap guidance, add a `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` idempotent guard in `src/lib/db/index.ts` so the column is self-healing on existing DBs, not only on fresh ones. Update Drizzle schema in `src/lib/db/schema.ts` in the same change set (otherwise DocumentRow-style runtime errors recur).

### 2. Stagent MCP tools

Add four tools to the existing stagent MCP surface (`src/lib/chat/chat-tools.ts` or sibling):

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
- Four Stagent MCP tools for skill management
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
- Existing code: `src/lib/chat/ollama-engine.ts`, `src/lib/chat/context-builder.ts`, `src/lib/chat/chat-tools.ts`, `src/lib/db/schema.ts`, `src/lib/db/index.ts` (bootstrap)
- Memory: MEMORY.md "Keep `clear.ts` in sync when adding new DB tables" — also applies to new conversation columns referenced by clear logic
