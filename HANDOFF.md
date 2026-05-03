# Handoff: `enrichment-planner-test-hardening` shipped — P1 `workflow-learning-approval-reliability` is next

**Created:** 2026-05-03 (build session — `enrichment-planner-test-hardening`)
**Status:** Working tree has uncommitted edits across spec, roadmap, changelog, planner source + tests, new route test file, and HANDOFF.md. Ready to commit. Roadmap status now: 206 completed / 27 deferred / 5 planned / 4 in-progress / 5 non-spec docs.
**Predecessor:** previous handoff was the `schedule-collision-prevention` ship verification (committed in `245d7165`).

---

## TL;DR for the next agent

1. **`enrichment-planner-test-hardening` was a real build session, not a Ship Verification.** The previous handoff flagged it as "possibly already shipped — 30-min Ship Verification candidate." Verification at start showed: AC #1 (validation-before-cast) shipped *transitively* via `buildTargetContract`, but ACs #2–#5 (route tests, planner test expansion, sample-binding rationale) had not landed. Rather than escalate to a multi-day plan, the gap was small enough to close in one session: 73/73 tables tests green, `tsc` clean, 40 planner tests + 11 plan-route tests added.

2. **Test-to-code ratio jump.** Planner went from 124/454 = **27.3%** to 573/459 = **124.8%**. The internal helpers `buildReasoning` and `selectStrategy` are not exported, so they're tested through the public `buildEnrichmentPlan` API — matches the MEMORY.md "mock at the outermost boundary" rule. A future refactor that splits or merges those helpers (without changing observable plan output) won't break the suite.

3. **Pattern reinforced (yet again).** This was the *fourth* consecutive session where a `status: planned` feature needed grep-for-symbols verification before being treated as buildable. AC #1 here was a perfect example of *positive drift*: the runtime path was strictly stronger than the spec asked for (`assertEnrichmentCompatibleColumn` runs in `buildTargetContract`, which protects both `buildEnrichmentPlan` and `validateEnrichmentPlan` entry points). Codified as a Design Decision in the spec.

4. **Pick the next feature.** Truly-planned roster (after this session) is **5 specs**:

   | Spec | Priority | Notes |
   |---|---|---|
   | `workflow-learning-approval-reliability` | **P1** | Highest priority. Touches `claude-agent.ts` + `learning-session.ts` + Inbox UI. Has prior-incident evidence in `.archive/handoff/table-enrich-context-approval-noise.md`. |
   | `onboarding-runtime-provider-choice` | P2 | |
   | `task-turn-observability` | P2 | Confirmed-planned (the `turnCount` column is on `scheduleFiringMetrics`, not `tasks`). |
   | `chat-conversation-branches` | P3 | |
   | `composed-app-manifest-authoring-tools` | P3 | Prior-handoff's "momentum" alternative if avoiding the runtime-registry smoke gate. |

   **Recommended order:**
   - **`workflow-learning-approval-reliability`** is the only remaining P1 — start there.
   - **CRITICAL: this feature triggers the CLAUDE.md runtime-registry smoke-test budget.** It touches `claude-agent.ts`, which is in the transitive import graph of `@/lib/agents/runtime/catalog.ts`. Plan an end-to-end smoke run under `npm run dev`, not just unit tests. Unit tests that mock chat-tools modules cannot catch module-load cycles. See CLAUDE.md "Smoke-test budget" section + TDR-032 + `features/task-runtime-ainative-mcp-injection.md` "Verification run — 2026-04-11" for the precedent.
   - **Or pick `composed-app-manifest-authoring-tools` (P3)** for momentum continuation if you'd rather not deal with the runtime-registry smoke gate this session.

5. **Outstanding gap-closure work (not blocking, trackable):**
   - `direct-runtime-prompt-caching` (in-progress) — needs ledger persistence + cost-dashboard cache hit-rate UI + Batch API for meta-completions.
   - `direct-runtime-advanced-capabilities` (in-progress) — context compaction, `/v1/models` discovery, and Anthropic server-tool toggles.
   - `upgrade-session` (in-progress) — dedicated session-sheet UI, upgrade history list, abort confirmation, dev-server restart banner.
   - `composed-app-auto-inference-hardening` (in-progress) — 4 deferred ACs gated on first reported kit misfire.

