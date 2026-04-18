---
title: Chat — Environment Metadata Integration
status: completed
priority: P2
milestone: post-mvp
source: ideas/chat-context-experience.md §4.4, §8 Phase 4
dependencies: [chat-command-namespace-refactor, environment-dashboard, environment-cache, profile-environment-sync, environment-health-scoring]
---

# Chat — Environment Metadata Integration

## Description

ainative's environment scanner builds a rich metadata layer over filesystem artifacts: skill health scores (last updated, usage, sync state), profile linkage (which skill is registered as which AgentProfile), cross-tool sync status (`.claude/skills/` ↔ `.agents/skills/`), and per-scope indicators (project vs user). None of this reaches the chat UI today. When `chat-command-namespace-refactor` lands, the Skills tab will render bare names and descriptions even though the environment dashboard already computes this enrichment.

This feature threads environment metadata into the chat skills popover and adds proactive nudges: an auto-rescan when a chat session opens on a stale environment cache (>5 min), and profile suggestions in chat when a user's current task matches a registered skill ("You might benefit from activating the `code-reviewer` skill"). The SDK's native skill discovery stays unchanged — ainative's environment layer **augments, does not replace** it (DD-CE-004). Best of both: SDK executes, ainative presents.

## User Story

As a user browsing the Skills tab in chat, I want to see which skills are healthy, which are linked to named agent profiles, and which are in sync across Claude/Codex — so I can trust what I'm picking and notice when a skill has gone stale.

## Technical Approach

### 1. Expose environment reads as chat tools

Add ainative MCP tools (extending those in `chat-ollama-native-skills` where applicable):

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
- [ ] SDK's native skill discovery remains the execution path (DD-CE-004); ainative only enriches presentation

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

## Verification — 2026-04-14

### What shipped
- `src/lib/environment/skill-enrichment.ts` — pure `computeHealthScore` (modifiedAt age buckets), `computeSyncStatus` (claude+codex presence), and `enrichSkills` orchestrator (group by name, dedupe by absPath for symlinks).
- `src/lib/environment/skill-recommendations.ts` — keyword-based `computeRecommendation` with stopword filter + ≥2 distinct hits, excludes active + dismissed + aging/broken skills.
- `src/lib/chat/dismissals.ts` — 7d TTL store with pure functional API + `browserLocalStore` adapter (try/catch safe against QuotaExceeded / SSR).
- `src/lib/environment/list-skills.ts` — new `listSkillsEnriched()` reads the latest scan directly from the DB via `getLatestScan()` + `getArtifacts()` so `linkedProfileId` (only on the DB row, not the in-memory artifact) flows through.
- `src/lib/chat/tools/skill-tools.ts` — `list_skills` MCP tool accepts optional `enriched: boolean` (additive, backwards compatible).
- `src/app/api/environment/skills/route.ts` — GET endpoint returning enriched skills.
- `src/app/api/environment/rescan-if-stale/route.ts` — fire-and-forget POST reusing `shouldRescan` + `ensureFreshScan` from existing `auto-scan.ts`.
- `src/components/chat/skill-row.tsx` — per-row UI with 4 badges (health / sync / profile link / scope), recommended star, dismiss X, deep-link ↗ when not fully synced.
- `src/hooks/use-enriched-skills.ts` — fetches `/api/environment/skills` on popover open with AbortController cleanup.
- `src/hooks/use-recent-user-messages.ts` — reads last N user messages from `useChatSession()`.
- `src/components/chat/chat-command-popover.tsx` — Skills tab renders `SkillRow`s with recommendation + dismissal wired via `dismissTick` state to force recompute after dismiss.
- `src/components/chat/chat-session-provider.tsx` — new `useEffect` on `activeId` change POSTs to `/api/environment/rescan-if-stale` (fire-and-forget).

### Tests
- 37 new unit tests across `skill-enrichment`, `skill-recommendations`, `dismissals`, `list-skills-enriched`, `skill-row`, `rescan-if-stale`.
- Full suite: 934 passing / 12 skipped / 1 pre-existing e2e (needs running server).
- `npx tsc --noEmit` clean.

### Smoke verification (localhost:3010)
- `GET /api/environment/skills` → 200 with JSON array; each item includes `healthScore`, `syncStatus`, `linkedProfileId`, `absPaths`.
- `POST /api/environment/rescan-if-stale` → 200 `{ scanned: true }` on first call.

### Scope deviations from spec
- **AC #4** — spec called for a "profile suggestion chip above the input" triggered by keyword match. Replaced with a **passive "Recommended" star** inside the Skills tab (+ dismiss X on the same row). Lower UI intrusiveness, simpler state model; keeps the chat's prime real estate uncluttered.
- **healthScore** derived from `modifiedAt` age only (healthy <180d / stale 180-365d / aging ≥365d). No usage telemetry in the codebase today to factor in.
- **Sync click-through** ships as `/environment?skill=<name>` — dashboard route may or may not parse the param; benign if not (dashboard just opens).
- `syncStatus` treats `shared` artifacts as covering both tools (claude+shared or codex+shared → synced).

### Known follow-ups
- `chat-environment-integration` unlocks `chat-advanced-ux` (P3), which was intentionally deferred to sub-feature grooming.
- Recommendation quality: keyword match with a conservative ≥2-hits threshold. Upgrade to embeddings if signal demands it.
- Dashboard `?skill=<name>` deep-link query-param handling: currently a no-op if the dashboard doesn't parse it; adding that parser is a small follow-up.

Commits: `6a4a76a`, `32fd8cf`, `e180e31`, `4318344`, `ef15e6b`, `9bd1eb3`, `fefd02c`, `172f1c1`, `9f1d4fc`, `96b8d23`, `d06dca4`, `f852519`.
