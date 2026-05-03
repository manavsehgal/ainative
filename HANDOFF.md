# Handoff: `workflow-learning-approval-reliability` ship-verified — 4 planned specs left, no P1 remaining

**Created:** 2026-05-03 (continuation session — Ship Verification on `workflow-learning-approval-reliability`)
**Status:** Working tree has uncommitted edits across spec, roadmap, changelog, HANDOFF.md. **Zero source code changes** — pure Ship Verification close-out. Roadmap status now: 207 completed / 27 deferred / 4 planned / 4 in-progress / 5 non-spec docs.
**Predecessor:** previous handoff was the `enrichment-planner-test-hardening` build session (committed in `3bc36c9d`).

---

## TL;DR for the next agent

1. **`workflow-learning-approval-reliability` was the fifth consecutive bidirectional-spec-staleness catch, on the highest-priority remaining `planned` feature.** All 9 ACs were already satisfied by existing code — verification took ~30 minutes with zero source changes. Notable pieces shipped across prior sessions: workflow engine owns session lifecycle (`engine.ts:83/116/193/1269/1332`), pattern extractor buffers via `bufferProposal` (`pattern-extractor.ts:115`), `learning-session.ts:80-141` produces exactly one `context_proposal_batch` notification per workflow, doubled SQL+JS visibility filter at `src/lib/notifications/visibility.ts` with 5 call sites across the inbox page + API route + live list component.

2. **CLAUDE.md runtime-registry smoke gate did NOT fire here** because Ship Verification reads code without reshaping imports. The gate triggers only when "a plan adds, removes, or reshapes an import in any module transitively reachable from `@/lib/agents/runtime/catalog.ts`". This is a useful precedent: Ship Verification on runtime-adjacent features is *cheap* — the smoke gate cost only applies once the verifier escalates to a build session that touches imports.

3. **No P1 left in the planned roster.** Truly-planned roster (after this session) is **4 specs**, all P2/P3:

   | Spec | Priority | Notes |
   |---|---|---|
   | `onboarding-runtime-provider-choice` | P2 | |
   | `task-turn-observability` | P2 | Confirmed-planned (the `turnCount` column is on `scheduleFiringMetrics`, not `tasks`). |
   | `chat-conversation-branches` | P3 | |
   | `composed-app-manifest-authoring-tools` | P3 | "Momentum" alternative across the last two handoffs. |

   **Recommended order:**
   - **30-min Ship Verification on `task-turn-observability` first** — same playbook as today's session (grep for spec-referenced symbols, especially around `turnCount` / `scheduleFiringMetrics`, before treating as buildable). High likelihood of similar partial-or-full drift given the pattern's track record.
   - **Then `onboarding-runtime-provider-choice`** for the remaining P2.
   - **Then either P3** based on momentum: `composed-app-manifest-authoring-tools` is the bigger one and has been deferred multiple times; `chat-conversation-branches` is a more focused chat-runtime change.

4. **Outstanding gap-closure work (not blocking, trackable):**
   - `direct-runtime-prompt-caching` (in-progress) — needs ledger persistence + cost-dashboard cache hit-rate UI + Batch API for meta-completions.
   - `direct-runtime-advanced-capabilities` (in-progress) — context compaction, `/v1/models` discovery, and Anthropic server-tool toggles.
   - `upgrade-session` (in-progress) — dedicated session-sheet UI, upgrade history list, abort confirmation, dev-server restart banner.
   - `composed-app-auto-inference-hardening` (in-progress) — 4 deferred ACs gated on first reported kit misfire.

5. **Fifth consecutive bidirectional-staleness catch — formalize the grooming check.** This pattern has now hit P0/P1/P2 specs across five sessions in a row. The `/supervisor` and `product-manager` skills should bake in: *"Before treating any `status: planned` feature as buildable, grep for the spec's referenced files / functions / DB columns / route paths. If artifacts exist, the work shifts from build to verify."* Worth a dedicated entry in MEMORY.md or a hook.

---

## What landed this session

Uncommitted in working tree (4 files, **zero source changes**):

- `features/workflow-learning-approval-reliability.md` — `status: planned` → `status: completed`, `shipped-date: 2026-05-03`. All 9 ACs checked with file:line evidence. 3 Design Decisions added (doubled SQL+JS visibility filter; workflow engine owns session lifecycle, not runtime adapters; pattern extraction awaited but non-fatal). New "Verification" section documents the test run.
- `features/roadmap.md` — `workflow-learning-approval-reliability` row flipped `planned` → `completed`.
- `features/changelog.md` — prepended top-level entry with file:line evidence map and Design Decision summaries.
- `HANDOFF.md` — this file.

### Net effect on roadmap

| Status | Before | After |
|---|---|---|
| completed | 206 | 207 |
| planned | 5 | 4 |

(in-progress, deferred, non-spec all unchanged. P1 planned count: **0**.)

### Test surface verified

- `npx vitest run src/lib/notifications src/lib/agents/__tests__/learning-session.test.ts src/lib/agents/__tests__/pattern-extractor.test.ts src/components/notifications` — **19/19 passed across 7 files**.

---

## Patterns reinforced this session

- **Bidirectional spec staleness — fifth consecutive session.** Now spans P0/P1/P2/P3 priorities. The CLAUDE.md MEMORY.md entry "Spec frontmatter `status: planned` is unreliable — code may already be shipped" deserves promotion to a process gate, not just a memory note.

- **Ship Verification on runtime-adjacent features is cheap.** The CLAUDE.md runtime-registry smoke-test budget rule reads as a heavy cost ("must budget an end-to-end smoke step under `npm run dev`"), but it only fires when a plan reshapes imports. Pure verification reads code without changing it, so the smoke gate doesn't apply. This makes it safe to default to Ship Verification first on runtime-adjacent specs, escalating only if real gaps exist.

- **`/permission_required` regression-pin via test.** AC #9 ("permission_required behavior unchanged") sounds soft, but `permission-response-actions.test.tsx` (4 tests) plus `isLearningNotificationType`'s exact-string match in `visibility.ts:11-13` together pin the invariant: any future expansion of the "responded-filter" types must be explicit. The test would fail if a fix-the-symptom-not-the-cause refactor accidentally widened the filter.

- **Doubled SQL+JS filter is the user-facing reliability play.** SQL alone would mean the responded item lingers visually until the next refresh. JS alone would mean the wire payload carries items the user will never see. The doubling is what makes the approval flow feel trustworthy — directly addresses the "trust" failure mode the spec was written to fix.

---

## How to commit this session's work

```
git add features/workflow-learning-approval-reliability.md \
        features/roadmap.md \
        features/changelog.md \
        HANDOFF.md
git commit -m "docs(features): ship-verify workflow-learning-approval-reliability (P1 close-out)"
```

Single docs-only commit — zero source changes today. Per CLAUDE.md commit style: `docs(features)` is correct here because nothing under `src/` moved.

---

*End of handoff. Next move: 30-min Ship Verification on `task-turn-observability` (P2), then `onboarding-runtime-provider-choice` (P2), then either P3 based on momentum.*