---

## What landed this session

Uncommitted in working tree (6 files):

- `features/enrichment-planner-test-hardening.md` — `status: planned` → `status: completed`, `shipped-date: 2026-05-03`. All 6 ACs checked with file:line evidence + 3 Design Decisions added (validation through buildTargetContract, test-via-public-API rationale, named-constant for sample-binding limit).
- `features/roadmap.md` — `enrichment-planner-test-hardening` row flipped `planned` → `completed`.
- `features/changelog.md` — prepended top-level entry with implementation summary, test-to-code ratio change, and the spec-correction note.
- `src/lib/tables/enrichment-planner.ts` — added `PREVIEW_SAMPLE_BINDING_COUNT` constant + comment; replaced two `.slice(0, 2)` call sites.
- `src/lib/tables/__tests__/enrichment-planner.test.ts` — expanded 124 → 573 lines, 7 → 40 tests.
- `src/app/api/tables/[id]/enrich/plan/__tests__/route.test.ts` — **new file**, 11 tests.
- `HANDOFF.md` — this file.

### Net effect on roadmap

| Status | Before | After |
|---|---|---|
| completed | 205 | 206 |
| planned | 6 | 5 |

(in-progress, deferred, non-spec all unchanged.)

---

## Patterns reinforced this session

- **Bidirectional spec staleness — fourth consecutive session catching it.** AC #1 of this spec was already shipped (and stronger than asked). The previous three sessions all caught the same pattern in different forms. The `/supervisor` skill should bake this into the next-up triage step: a `status: planned` feature with N referenced symbols all present in code is almost certainly already shipped or partially shipped — verify before scoping.

- **Test internal helpers via public API, not via export.** `buildReasoning` and `selectStrategy` were intentionally kept un-exported. The new tests inspect `plan.reasoning` and `plan.strategy` from the public output. A future maintainer can refactor those helpers freely without breaking the suite. This matches the MEMORY.md "mock at the outermost boundary" lesson.

- **Magic number → named constant is documentation by other means.** The original spec asked for "a code comment explaining why 2." Replacing the two `.slice(0, 2)` call sites with `.slice(0, PREVIEW_SAMPLE_BINDING_COUNT)` carries the rationale once at the constant declaration instead of twice at the call sites. Per CLAUDE.md "DRY with judgment — extract on third use, not first" — but the alternative here was duplicating a multi-line comment, so the extraction earns its keep.

- **Positive drift is worth codifying in the spec.** AC #1 of the original spec asked for the assertion to be moved to the top of `buildEnrichmentPlan`. The shipped path goes through `buildTargetContract`, which is *stronger* — it protects both `buildEnrichmentPlan` AND `validateEnrichmentPlan`. Spec now records this as a Design Decision so future readers don't "fix" the perceived spec deviation.

---

## How to commit this session's work

```
git add features/enrichment-planner-test-hardening.md \
        features/roadmap.md \
        features/changelog.md \
        src/lib/tables/enrichment-planner.ts \
        src/lib/tables/__tests__/enrichment-planner.test.ts \
        "src/app/api/tables/[id]/enrich/plan/__tests__/route.test.ts" \
        HANDOFF.md
git commit -m "feat(tables): ship enrichment-planner test hardening (40 unit + 11 route tests)"
```

Single commit is fine — spec/roadmap/changelog are part of the same close-out as the code change. Per CLAUDE.md commit style: prefer `feat()` over `test()` because the named-constant refactor in `enrichment-planner.ts` is a real (small) code change.

---

*End of handoff. Next move: `workflow-learning-approval-reliability` (P1 — runtime-registry smoke-test budget applies) or `composed-app-manifest-authoring-tools` (P3 — momentum alternative).*
