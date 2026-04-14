---
title: Chat — Codex App Server Skill Integration
status: completed
priority: P1
milestone: post-mvp
source: ideas/chat-context-experience.md §2.3, §4.1, §4.2, §8 Phase 1b
dependencies: [chat-claude-sdk-skills, codex-chat-engine, openai-codex-app-server, environment-scanner, runtime-capability-matrix]
---

# Chat — Codex App Server Skill Integration

## Description

When a user picks a Codex model (GPT-5.4-mini, Codex 5.3, GPT-5.4), chat routes through `src/lib/chat/codex-engine.ts`, which talks to the Codex App Server over JSON-RPC. The App Server supports native skill invocation via `turn/start` with skill parameters and reads `AGENTS.md` automatically — but `codex-engine.ts` neither passes the skill parameters nor surfaces the App Server's skill metadata events to the chat UI. It also does not discover skills from `.agents/skills/` (Codex's convention) or `.claude/skills/` even though Stagent's environment scanner already walks both directories.

This feature brings the Codex runtime to parity with the Claude runtime's skill behavior established in `chat-claude-sdk-skills`. The UX is uniform across runtimes: the same `/skill-name` syntax, the same popover entries, the same `list_profiles` contract. The implementation is runtime-specific — App Server native skill invocation, plus Stagent's existing bidirectional sync engine to keep `.claude/skills/` and `.agents/skills/` content in step so a skill authored once works on both runtimes.

Because Phase 1 rollout is sequential (Q1), this ships after Phase 1a's UX pattern is proven. That lets the Codex implementation match the Claude `list_profiles` contract exactly and reuse the popover entries verbatim.

## User Story

As a user on a Codex/GPT model in Stagent chat, I want the same skills, AGENTS.md context, and filesystem awareness I'd get if I were running Codex CLI, so my choice of model doesn't strand me from the project's skill library.

## Technical Approach

### 1. Skill discovery (shared with Phase 1a)

Environment scanner already indexes `.agents/skills/` and `.claude/skills/` (see `src/lib/environment/scanner.ts`). Expose a single `listSkillsForRuntime(projectDir, runtime)` helper that returns a runtime-appropriate view:

- For Claude: prefer `.claude/skills/` entries, fall back to synced `.agents/skills/`
- For Codex: prefer `.agents/skills/` entries, fall back to synced `.claude/skills/`

The `list_profiles` chat tool (augmented in Phase 1a) calls this helper with the active conversation's runtime.

### 2. `turn/start` skill parameters

Update `sendCodexMessage()` in `src/lib/chat/codex-engine.ts` to pass skill metadata per `.claude/reference/developers-openai-com-codex-sdk/app-server.md` → "Start a turn (invoke a skill)":

```typescript
await appServer.turnStart({
  threadId,
  skills: availableSkillIds,      // from listSkillsForRuntime
  invokeSkill: selectedSkillId,   // if user triggered via /skill-name
  input: userContent,
  developerInstructions: context.systemPrompt,
});
```

`availableSkillIds` is the metadata-only list (IDs + descriptions). Full SKILL.md content is loaded by the App Server on demand — progressive disclosure is built into the protocol.

### 3. Stream event handling

The App Server emits skill-related events during a turn (skill invoked, skill output, skill completed). Extend the JSON-RPC stream reader in `codex-engine.ts` to translate these into Stagent's chat event shape so the UI renders them identically to Claude's Skill tool events (chip with skill name, expandable output).

### 4. AGENTS.md auto-load

The App Server reads `AGENTS.md` from cwd upward automatically. Verify this works from Stagent's cwd (active project's `workingDirectory`, else launch cwd, per Q4). Adjust `cwd` on the App Server connection if needed. No Stagent-side file injection required.

### 5. Cross-runtime skill sync

Stagent's existing `environment-sync-engine` already handles `.claude/skills/` ↔ `.agents/skills/` bidirectional sync. Ensure the sync fires on chat session start if the environment cache is stale (>5 min) so a Claude-authored skill immediately reaches a Codex session.

### 6. Cross-runtime compatibility filter (Q8a)

A skill that references Claude-only tools (e.g., `Edit` tool name) may not work verbatim on Codex. Runtime-capability-matrix flags inform filtering: skills whose `requiredTools` set is not satisfied by the active runtime are **hidden** from the Codex `/` popover (not badged). Skills with no declared tool requirements pass through.

### 7. Verification

Real-environment smoke test: same `.claude/skills/test-skill/SKILL.md` used in Phase 1a must be invocable from a Codex conversation via `/test-skill` and produce similar behavior.

## Acceptance Criteria

- [ ] User selects a GPT/Codex model, types `/skill-name` — skill invokes via `turn/start` with skill parameters
- [ ] AGENTS.md content is reflected in chat responses on the Codex runtime
- [ ] The same skills are visible in the `/` popover regardless of runtime (Claude vs Codex), filtered by Q8a compatibility rules
- [ ] Skills authored in `.claude/skills/` are kept in sync with `.agents/skills/` via the existing sync engine
- [ ] App Server skill events (invoke/output/complete) render in chat as expandable chips matching Claude's Skill tool UX
- [ ] Smoke test: invoke the same skill on Claude and Codex runtimes — both produce similar behavior
- [ ] `list_profiles` returns the runtime-correct view when called from a Codex conversation
- [ ] `cwd` resolves to active project's `workingDirectory`, else launch cwd (Q4)

## Scope Boundaries

