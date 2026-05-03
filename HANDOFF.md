# Handoff: `schedule-collision-prevention` ship-verified — pick the next P1 planned feature

**Created:** 2026-05-03 (continuation session — Ship Verification on `schedule-collision-prevention`)
**Status:** Working tree has uncommitted edits (spec, roadmap, changelog, route.ts, HANDOFF.md). Ready to commit. Roadmap status now: 205 completed / 27 deferred / 6 planned / 4 in-progress / 5 non-spec docs.
**Predecessor:** `.archive/handoff/2026-05-03-roadmap-drift-hardening-shipped-handoff.md`

---

## TL;DR for the next agent

1. **`schedule-collision-prevention` was a textbook bidirectional spec-staleness case.** Frontmatter said `planned`; in reality all 4 phases (queue drain, auto-stagger, turn-budget header, health metrics + auto-pause) had shipped over prior sessions. Ship Verification took ~30 minutes, closed one real gap, and added the operational lessons learned (heartbeat exclusion + split auto-pause thresholds) as Design Decisions in the spec body. **Pattern continues:** always grep for the spec's referenced symbols (function names, schema columns, table names) before treating any `status: planned` feature as buildable.

2. **Real gap closed mid-session.** The REST API POST `/api/schedules/route.ts` only emitted a `checkCollision` *warning* — it never applied `computeStaggeredCron`. The chat tool path did. Both `schedule-create-sheet.tsx` and `schedule-create-dialog.tsx` POST to the REST API, so the UI form path was failing the AC silently. Fix: 25-line block in the POST handler mirroring the chat-tool pattern. Verified by `npx tsc --noEmit` clean and 162 schedule-adjacent tests passing.

3. **Pick the next feature.** Truly-planned roster (after this session) is now **6 specs**:

   | Spec | Priority | Notes |
   |---|---|---|
   | `chat-conversation-branches` | P3 | |
   | `composed-app-manifest-authoring-tools` | P3 | Prior session's recommended next-up; deps in known states. |
   | `enrichment-planner-test-hardening` | P2 | Possibly already shipped — 7 tests for 6 ACs. **30-min Ship Verification candidate.** |
   | `onboarding-runtime-provider-choice` | P2 | |
   | `task-turn-observability` | P2 | Confirmed-planned by prior handoff (the `turnCount` column is on `scheduleFiringMetrics`, not `tasks`). |
   | `workflow-learning-approval-reliability` | **P1** | Highest priority. Touches `claude-agent.ts` + `learning-session.ts` + Inbox UI. |

   **Recommended order:**
   - **First, run a 30-min Ship Verification on `enrichment-planner-test-hardening`** — if it ship-verifies, you reduce planned count to 5 with minimal effort. If it has real gaps, escalate to a build session.
   - **Then start `workflow-learning-approval-reliability`** — only remaining P1 planned. Has prior-incident evidence (`.archive/handoff/table-enrich-context-approval-noise.md`). Note: this feature touches `claude-agent.ts` which triggers the **CLAUDE.md runtime-registry smoke-test budget** — plan an end-to-end smoke run under `npm run dev`, not just unit tests.
   - **Or pick `composed-app-manifest-authoring-tools`** for momentum continuation if you'd rather not deal with the runtime-registry smoke gate.

4. **Outstanding gap-closure work (not blocking, trackable):**
   - `direct-runtime-prompt-caching` (in-progress) — needs ledger persistence + cost-dashboard cache hit-rate UI + Batch API for meta-completions. Concrete and small.
   - `direct-runtime-advanced-capabilities` (in-progress) — context compaction, `/v1/models` discovery, and Anthropic server-tool toggles.
   - `upgrade-session` (in-progress) — dedicated session-sheet UI, upgrade history list, abort confirmation, dev-server restart banner.
   - `composed-app-auto-inference-hardening` (in-progress) — 4 deferred ACs gated on first reported kit misfire.

---

## What landed this session

Uncommitted in working tree (5 files):

- `features/schedule-collision-prevention.md` — `status: planned` → `status: completed`, `shipped-date: 2026-05-03`. All 8 ACs checked off with file:line evidence. Two new Design Decisions sections added: heartbeat exclusion rationale + split auto-pause threshold rationale.
- `features/roadmap.md` — added `schedule-collision-prevention` row in **Platform Hardening** section (P1 / completed / deps: scheduled-prompt-loops, heartbeat-scheduler).
- `features/changelog.md` — prepended a top-level entry summarizing the Ship Verification, the gap closed in `route.ts`, and the positive drift codified in the spec.
- `src/app/api/schedules/route.ts` — added `computeStaggeredCron` import + ~25-line stagger block before `db.insert`. Drizzle `and`/`eq`/`desc` consolidated into a single import.
- `HANDOFF.md` — this file. Prior handoff archived at `.archive/handoff/2026-05-03-roadmap-drift-hardening-shipped-handoff.md`.

### Net effect on roadmap

| Status | Before | After |
|---|---|---|
| completed | 204 | 205 |
| planned | 7 | 6 |

(in-progress, deferred, non-spec all unchanged.)

---

## Patterns reinforced this session

- **Bidirectional spec staleness — third consecutive session catching it.** This time on a P1 hardening feature with very specific field-data evidence. The lesson is now well-established in the codebase: **always grep for the spec's referenced symbols (`drainQueue`, `computeStaggeredCron`, `recordFiringMetrics`, `scheduleFiringMetrics`) before treating any `planned` feature as greenfield.** The grooming process needs to bake this in — a `status: planned` feature with N referenced symbols all present in code is almost certainly already shipped.

- **Two creation paths, one AC.** When a feature affects schedule creation, both the chat tool (`schedule-tools.ts`) and the REST API (`/api/schedules/route.ts`) must satisfy the same AC. Today there are exactly two paths, so duplication is acceptable per CLAUDE.md "DRY with judgment — extract on third use." If a third creation path ever lands (workflow blueprint instantiation, ainative-app composition), extract the auto-stagger block into a shared helper.

- **Positive drift is worth codifying in the spec.** The implementation introduced two refinements not in the original spec: (a) heartbeat path's exclusion from turn-budget header (different prompt structure), (b) split `failureStreak`/`turnBudgetBreachStreak` thresholds with a first-breach grace window. Both were operational lessons learned during the field deployment that motivated the spec. Recording them in the spec's Design Decisions preserves the *why* for future readers.

- **The TS diagnostic panel is still flaky** (CLAUDE.md MEMORY.md re-confirmed) — duplicate-import and "Cannot find module" warnings appeared after my edit but `npx tsc --noEmit` was clean. Always verify with the compiler, not the panel.

---

## How to commit this session's work

```
git add features/schedule-collision-prevention.md \
        features/roadmap.md \
        features/changelog.md \
        src/app/api/schedules/route.ts \
        HANDOFF.md \
        .archive/handoff/2026-05-03-roadmap-drift-hardening-shipped-handoff.md
git commit -m "feat(schedules): close UI auto-stagger gap; ship-verify schedule-collision-prevention"
```

The single commit is fine — the spec/roadmap/changelog edits and the route.ts edit are part of the same Ship Verification close-out. Per CLAUDE.md commit style: prefer `feat()` over `docs()` because there's a real code change (the route.ts stagger block).

---

*End of handoff. Next move: 30-min Ship Verification on `enrichment-planner-test-hardening`, then `workflow-learning-approval-reliability` (P1) or `composed-app-manifest-authoring-tools` (P3) for the next build.*
