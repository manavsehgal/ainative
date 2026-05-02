# Handoff: Phase 5 (`row-trigger-blueprint-execution`) shipped — pick the next feature

**Created:** 2026-05-02 (Phase 5 implementation + verification session)
**Status:** Phase 5 fully shipped. End-to-end browser smoke confirmed the engine.ts touch passed CLAUDE.md's runtime-registry-adjacent rule (no ReferenceError, no module-load cycle). 14 commits across 7 waves; 2 bugs found and fixed during implementation; working tree clean after this commit lands.
**Predecessor:** `.archive/handoff/2026-05-02-row-trigger-blueprint-execution-pre-shipped-handoff.md` (the Phase-4-shipped handoff this one supersedes)

---

## TL;DR for the next agent (or interactive session)

1. **Phase 5 is shipped.** The composed-app-kit feature surface now lights up end-to-end: a row insert into a user_table that an app subscribes to via `trigger.kind: row-insert` produces a workflow with `_contextRowId` and a task with `tasks.context_row_id` populated. Phase 4's Inbox UI now has a real upstream to attribute drafts to.

2. **Pick the next feature.** Two natural pickups, in priority order:

   - **Runtime configuration to actually run drafts.** During Phase 5 smoke, the row-triggered task failed with `NoCompatibleRuntimeError: No compatible configured runtime is available for this task` because the `cs-coach` agent profile has no runtime registered in this dev env. This isn't a bug — the dispatcher contract is verified — but to see Inbox actually populate with drafted documents end-to-end, the next feature is **profile-runtime-default-resolution** (or similar): make `cs-coach` and other custom profiles resolve to a runtime via setting/inheritance/fallback rather than failing. Worth a short spec session to scope.
   
   - **`composed-app-auto-inference-hardening`** — the other deferred Phase 4 follow-up. Tightens `pickKit`'s 7-rule decision table against ambiguous edge cases. Lower priority since current heuristic works for all 5 seeded apps.

3. **Verification artifacts** at `output/phase-5-{inbox-pre-insert,table-with-delta-row,inbox-post-insert}.png` (gitignored). The Delta Industries row at `b5ad153a-9e3a-4eb8-9415-721865daec68` is still in the DB along with one orphaned empty row (`fc8161f2-...`) from the inline UI's Add Row click. Optionally clean up via:

   ```bash
   sqlite3 ~/.ainative/ainative.db "DELETE FROM user_table_rows WHERE id IN ('b5ad153a-9e3a-4eb8-9415-721865daec68', 'fc8161f2-49e3-40ff-b2d6-70d729706f17');"
   sqlite3 ~/.ainative/ainative.db "DELETE FROM tasks WHERE context_row_id = 'b5ad153a-9e3a-4eb8-9415-721865daec68';"
   sqlite3 ~/.ainative/ainative.db "DELETE FROM workflows WHERE id = 'aa9ace67-6fd6-48fb-8350-d9f11dbaea36';"
   ```

4. **Lessons worth carrying forward** — see "Patterns to remember" below. Two new bugs caught at the Phase 5 layer:
   - **Code-island bug at the type boundary.** The dispatcher initially imported `listAppsCached` returning `AppSummary[]` (no `.manifest` field). All unit tests passed because mocks returned shapes WITH `.manifest`. The bug was caught by an attentive implementer during self-review, not by tests. Lesson: when a function returns a type that lacks a field your code depends on, mocks that supply that field hide the bug. Mock at the structural boundary, not the type assertion.
   - **Phase 4 fixture incompleteness.** The Tables UI reads from `user_tables.column_schema` (denormalized JSON), but Phase 4's smoke fixture only inserted rows into `user_table_columns` — the JSON stayed `[]`. Fix: populated the JSON manually before smoke. A future smoke-fixture refactor should use a single source of truth for column metadata.

---

## What landed this session

14 wave commits + 4 docs commits = 18 commits since the previous HANDOFF:

```
W1  a35c2075  feat(workflows): instantiateBlueprint accepts metadata._contextRowId
W2  2c0de09e  feat(workflows): engine stamps tasks.context_row_id from workflow definition
    2eb55d56  test(workflows): malformed-definition fallback for context_row_id
W3  d00cdf08  test(blueprints): validity tests for Phase 5 blueprints
W4  8402976e  feat(apps): listAppsCached + invalidateAppsCache (5s TTL)
    e0b6b798  feat(apps): invalidate apps cache on manifest mutations
W5  6917aca6  feat(apps): manifest-trigger-dispatch happy path
    70719b7a  test(apps): manifest-trigger-dispatch match-count cases
    5014698c  feat(apps): dispatcher resolves {{row.<col>}} blueprint defaults
    66842782  fix(apps): dispatcher uses listAppsWithManifestsCached, not summaries
    de5cd49f  feat(apps): dispatcher writes notification on dispatch failure
    9bad7dec  feat(apps): dispatcher tolerates listAppsWithManifestsCached failures
W6  af811299  feat(data): wire manifest-trigger-dispatch into addRows
W7  85d88f6c  test(data): integration test for addRows → manifest dispatch
W9  2e58270b  docs(features): row-trigger-blueprint-execution shipped
    (this handoff commit — see below)
```

Pre-wave planning commits (already shipped before this session):
```
c153605e  docs(specs): row-trigger-blueprint-execution design
7c8354dc  docs(plans): row-trigger-blueprint-execution implementation plan
```