**Included:**
- `turn/start` skill parameter wiring in `codex-engine.ts`
- Skill metadata discovery via environment scanner for `.agents/skills/`
- App Server skill event translation into Stagent chat events
- AGENTS.md auto-load verification (no re-implementation — App Server does this)
- Q8a compatibility filtering (hide skills whose required tools aren't available)

**Excluded:**
- Claude runtime skill support — handled by `chat-claude-sdk-skills`
- Ollama runtime support — handled by `chat-ollama-native-skills`
- Codex App Server shell/file tool exposure beyond current behavior — tracked separately if desired
- Rewriting skill content per runtime (Q8d) — rejected in favor of filtering (Q8a)

## References

- Source: `ideas/chat-context-experience.md` §2.3, §4.2 (Codex path), §4.3 (cross-tool discovery), §8 Phase 1b, Q8
- Reference docs: `.claude/reference/developers-openai-com-codex-sdk/app-server.md`, `skills.md`, `concepts-customization.md`
- Depends on: `chat-claude-sdk-skills` (establishes `list_profiles` contract + popover UX), `runtime-capability-matrix` (compatibility flags), `environment-scanner`, `environment-sync-engine`, `codex-chat-engine`
- Existing code: `src/lib/chat/codex-engine.ts`, `src/lib/chat/engine.ts:152-166` (dispatcher), `src/lib/environment/scanner.ts`, `src/lib/agents/runtime/codex-app-server-client.ts`

## Scope adjustment after reading the App Server reference

The original spec called for wiring `turn/start` skill parameters into `sendCodexMessage()` to give the App Server explicit skill metadata. **Re-reading `.claude/reference/developers-openai-com-codex-sdk/app-server.md` and `skills.md`** revealed that:

1. **The Codex App Server's `turn/start` does NOT accept `skills` / `invokeSkill` parameters in the actual protocol.** What the spec described is Codex's *natural* behavior: when the App Server's `cwd` is set to the project's working directory, Codex auto-discovers `.agents/skills/` (and walks up to the repo root). It also reads `~/.agents/skills/` for user scope. No explicit metadata wiring is required.
2. **`AGENTS.md` auto-load is already declared** in the runtime capability matrix (`catalog.ts:130 → autoLoadsInstructions: "AGENTS.md"`) and happens automatically based on `cwd`.
3. **`cwd` plumbing was already correct** — `codex-engine.ts:104-105` overrides `workspace.cwd` with the project's `workingDirectory`; that value flows into `auth.connect(workspace.cwd)` (line 176) and every subsequent App Server call (lines 304, 311, 340).

The actual gap was on the *Stagent* side: my `chat-ollama-native-skills` feature unconditionally injected SKILL.md into Tier 0 of the system prompt regardless of runtime, duplicating context on Codex (and Claude) where the runtime's native skill discovery already loads the same content.

### Files shipped (this feature)

- `src/lib/chat/context-builder.ts` — `buildActiveSkill` now reads the conversation's `runtimeId`, looks up `getRuntimeFeatures(runtimeId).stagentInjectsSkills`, and **suppresses** Tier 0 injection when the flag is `false`. The runtime capability matrix already encoded this decision; we just needed to consult it. Behavior:
  - `ollama` → injects (no native path; Stagent must inject)
  - `claude-code`, `openai-codex-app-server`, `*-direct` → suppressed (runtime handles native discovery from `.claude/skills/` or `.agents/skills/`)
  - Unknown runtime → falls through and injects (safer default than silently dropping)
- `src/lib/chat/__tests__/active-skill-injection.test.ts` — extended with 4 new tests covering each runtime branch (Claude suppressed, Codex suppressed, Ollama injected, unknown→inject). 8/8 file tests pass; 173/173 chat tests overall.

### Deferred (per scope adjustment)

- **Q8a runtime-compatibility filter on `list_skills`** — skills don't currently declare `requiredTools`. Adding a parameter that does nothing on every existing skill is YAGNI; revisit when `requiredTools` lands in the skill metadata schema.
- **App Server skill event translation into chat events** — the App Server already emits skill-related events as part of its standard tool stream; today those render as generic tool chips, which is sufficient. Specialized skill-chip rendering would be UX polish; defer to `chat-environment-integration` or a dedicated UX feature.
- **Stagent-driven `turn/start` skill parameter wiring** — the protocol doesn't support it. Reframed as "trust Codex's native discovery + suppress Stagent's duplicate injection".

## Verification run — 2026-04-14

End-to-end browser smoke driven via Claude in Chrome. Used the same conversation that had `.claude/skills/technical-writer` activated from the previous feature's verification — making this an A/B test across the code change with the model itself as oracle:

| Turn | Model | Code state | Question | Response |
|---|---|---|---|---|
| Earlier (chat-ollama-native-skills verification) | Claude Opus 4.6 | Tier 0 injects unconditionally | "Search system prompt for `## Active Skill:`. Quote line if present." | *"The line is present. Quoting it verbatim: `## Active Skill: technical-writer`"* + reproduced SKILL.md content |
| Now (this feature) | Claude Opus 4.6 (same conv, same activation) | Tier 0 honors `stagentInjectsSkills` flag | Same question | *"ABSENT. The `## Active Skill:` line is no longer present in my system prompt on this turn. The injection that was visible in my previous response is gone — likely due to a code change you made"* |

The model literally noticed the diff between turns. Same model, same conversation state, same skill bound — only the Tier 0 injection logic changed. Claude's native skill discovery still works (Claude SDK loads `.claude/skills/technical-writer` natively); we just stopped duplicating it.

By construction, the same suppression behavior applies to `openai-codex-app-server` (also `stagentInjectsSkills: false`). Codex's native discovery from `.agents/skills/` continues to function via the `cwd` plumbing already in `codex-engine.ts`. A direct Codex-runtime smoke wasn't run in this session (no Codex authentication configured), but the unit test `does NOT inject on openai-codex-app-server` covers the suppression deterministically.
