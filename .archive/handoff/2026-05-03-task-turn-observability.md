# Handoff: `task-turn-observability` shipped — 3 planned specs left, all P2/P3

**Created:** 2026-05-03 (build session — `task-turn-observability`)
**Status:** Working tree has uncommitted edits across spec, roadmap, changelog, MEMORY.md, schema.ts, bootstrap.ts, claude-agent.ts (+ new test), scheduler.ts, and HANDOFF.md (9 files). Ready to commit. Roadmap status now: 208 completed / 27 deferred / 3 planned / 4 in-progress / 5 non-spec docs.
**Predecessor:** previous handoff was the `workflow-learning-approval-reliability` ship verification (committed in `ac411cbc`).

---

## TL;DR for the next agent

1. **`task-turn-observability` was a real build session**, not a Ship Verification. Unlike the previous five sessions, every AC required actual work: schema columns added (`tasks.turnCount` + `tokenCount`), persistence wired in `claude-agent.ts` result-frame handler, scheduler refactored to prefer the new persisted value, metric definition documented in spec + MEMORY.md, new unit test pinning `turnCount > 0 && tokenCount > 0`. The bidirectional-staleness pattern *did not* hit this time — but verifying first was still cheap (a single grep round confirmed real gaps).

2. **Critical metric clarification codified in MEMORY.md.** The persisted `turnCount` counts streamed `assistant`-role frames, not SDK reasoning rounds. Production values run hundreds-to-thousands per autonomous-loop firing because each tool-using round emits multiple assistant frames (thinking + tool_use + final text). Operators reading dashboards must treat this as a stream-frame work-volume signal for relative comparison, *not* a budget unit comparable to `maxTurns`. This lesson lives in `MEMORY.md` "Architecture Notes" so future agents and operators don't repeat the spec author's misreading.

3. **No P1 left, no P2 left.** Truly-planned roster (after this session) is **3 specs**, all P2 or P3:

   | Spec | Priority | Notes |
   |---|---|---|
   | `onboarding-runtime-provider-choice` | P2 | Last remaining P2. |
   | `chat-conversation-branches` | P3 | Focused chat-runtime change. |
   | `composed-app-manifest-authoring-tools` | P3 | "Momentum" alternative across the last three handoffs. |

   **Recommended order:**
   - **30-min Ship Verification on `onboarding-runtime-provider-choice` first** — same playbook as the prior sessions. Per the bidirectional-staleness pattern (5 of 6 recent sessions hit it), grep for spec-referenced symbols before treating as buildable.
   - **Then either P3** based on momentum: `composed-app-manifest-authoring-tools` is the bigger one and has been deferred multiple times; `chat-conversation-branches` is a more focused chat-runtime change.

4. **Outstanding gap-closure work (not blocking, trackable):**
   - `direct-runtime-prompt-caching` (in-progress) — needs ledger persistence + cost-dashboard cache hit-rate UI + Batch API for meta-completions.
   - `direct-runtime-advanced-capabilities` (in-progress) — context compaction, `/v1/models` discovery, and Anthropic server-tool toggles.
   - `upgrade-session` (in-progress) — dedicated session-sheet UI, upgrade history list, abort confirmation, dev-server restart banner.
   - `composed-app-auto-inference-hardening` (in-progress) — 4 deferred ACs gated on first reported kit misfire.

5. **CLAUDE.md runtime-registry smoke gate not triggered this session** — the changes added new fields to existing `db.update().set()` calls and a new `select` field, with no imports added/removed/reshaped. The smoke gate's wording is precise about that ("adds, removes, or reshapes an import"); pure runtime-path edits without import changes don't fire it. Useful precedent for future sessions: editing claude-agent.ts is allowed at moderate scope without the smoke gate, but any `import` line change crosses the threshold.

---

## What landed this session

Uncommitted in working tree (9 files):

