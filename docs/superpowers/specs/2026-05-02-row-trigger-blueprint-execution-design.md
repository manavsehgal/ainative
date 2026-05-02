# Row-trigger blueprint execution — design spec

**Date:** 2026-05-02
**Feature:** `row-trigger-blueprint-execution`
**Predecessor:** `composed-app-kit-inbox-and-research` (Phase 4) — locked the manifest's `blueprints[].trigger.kind: "row-insert"` field, the `tasks.contextRowId` column, the `detectTriggerSource` helper, and the Inbox loader contract. This spec wires the manifest field through the engine so blueprints actually fire when rows arrive.
**Scope mode:** HOLD — focused engine-wiring feature with explicit scope-creep risk. Required artifacts: NOT-in-scope, what-already-exists, error-and-rescue registry, ASCII data-flow diagram. All present below.

## TL;DR

When a row arrives at a user-table that any composed app's manifest subscribes to via `trigger.kind: "row-insert"`, instantiate that app's named blueprint with row-derived variables, kick off `executeWorkflow` async, and ensure the resulting task(s) carry `tasks.contextRowId = <row-id>` and `tasks.projectId = <appId>`. Multiple subscribing apps fire independently. Unknown blueprint references write a `notifications` row. Cached `listApps()` reads keep the hot path bounded.

## Locked design decisions

1. **Architecture: parallel hook**, not a sync into `user_table_triggers`. New module `src/lib/apps/manifest-trigger-dispatch.ts` exports `evaluateManifestTriggers(tableId, rowId, rowData)`, called alongside the existing `evaluateTriggers` from `addRows()`. Why: keeps user-state triggers (UI-managed `user_table_triggers` rows) and config-state triggers (manifest-declared) cleanly separated; manifests stay the source of truth without a denormalized DB mirror.
2. **Scope: fix forward.** Phase 4's two smoke manifests (`customer-follow-up-drafter`, `research-digest`) currently reference unregistered blueprint ids (`draft-followup`, `weekly-digest`). This feature authors two real blueprints under `~/.ainative/blueprints/` using the canonical `<appId>--<slug>` pattern (matching `habit-tracker--weekly-review.yaml`) and updates the smoke manifests to use qualified ids + `source` pointers. Without this, the feature ships with no end-to-end verification.
3. **Failure mode for unresolvable blueprint refs: notification + log.** When `getBlueprint(id)` returns undefined, write a `notifications` row (`kind: "trigger_failure"`, body includes appId + blueprintId + table). Other matching apps still fire. No silent skip.
4. **Dispatch contract: fire-and-forget at the row-insert site.** Inside the dispatcher, `instantiateBlueprint` is awaited (DB insert only — fast). `executeWorkflow` is *not* awaited (may take minutes — kicked off as a non-awaited promise). The row-insert request returns within tens of milliseconds.
5. **`tasks.contextRowId` stamping mechanism: workflow metadata read at task-creation time.** The dispatcher persists `contextRowId` into the workflow's `definition` JSON at instantiate time. `src/lib/workflows/engine.ts` reads `workflow.definition._contextRowId` when creating each task. This avoids polling for tasks-to-appear races and adds one small read in engine.ts.
6. **Multi-app subscription:** N apps subscribing to the same table → N independent dispatches → N tasks, each with `projectId = appId` and `contextRowId = rowId`.
7. **Variable substitution:** the dispatcher pre-resolves `{{row.<column>}}` placeholders in blueprint variable defaults from `rowData` before passing to `instantiateBlueprint`. No change to `template.ts`. Blueprint variables that aren't matched by a row column fall back to their static defaults; required variables with no resolution → blueprint validation error → notification.
8. **Caching:** 5-second TTL in-process cache around `listApps()` results, invalidated on `upsertAppManifest()` and `deleteApp()` calls. Bounds the hot-path filesystem cost while keeping human-scale UX responsive.

## What already exists (will reuse, not rebuild)