---

## Verification this session

- **Unit tests:** Full suite passes 1935+ tests (Phase 4's 340 + new dispatcher + integration tests + every prior feature). Pre-existing 7 failures on `main` in unrelated files (`e2e/blueprint.test.ts`, `agents/router.test.ts`, `validators/settings.test.ts`) are not Phase 5 regressions.
- **Browser smoke (mandatory per CLAUDE.md, engine.ts is runtime-registry-adjacent):**
  - Cold start dev server (PORT=3010) — no `ReferenceError`, no module-load cycle
  - `POST /api/tables/customer-touchpoints/rows` with Delta Industries row data → workflow `aa9ace67-...` created with `_contextRowId` matching the new row id
  - `definition.steps[0].prompt` contains the row data substituted in: "...for **Delta Industries**. Touchpoint summary: **Asking about pricing**. Channel: **email**. Detected sentiment: **neutral**."
  - Task `bd416ffd-...` created with `context_row_id = b5ad153a-...` and `project_id = customer-follow-up-drafter`
  - Console clean across all visited pages
  - Task ultimately failed with `NoCompatibleRuntimeError` for `cs-coach` profile — runtime config issue, NOT a Phase 5 bug
- **`npx tsc --noEmit`:** clean (the diagnostic panel's `Cannot find module '@/lib/db'` etc. is documented flaky stale state per project memory)
- **Schema deviations from plan, all caught and adapted:**
  - `notifications.type` is a strict enum that doesn't include `trigger_failure` — adapted to `task_failed` with error class encoded in `title`
  - `BlueprintSchema.domain` is a strict enum (`work | personal`) — `customer-success` and `research` mapped to `work`
  - `BlueprintSchema.steps[].requiresApproval` is required — added explicitly to both new blueprints
  - `listAppsCached` returns `AppSummary[]` (no manifest) — added parallel `listAppsWithManifestsCached` returning `AppDetail[]`

---

## Patterns to remember (this session's additions)

- **Mock at the structural boundary, not the type assertion.** The dispatcher's first version mocked `listAppsCached` returning shapes WITH `.manifest` — but the real function returns `AppSummary[]` without it. The unit tests passed; runtime would have silently no-op'd. The fix was a parallel function with the right return type. Lesson: when test mocks return a more permissive shape than the real function, you get green tests + a runtime-broken feature. Read the actual return type signature when writing mocks; don't trust your memory of "it has manifest because I want it to."
- **Schema enums catch design-spec drift.** Three of Phase 5's spec-to-code deviations were forced by enum constraints in the actual schema (notifications.type, BlueprintSchema.domain, BlueprintSchema.requiresApproval). Lesson: spec-writing should grep the schema for the actual enum values rather than describing conceptual labels. The implementer surfaces drift via NEEDS_CONTEXT or DONE_WITH_CONCERNS reports — listen.
- **Browser smoke catches what unit tests structurally can't, even when you think it won't.** Wave 7's integration test mocked `executeWorkflow` so it wouldn't see runtime errors — fine for verifying the wiring. Wave 8 ran the full chain in a real Next.js process and surfaced (1) the `column_schema` denormalization gap that blocked the UI, and (2) the `NoCompatibleRuntimeError` that revealed the missing runtime configuration for custom profiles. Neither would have shown up in unit tests.
- **`await import()` in dispatchers from data-layer modules.** Importing engine.ts statically from `src/lib/data/tables.ts` (via the dispatcher's static import) would have created the documented runtime-registry cycle. The dispatcher uses dynamic imports for `engine.ts` and `instantiator.ts`. Confirmed end-to-end: zero ReferenceError in cold start, route handlers, or row-insert dispatch.

---

## Carried-forward gaps (acknowledged, not blocking)

1. **`cs-coach` and other custom agent profiles have no runtime resolution path** in the dev env — row-triggered drafts complete the full Phase 5 chain but fail at task execution. To see Inbox actually populate with drafted documents, scope a follow-up: `profile-runtime-default-resolution` or similar. The dispatcher contract works.
2. **Tables UI requires `user_tables.column_schema` JSON to be populated.** Phase 4's smoke fixture left this empty (only `user_table_columns` rows existed). Manually populated for the smoke. Future smoke-fixture refactor: keep both in sync via a shared seed helper.
3. **Multi-step Inbox loader** — pre-existing from Phase 4. The Phase 4 loader uses `LIMIT 1 + JOIN documents` which works fine for single-step blueprints (Phase 5's two new blueprints). If multi-step row-triggered blueprints become common, the loader needs `ORDER BY` tightening.
4. **Code-quality reviewer's parameter-threading concern from W2.1** (the `_contextRowId` extraction re-fetches `workflow.definition` after `executeWorkflow` may have mutated state). Documented as theoretical; the field is set once at workflow creation and never modified, so stale reads are harmless today. If a future reader of `workflow.definition` in `executeChildTask` reads a dynamically-mutating field, that future reader gets the bug, not us.
5. **One orphaned empty row** at `fc8161f2-...` in `user_table_rows` from the inline Add Row click. Optional cleanup SQL in TL;DR §3.

---

*End of handoff. Next move: scope `profile-runtime-default-resolution` to close the runtime gap, OR pick `composed-app-auto-inference-hardening`. Both are lower-priority than the row-trigger feature that just shipped.*