- `features/task-turn-observability.md` — `status: planned` → `status: completed`, `shipped-date: 2026-05-03`. All 8 ACs checked with file:line evidence + Metric Definition section + Verification section + 3 Design Decisions added (stream-frame counter rationale; tokenCount denormalization rationale; scheduler fallback rationale).
- `features/roadmap.md` — `task-turn-observability` row flipped `planned` → `completed`.
- `features/changelog.md` — prepended top-level entry with implementation summary, file:line evidence, verification numbers, and Design Decision summaries.
- `MEMORY.md` — added the "tasks.turnCount counts streamed assistant frames, NOT SDK reasoning rounds" entry under "Architecture Notes". Spec AC #1 satisfied.
- `src/lib/db/schema.ts` — added `turnCount: integer("turn_count")` and `tokenCount: integer("token_count")` after `maxTurns` on the `tasks` table, with explanatory JSDoc.
- `src/lib/db/bootstrap.ts` — added `turn_count INTEGER, token_count INTEGER` to the CREATE TABLE block AND `addColumnIfMissing` ALTER calls. Per MEMORY.md "addColumnIfMissing runs BEFORE CREATE" rule.
- `src/lib/agents/claude-agent.ts` — extended the result-frame handler's `db.update(tasks).set(...)` call to write `turnCount` and `tokenCount: usageState.totalTokens ?? null`.
- `src/lib/agents/__tests__/claude-agent.test.ts` — new test "A2b: persists turnCount and tokenCount on the completion update" pins both fields. Required overriding the module-level `extractUsageSnapshot` mock per-test so the result frame's usage data flows into `usageState`.
- `src/lib/schedules/scheduler.ts` — `recordFiringMetrics` now reads `tasks.turnCount` first, falling back to `COUNT(*) FROM agentLogs` for pre-existing rows where the persisted value is null. Eliminates the schedule-vs-task aggregate inconsistency that motivated the spec.
- `HANDOFF.md` — this file.

### Net effect on roadmap

| Status | Before | After |
|---|---|---|
| completed | 207 | 208 |
| planned | 4 | 3 |

(in-progress, deferred, non-spec all unchanged. P1 planned: 0. P2 planned: 1.)

### Test surface verified

- `npx vitest run src/lib/agents/__tests__/claude-agent.test.ts src/lib/data/__tests__/clear.test.ts` — **41/41 pass** (1 new test).
- `npx vitest run src/lib/schedules` — **131/131 pass across 13 files** (no regressions from the scheduler refactor).
- `npx tsc --noEmit` — clean for all touched files.

---

## Patterns reinforced this session

- **Mock-at-the-outermost-boundary tradeoff in claude-agent.test.ts.** The module-level `vi.mock("@/lib/usage/ledger", ...)` returns `extractUsageSnapshot: () => ({})` so all existing tests run without real usage extraction. To assert `tokenCount > 0` in the new test, I had to override the mock implementation per-test (`vi.mocked(extractUsageSnapshot).mockImplementation(...)`). This works but it's a moderate complexity cost — a future cleanup could split the usage-mock into a more granular boundary so token assertions don't need per-test override.

- **Doubled CREATE+ALTER for new schema columns.** Per the MEMORY.md "Recurring Gotchas" entry, every new column added via `addColumnIfMissing` must also appear in the CREATE TABLE IF NOT EXISTS block — otherwise fresh DBs fail at first Drizzle insert. Followed that rule for both `turn_count` and `token_count`. Tests run against a fresh temp DB so they would have caught the failure mode if the rule had been missed.

- **Spec ACs called for "30-min Ship Verification" but the work was a build session.** The previous handoff flagged `task-turn-observability` as "30-min Ship Verification candidate" but verification took ~15 minutes and revealed real gaps. Time spent on verification first is *cheap* — even when it doesn't unlock a quick close-out, it prevents wasted scope. Confirmed this session: ~15 min verification + ~60 min build, vs. an estimated ~75 min if I'd skipped verification and started building immediately.

- **Metric definition belongs in MEMORY.md, not just the spec.** The Metric Definition section in `features/task-turn-observability.md` is the canonical home, but mirroring to `MEMORY.md` "Architecture Notes" means future agents reading the auto-memory will see the clarification before they ever open the spec. AC #1 explicitly required this mirroring — the spec author understood that misreading metric numbers is a recurring failure mode worth multiple memory write-paths.

---

## How to commit this session's work

```
git add features/task-turn-observability.md \
        features/roadmap.md \
        features/changelog.md \
        MEMORY.md \
        src/lib/db/schema.ts \
        src/lib/db/bootstrap.ts \
        src/lib/agents/claude-agent.ts \
        src/lib/agents/__tests__/claude-agent.test.ts \
        src/lib/schedules/scheduler.ts \
        HANDOFF.md
git commit -m "feat(observability): ship task-turn-observability (turnCount + tokenCount)"
```

Single commit captures the full close-out — schema + bootstrap + runtime persistence + scheduler consistency refactor + test + spec/roadmap/changelog/memory docs. Per CLAUDE.md commit style: `feat(observability)` is correct because the user-visible change is a new metric exposed via `get_task` / `list_tasks`.

---

*End of handoff. Next move: 30-min Ship Verification on `onboarding-runtime-provider-choice` (last P2), then either P3.*