- **`evaluateTriggers(tableId, event, rowData)`** at `src/lib/tables/trigger-evaluator.ts:24` — already invoked from `addRows`/`updateRow`/`deleteRow` in `src/lib/data/tables.ts`. Read its fire-and-forget shape; do not modify.
- **`listApps(appsDir)`** at `src/lib/apps/registry.ts:280` — filesystem reader for `~/.ainative/apps/*/manifest.yaml`. Wrap with cache; do not duplicate the read logic.
- **`upsertAppManifest()` and `deleteApp()`** in `src/lib/apps/registry.ts` and `src/lib/apps/compose-integration.ts` — the canonical mutation surfaces. Cache invalidation hooks attach here.
- **`getBlueprint(id)`** at `src/lib/workflows/blueprints/registry.ts:74` — already supports both `BUILTINS_DIR` and `~/.ainative/blueprints/`.
- **`instantiateBlueprint(id, variables, projectId?)`** at `src/lib/workflows/blueprints/instantiator.ts:24` — creates a `workflows` row in `status: "draft"`. Returns `{ workflowId, name, stepsCount, skippedSteps }`. No imports of runtime-registry modules — safe to call statically, but per CLAUDE.md the dispatcher uses `await import()` for defensive uniformity with `executeWorkflow`.
- **`executeWorkflow(workflowId)`** at `src/lib/workflows/engine.ts:37` — creates tasks and runs steps. **Runtime-registry-adjacent** per CLAUDE.md → use `await import()` from the dispatcher.
- **`ensureAppProject(appId)`** in `src/lib/apps/compose-integration.ts` — already creates `projects` rows where `id = appId`. The dispatcher passes `appId` as `projectId` to `instantiateBlueprint`; the FK check works because the row already exists.
- **`notifications` table** + helpers under `src/lib/notifications/*` — already in place, used by other failure-surface code.
- **`tasks.contextRowId`** column at `src/lib/db/schema.ts:33` — already shipped by Phase 4. No migration in this feature.

## Architecture & data flow

```
POST /api/tables/:id/rows
  └─ addRows(tableId, [rowInput])  [src/lib/data/tables.ts:231]
       ├─ db.insert(user_table_rows)                          [synchronous, returns row id]
       ├─ evaluateTriggers(tableId, "row_added", rowData)     [async fire-and-forget, EXISTING]
       └─ evaluateManifestTriggers(tableId, rowId, rowData)   [async fire-and-forget, NEW]
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ evaluateManifestTriggers (src/lib/apps/manifest-trigger-dispatch.ts) │
│                                                                  │
│   1. listAppsCached()  →  apps[]                                 │
│         └─ 5s TTL in-process cache; on miss reads listApps()     │
│                                                                  │
│   2. matches = apps.filter(app =>                                │
│         app.manifest.blueprints.some(b =>                        │
│           b.trigger?.kind === "row-insert"                       │
│           && b.trigger.table === tableId))                       │
│                                                                  │
│   3. for each match:                                             │
│         ├─ resolveRowVars(blueprint.variables, rowData)          │
│         │     └─ replaces {{row.<col>}} with rowData[col]        │
│         │     └─ falls back to blueprint.variables[i].default    │
│         │                                                        │
│         ├─ try:                                                  │
│         │    ├─ const { instantiateBlueprint } = await import(   │
│         │    │     "@/lib/workflows/blueprints/instantiator")    │
│         │    ├─ { workflowId } = await instantiateBlueprint(     │
│         │    │     blueprintId, vars, appId,                     │
│         │    │     { _contextRowId: rowId })  ← NEW PARAM        │
│         │    │                                                   │
│         │    ├─ const { executeWorkflow } = await import(        │
│         │    │     "@/lib/workflows/engine")                     │
│         │    └─ executeWorkflow(workflowId)  ← NOT AWAITED       │
│         │           ↑                                            │
│         │      engine reads workflow.definition._contextRowId    │
│         │      when creating tasks; stamps tasks.context_row_id  │
│         │                                                        │
│         └─ catch (err):                                          │
│              └─ writeNotification("trigger_failure", { appId,    │
│                   blueprintId, tableId, message: err.message })  │
└─────────────────────────────────────────────────────────────────┘
```

