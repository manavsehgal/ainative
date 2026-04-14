---
title: Chat — Environment Metadata Integration
status: planned
priority: P2
milestone: post-mvp
source: ideas/chat-context-experience.md §4.4, §8 Phase 4
dependencies: [chat-command-namespace-refactor, environment-dashboard, environment-cache, profile-environment-sync, environment-health-scoring]
---

# Chat — Environment Metadata Integration

## Description

Stagent's environment scanner builds a rich metadata layer over filesystem artifacts: skill health scores (last updated, usage, sync state), profile linkage (which skill is registered as which AgentProfile), cross-tool sync status (`.claude/skills/` ↔ `.agents/skills/`), and per-scope indicators (project vs user). None of this reaches the chat UI today. When `chat-command-namespace-refactor` lands, the Skills tab will render bare names and descriptions even though the environment dashboard already computes this enrichment.

This feature threads environment metadata into the chat skills popover and adds proactive nudges: an auto-rescan when a chat session opens on a stale environment cache (>5 min), and profile suggestions in chat when a user's current task matches a registered skill ("You might benefit from activating the `code-reviewer` skill"). The SDK's native skill discovery stays unchanged — Stagent's environment layer **augments, does not replace** it (DD-CE-004). Best of both: SDK executes, Stagent presents.

## User Story

As a user browsing the Skills tab in chat, I want to see which skills are healthy, which are linked to named agent profiles, and which are in sync across Claude/Codex — so I can trust what I'm picking and notice when a skill has gone stale.

## Technical Approach

### 1. Expose environment reads as chat tools

Add Stagent MCP tools (extending those in `chat-ollama-native-skills` where applicable):

- `list_skills(runtime?)` — enrich each row with `healthScore`, `linkedProfileId`, `syncStatus`, `scope` ("project" | "user")
- `get_skill(id)` — full SKILL.md plus the same metadata

These are runtime-agnostic; the popover consumer (refactored in Phase 3) renders the metadata via StatusChip.

### 2. Badge rendering in the Skills tab

The namespace-refactored `/` popover Skills tab (from `chat-command-namespace-refactor`) now consumes the enriched `list_skills` output:

- Health score → StatusChip (family: runtime — green "healthy" / amber "stale >6mo" / red "broken")
- Profile linkage → StatusChip (family: governance — "Registered as `code-reviewer`")
- Sync status → StatusChip (family: schedule — "Synced to Codex 2d ago")
- Scope → small label icon (project vs user)

### 3. Auto-rescan on chat session start

When the chat view loads a conversation, check environment cache age. If >5 min stale, trigger a background rescan (reuses existing `auto-environment-scan` logic). Non-blocking: the popover renders last-known state and updates in place when the scan completes.

### 4. Profile suggestions

A lightweight heuristic in `src/lib/chat/context-builder.ts` (or a sidecar) compares the user's recent messages against registered skill descriptions (simple keyword match, no embeddings required). If a strong match exists and the suggested skill is not already active/used, surface a dismissible suggestion chip above the input: "Activate `code-reviewer` for this conversation?" — one click activates it via the already-built MCP tools.

Guardrails:

- At most one suggestion per conversation per session
- Only suggest skills with `healthScore >= 0.7`
- Never suggest a skill the user has dismissed in the last 7 days (stored per conversation)

### 5. Cross-tool sync indicator

On runtimes that benefit from cross-tool sync (Claude uses `.claude/skills/`, Codex uses `.agents/skills/`), show a sync status chip with a click-through to the environment dashboard for manual resync. Reuse existing sync engine — no new infrastructure.

### 6. Performance

Environment metadata is already cached in the DB (5-min TTL per `environment-cache`). Chat popover queries the cache directly, no filesystem I/O per open. The rescan is async, debounced, and never blocks chat input.

## Acceptance Criteria

- [ ] `list_skills` returns enriched metadata (`healthScore`, `linkedProfileId`, `syncStatus`, `scope`) alongside name/description
- [ ] `/` popover Skills tab renders StatusChip badges for health, profile link, sync status, and scope
- [ ] Chat session start triggers a non-blocking rescan when environment cache is >5 min stale
- [ ] Profile suggestion chip appears when a strong keyword match exists, only for healthy skills, at most once per session
- [ ] Dismissed suggestions are not re-shown in the same conversation for 7 days
- [ ] Sync status chip click-through deep-links to the environment dashboard
- [ ] No filesystem I/O on popover open — all metadata served from cache
- [ ] SDK's native skill discovery remains the execution path (DD-CE-004); Stagent only enriches presentation

## Scope Boundaries

**Included:**
- Metadata enrichment in `list_skills`/`get_skill`
- Badge rendering hooks into the refactored Skills tab
- Auto-rescan on chat session start
- Heuristic profile suggestions with dismissal guardrails
- Sync status deep-link

**Excluded:**
- Editing skill metadata from chat (edit flows live in the environment dashboard)
- Embedding-based skill suggestions (keyword matching is enough for v1)
- Automatic skill activation — users still click
- Refactoring the environment scanner — read-only consumer

## References

- Source: `ideas/chat-context-experience.md` §4.4 (environment-aware skill discovery), §8 Phase 4, DD-CE-004 (augment-not-replace principle)
- Depends on: `chat-command-namespace-refactor` (Skills tab surface), `environment-dashboard`, `environment-cache`, `environment-health-scoring`, `profile-environment-sync`, `auto-environment-scan`
- Existing code: `src/lib/environment/scanner.ts`, `src/lib/environment/health-scoring.ts`, `src/lib/chat/context-builder.ts`, MEMORY.md badge variant conventions