## Components & files

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/apps/manifest-trigger-dispatch.ts` | NEW | The dispatcher + 5s cache + variable resolver |
| `src/lib/apps/__tests__/manifest-trigger-dispatch.test.ts` | NEW | Unit tests covering happy paths + every error-registry row (mocks `listAppsCached`, `instantiateBlueprint`, `executeWorkflow`, `writeNotification`) |
| `src/lib/data/tables.ts` | EDIT | One-line: `evaluateManifestTriggers(tableId, newRow.id, rowData).catch(() => {})` after the existing `evaluateTriggers` call in `addRows` |
| `src/lib/data/__tests__/tables-row-insert-dispatch.test.ts` | NEW (1-2 tests) | Integration test: real in-memory DB, real manifest fixture in tmp dir, `addRows` → assert `tasks.contextRowId` populated within a poll window |
| `src/lib/workflows/blueprints/instantiator.ts` | EDIT | Accept optional `metadata?: { _contextRowId?: string }` parameter. Persist into `definition` JSON. ~3 lines. |
| `src/lib/workflows/engine.ts` | EDIT (touch) | When creating a task from a workflow step, read `workflow.definition._contextRowId` and stamp `tasks.context_row_id`. ~5 lines. **Runtime-registry-adjacent — smoke required.** |
| `src/lib/apps/registry.ts` | EDIT | `upsertAppManifest()` and `deleteApp()` call `invalidateAppsCache()` (1 line each) |
| `~/.ainative/blueprints/customer-follow-up-drafter--draft-followup.yaml` | NEW | Real blueprint: 1 step, drafts a follow-up email. Variables: `customer`, `summary`, `sentiment` with `{{row.<col>}}` defaults. |
| `~/.ainative/blueprints/research-digest--weekly-digest.yaml` | NEW | Real blueprint: 1 step, synthesizes weekly digest. Note: research-digest's trigger is *schedule*, not *row-insert*, so this blueprint is for schedule-triggered execution; it isn't part of the dispatcher's hot path but is needed so the manifest reference resolves. |
| `~/.ainative/apps/customer-follow-up-drafter/manifest.yaml` | EDIT | Update blueprint id to `customer-follow-up-drafter--draft-followup` + add `source` pointer |
| `~/.ainative/apps/research-digest/manifest.yaml` | EDIT | Update blueprint id to `research-digest--weekly-digest` + add `source` pointer |

## NOT in scope (explicit deferrals)

- **`row_updated` and `row_deleted` triggers.** Phase 4's manifest schema only locks `kind: "row-insert"`. Adding update/delete means new manifest schema fields. Defer until a concrete app needs them.
- **Conditions on row-insert triggers.** The existing `user_table_triggers` UI supports filter conditions; manifest triggers fire unconditionally. If conditional manifest triggers become a need: add a `trigger.condition: FilterSpec` manifest field and reuse `matchesCondition()` from `trigger-evaluator.ts`.
- **Webhook triggers / external events.** Out of scope per Phase 4 spec.
- **Deduplication of concurrent inserts.** The dispatcher fires once per row insert. Bulk inserts (e.g., 100 rows) → 100 dispatches. Matches existing `evaluateTriggers` semantics. If load becomes a concern, batching is a follow-up.
- **Migration of existing UI-configured `user_table_triggers` rows to manifest form.** Orthogonal. Both systems coexist.
- **Manifest-editor UI.** Manifests stay YAML-edited.
- **Retry on dispatch failure.** Fire-and-forget. Failures surface via `notifications`. Adding retries means a queue — out of scope.
- **Inbox loader bug surfaced by multi-step workflows.** If a row-triggered workflow has multiple steps, all of them get `contextRowId` stamped via the engine read. The Phase 4 Inbox loader uses `ORDER BY createdAt DESC LIMIT 1 + JOIN documents` — if the latest task has no document, Inbox shows empty. This pre-exists Phase 4's design; tighten the loader in a follow-up if multi-step row-triggered workflows become common. For Phase 5's two new blueprints, both are single-step so this doesn't bite.

## Error & Rescue Registry (HOLD mode)

| # | Error | Trigger | Impact | Rescue |
|---|---|---|---|---|
| 1 | Unknown blueprint id | Manifest references id not in `~/.ainative/blueprints/` or builtins | Subscription doesn't fire | Notification (`kind=trigger_failure`, body=`app:<id> blueprint:<bp> not registered`). Other matching apps fire normally. `console.error` logged. |
| 2 | Required blueprint variable not satisfied | Row data missing the column AND blueprint variable has no static default | `instantiateBlueprint` throws | Caught at dispatcher; notification with the missing variable name. No partial workflow created. |
| 3 | `listApps()` filesystem error | Permission denied, dir missing, OS-level fault | Manifest dispatch fails for this insert | Caught + logged. Existing `evaluateTriggers` (UI-trigger path) unaffected. Notification: `manifest_scan_failed`. Cache holds last good result for 5s — subsequent inserts within window still work if cache was warm. |
| 4 | Stale cache: app created/deleted within 5s window | Cache holds previous-state result | New app's first row insert misses; deleted app's stale subscription fires | Acceptable trade-off. Mitigation: `upsertAppManifest()` and `deleteApp()` call `invalidateAppsCache()` immediately. Worst case: row inserted between manifest write and cache invalidation → next insert is correct. |
| 5 | `instantiateBlueprint` succeeds but `executeWorkflow` rejects later | Workflow engine error mid-flight | Workflow exists in DB with `status=draft`, never runs | The dispatcher's catch can't see this (executeWorkflow is not awaited). Engine's own error path writes its own notification. **Acceptance criterion:** verify engine's existing error-surface covers this case during smoke. |
| 6 | `tasks.context_row_id` stamping fails | Engine reads `definition._contextRowId` but the field is missing or malformed | Tasks created without `context_row_id` | Inbox draft pane shows empty state. Acceptable — non-fatal. Add an engine-level warning log: `[engine] workflow X expected _contextRowId but field absent`. |
| 7 | Manifest YAML parse failure | Hand-edited manifest invalid syntax | App's subscription invisible to dispatcher | `listApps()` already silently skips malformed manifests (`registry.ts:285` try/catch). **Improvement:** when `count(parsed) < count(dirs)`, write a notification: `kind=manifest_invalid`, body=`<dirname> failed to parse`. ONE per session, not per insert (set in cache). |
| 8 | Concurrent insert spam | Bulk import of 100 rows | 100 fire-and-forget dispatches → 100 workflows → 100 first-step tasks all queued | Each dispatch is independent. Workflow engine's existing slot/lease semantics throttle execution. If user observes runaway costs, manifest's `trigger.kind: "row-insert"` should be paired with a manifest-level `maxFireRatePerMin` — out of scope here, document as a known gap. |

## Acceptance criteria

- [ ] `evaluateManifestTriggers(tableId, rowId, rowData)` exists in `src/lib/apps/manifest-trigger-dispatch.ts` and is called from `addRows()` after `evaluateTriggers`
- [ ] When 1 manifest subscribes to a table, 1 task is created with `contextRowId === rowId` and `projectId === appId`
- [ ] When 0 manifests subscribe, no task is created and no notification is written
- [ ] When 2 manifests subscribe, 2 independent workflows are created (one per app)
- [ ] `{{row.<column>}}` placeholders in blueprint variable defaults resolve from the inserted row's data
- [ ] Unknown blueprint id → notification written, no task created, other matching apps still fire
- [ ] `listApps()` cache invalidates on `upsertAppManifest()` and `deleteApp()`
- [ ] `customer-follow-up-drafter--draft-followup.yaml` and `research-digest--weekly-digest.yaml` exist at `~/.ainative/blueprints/` with valid `BlueprintSchema` shape
- [ ] Phase 4 smoke manifests use qualified ids + `source` pointers; existing tests still pass
- [ ] Engine smoke (per CLAUDE.md): `npm run dev` → insert a row into `customer-touchpoints` via the Tables UI → Inbox draft pane updates with new draft within seconds
- [ ] Console clean during smoke; no module-load cycle errors
- [ ] All Phase 4 unit + integration tests still green
- [ ] New tests: `manifest-trigger-dispatch.test.ts` covers all 8 error-registry rows + happy paths
- [ ] New integration test in `tables-row-insert-dispatch.test.ts` exercises the full `addRows → dispatcher → contextRowId` flow

## Test strategy

- **Unit (8-10 tests):** mock `listAppsCached`, `instantiateBlueprint`, `executeWorkflow`, `writeNotification`. Each error-registry row gets a test. Cache TTL + invalidation verified with timer mocks.
- **Integration (1-2 tests):** real in-memory DB, real manifest fixture in tmp dir via `getAinativeAppsDir` test override (already used by `compose-integration.test.ts`). Insert a row, poll for `tasks.contextRowId` to be set within 2s, assert.
- **Browser smoke (mandatory per CLAUDE.md):** dev server, Tables UI insert into `customer-touchpoints`, observe Inbox draft pane update. Catches module-cycle errors (the runtime-registry-adjacent class) that unit tests structurally cannot.

## Risks worth naming

1. **Engine.ts touch is the runtime-registry-adjacent danger zone.** Even a small read for `_contextRowId` requires browser smoke per CLAUDE.md. The plan must budget the smoke step explicitly.
2. **The 5s cache window** can produce confusing UX for users who insert a row immediately after creating an app. Mitigation: invalidation hooks. The TTL ships hard-coded; if user feedback shows the window matters, future work changes the constant or adds an env var (out of scope here).
3. **Two blueprints written in this feature** (`customer-follow-up-drafter--draft-followup`, `research-digest--weekly-digest`) become long-lived smoke fixtures. Their content matters less than their *shape*; keep them simple (single step) so they don't take on a life of their own.

## References

- Phase 4 spec: `features/composed-app-kit-inbox-and-research.md` (status: completed; Verification run section documents the seeded artifacts this feature replaces)
- Phase 4 design: `docs/superpowers/specs/2026-05-02-inbox-and-research-design.md` (locked decision #8 names this feature as the deferred follow-up)
- Phase 4 plan: `docs/superpowers/plans/2026-05-02-composed-app-kit-inbox-and-research.md`
- Existing trigger evaluator (pattern reference): `src/lib/tables/trigger-evaluator.ts`
- Canonical app blueprint pattern: `~/.ainative/apps/habit-tracker/manifest.yaml` + `~/.ainative/blueprints/habit-tracker--weekly-review.yaml`
- CLAUDE.md "Smoke-test budget for runtime-registry-adjacent features" — applies because this feature touches `src/lib/workflows/engine.ts`
- Project memory `feedback-use-client-non-component-helpers.md` (parallel lesson: framework boundaries unit tests can't see)
