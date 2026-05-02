# Composed App Kits — Inbox & Research (Phase 4) — Implementation Design

**Created:** 2026-05-02
**Feature spec:** `features/composed-app-kit-inbox-and-research.md`
**Predecessors:** Phase 1 (`composed-app-view-shell`, `composed-app-manifest-view-field`), Phase 2 (`composed-app-kit-tracker-and-hub`), Phase 3 (`composed-app-kit-coach-and-ledger`)
**Scope mode:** HOLD — maximum rigor on stated scope, no expansion, build out an Error & Rescue Registry
**Status:** approved by user, ready for implementation plan

---

## Locked design decisions

These are the decisions made during the brainstorm that the implementation plan must honor:

1. **Trigger field is metadata-only.** Phase 4 ships `BlueprintBase.trigger?: { kind: "row-insert", table: string }` as a parsed manifest field. `detectTriggerSource(manifest)` reads it for UI affordances (chip + Run Now suppression). The actual event wiring (row-insert → blueprint instantiation) is a separate, deferred feature. This keeps Phase 4 outside the runtime-registry-adjacency that triggers the CLAUDE.md smoke-test budget.
2. **Inbox row → draft selection is URL-driven, server-rendered.** `?row=<rowId>` query param drives both panes. Click on a queue row → `router.replace("?row=<id>")` → server re-renders the right pane from the document linked via the row's matching `documentInputs` FK on the latest draft task. Matches the codebase-wide URL-driven detail pattern (`?detail=`, `?period=`).
3. **Research citation chip click is intra-page client state.** Click handler sets `highlightedRowId` in `ResearchSplitView` (client component); `<DataTable>` receives it as a prop and applies a `data-highlighted` attribute + `scrollIntoView`. No URL hash, no route change. Highlight clears after 2.5s timeout.
4. **`<KitView>` integration tests cover all 6 kits.** Phase 4's wave 7 lands the test infrastructure (a `renderKitView(kit, manifest, runtime)` helper) and writes integration tests for Tracker, Workflow Hub, Coach, Ledger, Inbox, and Research. This closes the wiring-bug class that Phase 3 exposed.
5. **Implementation order is bottom-up waves** (matches Phase 2/3 precedent — see "Implementation order" below).
6. **Browser smoke uses hand-crafted canonical manifests** at `~/.ainative/apps/{customer-follow-up-drafter,research-digest}/manifest.yaml` rather than agent-composed manifests. Phase 3's lesson: surgical smoke beats chat-driven smoke for verifying kit/slot wiring.
7. **Slot views remain content-agnostic.** Today's `HeroSlotView` and `ActivitySlotView` simply render `slot.content` — they don't dispatch on `slot.kind`. Phase 4 follows the same pattern Coach/Ledger established: kits build content via `createElement(InboxSplitView, {...})` / `createElement(ResearchSplitView, {...})` / `createElement(ThroughputStrip, {...})` / `createElement(RunHistoryTimeline, {...})` inside `buildModel`. The `kind` field on slot types remains intent annotation, not a dispatch key. **No type changes to `HeroSlot` / `ActivityFeedSlot` beyond optional new union members on `kind` for documentation.**
8. **Add a small schema column to link queue rows to their draft tasks.** Phase 4 introduces `tasks.contextRowId TEXT` (nullable) — populated when a task is triggered by a specific user-table row. This unblocks Inbox's "draft for the selected row" UX without taking on engine-wiring scope. The column is a no-op for existing tasks. Migration + `bootstrap()` `addColumnIfMissing` + Drizzle `schema.ts` + `clear.ts` no-action-needed (column lives on existing tasks table). The blueprint engine populating `contextRowId` for actual row-insert events is part of the deferred `row-trigger-blueprint-execution` feature; Phase 4's smoke seeds it manually via SQL.

---

## What already exists (do not rebuild)

**Kit framework — stable contracts:**
- `KitDefinition`, `ResolveInput`, `RuntimeState`, `ViewModel`, `KitId`, `HeaderSlot`, `KpiTile`, `HeroSlot`, `SecondarySlot`, `ActivityFeedSlot`, `ManifestPaneSlot` — all in `src/lib/apps/view-kits/types.ts`. Phase 4 extends `KitId` (`"inbox" | "research"` already enumerated), adds `inboxQueueRows`, `inboxSelectedRowId`, `inboxDraftDocument`, `researchSources`, `latestSynthesisDocId`, `researchCitations`, `researchRecentRuns`, and `triggerSourceChip` to the relevant types.
- `<KitView>` server component dispatching slots — `src/components/apps/kit-view/kit-view.tsx`. Phase 4 doesn't touch this; the new slot kinds plug into the existing `HeroSlotView`/`ActivitySlotView` switch.
- Slot views (`HeaderSlotView`, `KpisSlotView`, `HeroSlotView`, `SecondarySlotView`, `ActivitySlotView`, `FooterSlotView`) — Phase 4 extends `HeaderSlotView` (`triggerSourceChip` render), `HeroSlotView` (two new kinds), and `ActivitySlotView` (two new kinds).

**Header chips & actions:**
- `RunNowButton`, `RunNowSheet`, `VariableInput` — Phase 2/3 components, fully wired
- `PeriodSelectorChip`, `CadenceChip` — Phase 3 components

**Document/detail primitives:**
- `LightMarkdown` — markdown renderer used by Coach hero
- `DocumentChipBar` — `src/components/documents/document-chip-bar.tsx` — already renders a chip per document; will need an additive `onChipClick(rowId)` callback for Research citation flow
- `DocumentDetailView` — `src/components/documents/document-detail-view.tsx` — embeds editable document body
- `DetailPane` (Sheet variant) + `DetailPaneProvider` — URL-driven (`useSearchParams`/`useRouter`) — *we don't mount the Sheet* but reuse the URL convention

**Dashboard primitives:**
- `PriorityQueue` — `src/components/dashboard/priority-queue.tsx` — already renders a queue list; Inbox kit reuses it
- `ActivityFeed` — generic feed primitive; `RunHistoryTimeline` (new) wraps similar render with run-level granularity
- `ErrorTimeline` — `src/components/workflows/error-timeline.tsx` — Workflow Hub still uses it; re-skin to `RunHistoryTimeline` is explicitly deferred

**Table primitives:**
- `FilterBar`, `DataTable` — Research kit reuses both
- `TransactionsTable` — Phase 3.1, Ledger-specific, not reused here

**Data layer:**
- `loadEvaluatedKpis` — Phase 2 KPI evaluator
- `unstable_cache` keyed loaders — Phase 2/3 pattern; Phase 4 adds `(appId, rowId)` and `(appId, blueprintId, "synthesis")` cache keys
- `loadAppDetail`, `loadColumnSchemas` — page-level data wiring

**Manifest:**
- `AppManifest` Zod schema (`src/lib/apps/registry.ts`) — Phase 4 adds **only one** additive field: `BlueprintBase.trigger?: { kind: "row-insert", table: string }`. No breaking changes.

**DB:**
- `documents.taskId` FK already exists (document → originating task). Phase 4 uses this for both Inbox draft loading and Research citation source mapping.
- **Phase 4 adds one new column:** `tasks.contextRowId TEXT NULL` (no-op default for existing rows). See locked decision #8. Requires migration SQL + `bootstrap()` `addColumnIfMissing` + Drizzle `schema.ts` sync per project DB conventions (CLAUDE.md "Always verify DB migrations" + MEMORY.md `bootstrap()` lesson).
- `clear.ts` requires no change (column lives on the existing `tasks` table, which is already cleared).

**Smoke fixture pattern:**
- `~/.ainative/apps/<id>/manifest.yaml` — Phase 3 used this for surgical smokes; Phase 4 extends with two new files. Local-only, gitignored.

---

## Architecture overview

Two new kits (`InboxKit`, `ResearchKit`) registered in the view-kit registry alongside the existing four. One new shared primitive (`RunHistoryTimeline`). Four new slot renderer kinds (`inbox-split`, `research-split`, `throughput-strip`, `run-history-timeline`). One new header field (`triggerSourceChip`). One new helper (`detectTriggerSource`). One additive manifest field (`BlueprintBase.trigger`). One new test infrastructure helper (`renderKitView`). Six new integration test files.

Total surface area:
- Files modified: ~12 (types, slot views, registry, manifest schema, page wiring, existing kit registrations)
- Files added: ~14 (2 kits, 1 primitive, 4 slot view extensions or co-located helpers, 1 helper, 1 test util, 6 integration test files, 2 starter manifests)

---

## Component design

### `RunHistoryTimeline` — new shared primitive

```ts
// src/components/apps/run-history-timeline.tsx
"use client";

export interface TimelineRun {
  id: string;
  status: "running" | "completed" | "failed" | "queued";
  startedAt: string;        // ISO
  durationMs?: number;
  outputDocumentId?: string;
}

interface RunHistoryTimelineProps {
  runs: TimelineRun[];
  onSelect?: (runId: string) => void;
  emptyHint?: string;       // override default "No runs yet"
}

export function RunHistoryTimeline(props: RunHistoryTimelineProps): JSX.Element;
```

- Vertical timeline. Each row: status icon (existing `taskStatusVariant` colors), relative timestamp ("2h ago"), duration when present, optional click-to-open behavior.
- Empty-state branch when `runs.length === 0`: "No runs yet" placeholder, never zero-height.
- Pure presentation — no fetching, no data-loading. Used by `ActivitySlotView`'s `run-history-timeline` kind.

### `InboxKit`

```ts
// src/lib/apps/view-kits/kits/inbox.ts
export const inboxKit: KitDefinition = {
  id: "inbox",
  resolve(input) {
    // Pulls queueTableId, draftBlueprintId, triggerSource (via detectTriggerSource)
    // Returns InboxProjection
  },
  buildModel(proj, runtime) {
    // Returns ViewModel with:
    //   header.triggerSourceChip = inferred from manifest
    //   header.runNowBlueprintId = undefined when triggerSource === "row-insert"
    //   hero  = { kind: "inbox-split", queueTableId, queue: runtime.inboxQueueRows,
    //              selectedRowId: runtime.inboxSelectedRowId, draftDoc: runtime.inboxDraftDocument }
    //   activity = { kind: "throughput-strip", blueprintId, sentimentColumn? }
    //   footer = ManifestPaneSlot
  }
};
```

### `ResearchKit`

```ts
// src/lib/apps/view-kits/kits/research.ts
export const researchKit: KitDefinition = {
  id: "research",
  resolve(input) {
    // Pulls sourcesTableId, synthesisBlueprintId, cadenceScheduleId
  },
  buildModel(proj, runtime) {
    // Returns ViewModel with:
    //   header   = { cadenceChip, runNowBlueprintId, runNowVariables, kpis: [Sources, LastSynthAge] }
    //   hero     = { kind: "research-split", sourcesTableId, sources, synthesisDoc, citations }
    //   activity = { kind: "run-history-timeline", runs }
    //   footer   = ManifestPaneSlot
  }
};
```

### `detectTriggerSource(manifest)` helper

```ts
// src/lib/apps/view-kits/detect-trigger-source.ts
export type TriggerSource =
  | { kind: "row-insert"; table: string; blueprintId: string }
  | { kind: "schedule"; scheduleId: string; blueprintId: string }
  | { kind: "manual"; blueprintId?: string };

export function detectTriggerSource(
  manifest: AppManifest,
  preferredBlueprintId?: string
): TriggerSource;
```

State machine:
```
                          detectTriggerSource(manifest, preferredBlueprintId?)
                                        │
                                        ▼
                    ┌───────────────────┴───────────────────┐
                    │ Any blueprint.trigger?.kind ===       │
                    │ "row-insert" AND trigger.table is in  │
                    │ manifest.tables[*].id ?               │
                    └─────────┬─────────────────┬───────────┘
                          yes │              no │
                              ▼                 ▼
                      ┌──────────────┐   ┌─────────────────────────────┐
                      │ "row-insert" │   │ Any schedule.runs           │
                      │ (preferred   │   │ references a blueprint      │
                      │  blueprint   │   │ matching preferredBlueprintId│
                      │  if matches, │   │ (or any blueprint if no     │
                      │  else first) │   │ preference)?                │
                      └──────────────┘   └────────┬────────────┬───────┘
                                              yes │         no │
                                                  ▼            ▼
                                          ┌────────────┐  ┌──────────┐
                                          │ "schedule" │  │ "manual" │
                                          └────────────┘  └──────────┘
```

Validation: if `trigger.table` references a non-existent table, fall through to schedule/manual (with a `console.warn` for diagnostics). Two row-insert triggers in one manifest: prefer the one matching `preferredBlueprintId`, else first match.

### Slot renderer changes

Per locked decision #7, slot views remain content-agnostic. Concretely:

- `src/components/apps/kit-view/slots/header.tsx` — **does** change: Phase 4 adds rendering for `slot.triggerSourceChip` (a new optional field on `HeaderSlot`). Header is the only slot view that dispatches on its data shape because chips are typed individually (`cadenceChip`, `periodChip`, and now `triggerSourceChip`).
- `src/components/apps/kit-view/slots/hero.tsx` — **does NOT change**. It already renders `slot.content` opaquely. Inbox kit's `buildModel` returns `hero: { kind: "custom", content: createElement(InboxSplitView, {...}) }`; same pattern for Research with `ResearchSplitView`.
- `src/components/apps/kit-view/slots/activity.tsx` — **does NOT change**. Inbox returns `activity: { content: createElement(ThroughputStrip, {...}) }`; Research returns `activity: { content: createElement(RunHistoryTimeline, {...}) }`.

The `HeroSlot.kind` and `ActivityFeedSlot` types may gain new string-literal members (`"inbox-split"`, `"research-split"`, `"throughput-strip"`, `"run-history-timeline"`) for documentation purposes, but nothing in the runtime dispatches on them. This is the same trick Phase 3 used with `kind: "custom"` for Coach/Ledger.

### New client components

- `src/components/apps/inbox-split-view.tsx` — `"use client"`. Holds the row-click handler that calls `router.replace("?row=<id>")`. Reads `?row` from `useSearchParams` for synchronization. Renders `<PriorityQueue>` + draft pane.
- `src/components/apps/research-split-view.tsx` — `"use client"`. Holds `highlightedRowId` state for citation highlight + scroll. Renders `<DataTable>` (with highlight prop) + `<LightMarkdown>` synthesis + `<DocumentChipBar>` (with `onChipClick` callback wired to `setHighlightedRowId`).
- `src/components/apps/throughput-strip.tsx` — `"use client"`. Wraps existing `MiniBar` and `DonutRing` chart primitives.
- `src/components/apps/trigger-source-chip.tsx` — `"use client"` only if needed for tooltip; can be server. Renders the chip with appropriate label ("Triggered by row insert in customer-touchpoints", "Scheduled weekly", "Manual").

---

## Data flow diagrams

### Inbox

```
                            URL: /apps/customer-follow-up-drafter?row=r123
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │ src/app/apps/[id]/page.tsx   │
                               │ - parses ?row from query     │
                               │ - resolveKit + load           │
                               │   RuntimeStateUncached(row)   │
                               └──────────────┬───────────────┘
                                              │
        ┌─────────────────────────────────────┼─────────────────────────────────────┐
        ▼                                     ▼                                     ▼
┌──────────────────┐              ┌──────────────────────┐              ┌──────────────────────┐
│ resolveKit       │              │ loadInboxQueue(...)  │              │ loadInboxDraft(rowId)│
│ → InboxKit       │              │ → user_table_rows[]  │              │ → documents row      │
│                  │              │   filtered by         │              │   linked via tasks.   │
│                  │              │   manifest queueFilter│              │   documentInputs FK   │
└──────────┬───────┘              └──────────┬───────────┘              └──────────┬───────────┘
           │                                 │                                     │
           ▼                                 ▼                                     ▼
   InboxKit.buildModel(proj, runtime { inboxQueueRows, inboxSelectedRowId, inboxDraftDocument })
                                              │
                                              ▼
                  ┌─────────────────────────────────────────────┐
                  │ ViewModel                                    │
                  │   header: { triggerSourceChip: "row-insert" }│
                  │   hero:   { kind: "inbox-split", ... }       │
                  │   activity: { kind: "throughput-strip" }     │
                  │   footer:  ManifestPaneSlot                  │
                  └──────────────────────┬──────────────────────┘
                                         │
                                         ▼
                                <KitView model={...} />
                                         │
                                         ▼
                            <InboxSplitView> (client)
                                         │
                              row click → router.replace("?row=r456")
                                         │
                                         ▼
                                   server re-render
```

### Research

```
                            URL: /apps/research-digest
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │ src/app/apps/[id]/page.tsx   │
                               │ - resolveKit + load           │
                               │   RuntimeStateUncached        │
                               └──────────────┬───────────────┘
                                              │
        ┌─────────────────────────────────────┼─────────────────────────────────────┐
        ▼                                     ▼                                     ▼
┌──────────────────┐              ┌──────────────────────┐              ┌──────────────────────┐
│ loadResearchSrcs │              │ loadLatestSynthesis  │              │ loadRecentRuns       │
│ → user_table_rows│              │ → tasks.result of    │              │ → tasks[] limit 10   │
│   (URL/text cols)│              │   latest completed   │              │   for blueprintId,    │
│                  │              │   synthesis + linked  │              │   shaped as           │
│                  │              │   documentInputs[]    │              │   TimelineRun[]      │
└──────────┬───────┘              └──────────┬───────────┘              └──────────┬───────────┘
           │                                 │                                     │
           ▼                                 ▼                                     ▼
                ResearchKit.buildModel(proj, runtime { researchSources,
                                                       latestSynthesisDocId,
                                                       researchCitations,
                                                       researchRecentRuns })
                                              │
                                              ▼
                  ┌─────────────────────────────────────────────┐
                  │ ViewModel                                    │
                  │   header:   cadenceChip + runNow + kpis      │
                  │   hero:     { kind: "research-split", ... }  │
                  │   activity: { kind: "run-history-timeline" } │
                  │   footer:   ManifestPaneSlot                 │
                  └──────────────────────┬──────────────────────┘
                                         │
                                         ▼
                                <KitView model={...} />
                                         │
                                         ▼
                          <ResearchSplitView> (client)
                                         │
                          chip click → setHighlightedRowId("src-42")
                                         │
                                         ▼
                       <DataTable> row gets data-highlighted="true"
                                         │
                                         ▼
                              scrollIntoView + 2.5s clear
```

---

## Error & Rescue Registry

| Error | Trigger | Impact | Rescue |
|-------|---------|--------|--------|
| Inbox row's linked draft document doesn't exist | Row created before blueprint ran, or blueprint failed mid-execution | Right pane has no content | Inbox draft loader: `SELECT * FROM tasks WHERE projectId = ? AND contextRowId = ? ORDER BY createdAt DESC LIMIT 1` then JOIN `documents` on `taskId`. If no task or no document → show explicit `EmptyState` "No draft yet" + a `RunNowButton` scoped to this row (only when `triggerSource === "manual"` — for `row-insert`, show "Drafting in progress" without action) |
| Inbox queue table missing the `sentiment` column | Manifest declares queue table without that column | `ThroughputStrip` would render an empty DonutRing | `ThroughputStrip` reads `manifest.tables[*].columns[*]` to detect column presence; renders `<MiniBar>` only if absent |
| Research synthesis blueprint never run | Brand-new app, schedule hasn't fired and no manual run | `latestSynthesisDocId` is null | Hero shows `EmptyState` "No synthesis yet" + `RunNowButton`; activity timeline shows "No runs yet" empty branch |
| Citation chip refers to deleted source row | Source row deleted between synthesis run and view | Click does nothing; user confusion | `ResearchSplitView` validates row existence in `props.sources`; renders chip with `data-stale="true"` styling, click shows toast "Source no longer in table" |
| `RunHistoryTimeline.runs` is empty | New app, no runs yet | Component would render zero-height div | Empty-state branch in component itself: "No runs yet" placeholder, configurable via `emptyHint` prop |
| Manifest declares trigger field but `trigger.table` references a non-existent table | Authoring error, table renamed, or partial deletion | UI shows generic "row-insert" chip and suppresses Run Now even though the trigger never fires | `detectTriggerSource` validates table existence against `manifest.tables[*].id`. Falls back to schedule (if any) or manual. Logs `console.warn` for developer visibility |
| Two blueprints both declare row-insert triggers in one manifest | Authoring ambiguity | UI must pick one to show in the chip | `detectTriggerSource` accepts `preferredBlueprintId` (the kit's `runsBlueprintId`) — picks that match if present, else first match. Document precedence in JSDoc |
| Server re-render on rapid row-click feels laggy (>500ms) | Inbox queue with many transactions, no caching | UX feels slow | Wrap `loadInboxDraft` in `unstable_cache` keyed on `(appId, rowId)` with 60s TTL; revalidate on `/api/documents/[id]` mutation tag |
| URL `?row=<id>` references a row that's no longer in the queue | Row removed from queue (status changed to "responded") between click and render | Empty draft pane, no clear feedback | `loadInboxDraft` returns null + `inboxSelectedRowId === null`; UI shows "Row no longer in queue" message; queue auto-selects first remaining row |
| `tasks.contextRowId` is null on tasks created by chat or manual Run Now | Row-trigger engine wiring is deferred; pre-Phase-4 tasks won't have the field set | Inbox draft pane shows "No draft yet" for those rows | Acceptable for Phase 4: smoke fixture seeds `contextRowId` manually via SQL. After `row-trigger-blueprint-execution` ships, all row-triggered tasks will set the column. Inbox is honest about absence (empty state, not silent pass-through) |
| `loadResearchSources` returns 100s of rows | Large knowledge base | Server payload heavy, slow render | Cap at 50 rows for initial load; Phase 4 doesn't add pagination (deferred); document the cap in the data loader |
| Citation chip click handler fires before `<DataTable>` mounts | First-paint race condition | scrollIntoView no-ops | Use `useLayoutEffect` for `highlightedRowId` synchronization; provide a 1-frame microtask delay before scroll |
| Phantom IDE "Cannot find module" diagnostics | New files added | Annoying but not blocking | Trust `npx tsc --noEmit` per project lesson; document in commit message if reviewer is confused |

---

## Testing strategy

**Unit tests (per file):**

- `src/lib/apps/view-kits/kits/__tests__/inbox.test.ts` — resolve covers each `triggerSource` branch (row-insert, schedule, manual), missing-table fallback, dual-trigger conflict; buildModel covers populated + empty queue, populated + null draft.
- `src/lib/apps/view-kits/kits/__tests__/research.test.ts` — resolve covers explicit bindings, default first-table/first-blueprint fallbacks; buildModel covers populated + empty sources, populated + null synthesis, populated + zero citations.
- `src/lib/apps/view-kits/__tests__/detect-trigger-source.test.ts` — 5 branches.
- `src/components/apps/__tests__/run-history-timeline.test.tsx` — empty, populated, click handler, status icon mapping, relative timestamp formatting.
- `src/components/apps/__tests__/inbox-split-view.test.tsx` — row click triggers `router.replace`, empty draft renders correctly, draft renders `<DocumentDetailView>`.
- `src/components/apps/__tests__/research-split-view.test.tsx` — citation chip click sets highlight, deleted-row chip shows toast, scroll triggers on highlight change.
- `src/components/apps/__tests__/throughput-strip.test.tsx` — sentiment column present/absent, MiniBar always renders, DonutRing conditional.
- `src/components/apps/__tests__/trigger-source-chip.test.tsx` — three labels for three triggerSource kinds.
- Slot renderer extensions — co-located tests in existing `header.test.tsx`/`hero.test.tsx`/`activity.test.tsx` files where they exist.

**Integration tests (`<KitView>` end-to-end DOM assertions):**

New test infrastructure: `src/lib/apps/view-kits/__tests__/render-kit-view.tsx` (a test util):
```tsx
export function renderKitView(args: {
  kit: KitDefinition;
  manifest: AppManifest;
  columns: ColumnSchemaRef[];
  runtime: Partial<RuntimeState>;     // merged with defaults
  period?: "mtd" | "qtd" | "ytd";
}): RenderResult & { model: ViewModel };
```

Six new test files using this util:
- `src/lib/apps/view-kits/__tests__/integration/tracker-kit-view.test.tsx`
- `src/lib/apps/view-kits/__tests__/integration/workflow-hub-kit-view.test.tsx`
- `src/lib/apps/view-kits/__tests__/integration/coach-kit-view.test.tsx`
- `src/lib/apps/view-kits/__tests__/integration/ledger-kit-view.test.tsx`
- `src/lib/apps/view-kits/__tests__/integration/inbox-kit-view.test.tsx`
- `src/lib/apps/view-kits/__tests__/integration/research-kit-view.test.tsx`

Each integration test asserts: header renders expected chips, KPI tiles render with correct values, hero renders, secondary slots render when present, activity slot renders. Asserts via `data-kit-slot="..."` markers and `data-testid` attributes. **These tests would have caught all 3 Phase 3 wiring bugs.**

**Browser smoke (Playwright A/B per Phase 3 pattern):**

- `customer-follow-up-drafter` smoke: hand-crafted manifest at `~/.ainative/apps/customer-follow-up-drafter/manifest.yaml` declaring `view.kit: inbox` + a blueprint with `trigger: { kind: "row-insert", table: "customer-touchpoints" }`. Seed 3 queue rows in `customer-touchpoints` user table. Verify: chip renders "Triggered by row insert in customer-touchpoints", queue shows 3 rows, clicking a row updates URL + draft pane, Run Now suppressed.
- `research-digest` smoke: hand-crafted manifest at `~/.ainative/apps/research-digest/manifest.yaml` declaring `view.kit: research`. Seed 3 source rows + 1 fake synthesis task with `documentInputs` linking 2 sources. Verify: cadence chip, Run Now visible, sources DataTable renders, synthesis renders with 2 citation chips, click chip → row scrolls + highlights for 2.5s.
- Regression: re-verify Tracker, Workflow Hub, Coach, Ledger smokes from Phase 3.

---

## Implementation order (waves)

```
Wave 1 — Types, manifest contract, and DB migration
  - HeaderSlot.triggerSourceChip
  - HeroSlot kind union extended (documentation only, no runtime dispatch)
  - RuntimeState extensions: inboxQueueRows / inboxSelectedRowId / inboxDraftDocument /
    researchSources / latestSynthesisDocId / researchCitations / researchRecentRuns
  - BlueprintBase.trigger?: { kind: "row-insert", table: string } — Zod additive
  - tasks.contextRowId TEXT column: SQL migration + bootstrap addColumnIfMissing +
    Drizzle schema.ts sync (no clear.ts change needed)
  - Unit tests for Zod schema acceptance/rejection

Wave 2 — RunHistoryTimeline primitive
  - Component + empty-state + status icons + relative timestamps
  - Unit tests

Wave 3 — Helpers
  - detectTriggerSource(manifest, preferred?) + tests
  - Inbox throughput-strip helpers (sentiment column detector)

Wave 4 — Slot renderer extensions
  - <TriggerSourceChip> + header.tsx integration
  - hero.tsx + InboxSplitView + ResearchSplitView (new client components)
  - activity.tsx + ThroughputStrip + RunHistoryTimeline integration
  - Co-located unit tests

Wave 5 — Kit definitions
  - inboxKit + tests
  - researchKit + tests
  - Registry registration in pickKit

Wave 6 — Data loaders + page wiring
  - loadInboxQueue, loadInboxDraft (unstable_cache keyed on appId+rowId)
  - loadResearchSources, loadLatestSynthesis (unstable_cache keyed on appId+blueprintId)
  - loadRecentRuns (TimelineRun shape)
  - src/app/apps/[id]/page.tsx — parse ?row, plumb through resolveKit + RuntimeState
  - Hand-crafted smoke manifests in ~/.ainative/apps/

Wave 7 — <KitView> integration test infrastructure (HOLD investment)
  - renderKitView(args) helper
  - 6 integration tests (Tracker, Hub, Coach, Ledger, Inbox, Research)

Wave 8 — Browser smoke (Playwright A/B)
  - customer-follow-up-drafter, research-digest
  - Tracker/Hub/Coach/Ledger regression check
```

---

## NOT in scope (explicit deferrals with rationale)

- **Engine wiring for `trigger: { kind: "row-insert" }`** — defer to follow-up feature `row-trigger-blueprint-execution`. Wiring real row-insert events to blueprint execution requires touching `src/lib/workflows/engine.ts` + scheduler + a row-event hook in the user-table mutation API. That's a meaningful surface that needs its own brainstorm + smoke budget. Phase 4 ships only the manifest field + UI affordance.
- **Bidirectional channel chat for Inbox responses** — separate feature `bidirectional-channel-chat`. Needs design for channel auth (email, Slack, in-app), threading model, send-action surfaces. Significantly more scope than UI rendering.
- **Auto-tagging or sentiment scoring of queue items** — would require a new agent profile (sentiment-scorer) + column mutation pipeline triggered on row insert. Use existing column metadata only.
- **Real-time SSE updates for queue items** — current pattern is page-level refetch on user action. Adding SSE has connection-lifecycle complexity that fits a dedicated `realtime-app-views` feature.
- **Search/filter UX inside Research's `DataTable` beyond existing FilterBar** — defer to user feedback. Existing FilterBar handles tag filter + read/unread chip per spec; adding free-text search is a follow-up.
- **Re-skinning Workflow Hub's activity slot to use `RunHistoryTimeline`** — the existing `ErrorTimeline` works. Re-skin is a one-line swap when desired and doesn't justify riding with Phase 4.
- **Pagination of Research sources** — Phase 4 caps at 50 rows. Pagination ships when a user reports the cap.
- **Mobile-specific layouts for split panes** — split-pane on small viewports stacks vertically by default (Tailwind `flex-col md:flex-row`); fancier mobile UX deferred.
- **Accessibility deep-pass on new components** — components inherit existing focus-visible / keyboard / aria patterns from primitives they wrap (PriorityQueue, DataTable, DocumentChipBar). Dedicated a11y audit is a follow-up.

---

## File-level change list

**New files (~14):**
- `src/lib/apps/view-kits/kits/inbox.ts`
- `src/lib/apps/view-kits/kits/research.ts`
- `src/lib/apps/view-kits/detect-trigger-source.ts`
- `src/lib/apps/view-kits/kits/__tests__/inbox.test.ts`
- `src/lib/apps/view-kits/kits/__tests__/research.test.ts`
- `src/lib/apps/view-kits/__tests__/detect-trigger-source.test.ts`
- `src/lib/apps/view-kits/__tests__/render-kit-view.tsx` (helper, not a test)
- `src/lib/apps/view-kits/__tests__/integration/{tracker,workflow-hub,coach,ledger,inbox,research}-kit-view.test.tsx` (6 files)
- `src/components/apps/run-history-timeline.tsx`
- `src/components/apps/inbox-split-view.tsx`
- `src/components/apps/research-split-view.tsx`
- `src/components/apps/throughput-strip.tsx`
- `src/components/apps/trigger-source-chip.tsx`
- Tests for each new component (5 files)
- `~/.ainative/apps/customer-follow-up-drafter/manifest.yaml` (smoke fixture, gitignored)
- `~/.ainative/apps/research-digest/manifest.yaml` (smoke fixture, gitignored)

**Modified files (~12):**
- `src/lib/apps/view-kits/types.ts` — RuntimeState extensions, HeaderSlot.triggerSourceChip, HeroSlot/ActivityFeedSlot kind unions
- `src/lib/apps/registry.ts` — Zod schema additive `BlueprintBase.trigger`
- `src/lib/apps/view-kits/dispatcher.ts` (or wherever `pickKit` lives) — register inboxKit + researchKit
- `src/lib/apps/view-kits/data.ts` — Inbox/Research data-loader branches in `loadRuntimeStateUncached`
- `src/components/apps/kit-view/slots/header.tsx` — render `<TriggerSourceChip>`, suppress Run Now for row-insert
- `src/components/apps/kit-view/slots/hero.tsx` — `inbox-split` + `research-split` cases
- `src/components/apps/kit-view/slots/activity.tsx` — `throughput-strip` + `run-history-timeline` cases
- `src/app/apps/[id]/page.tsx` — parse `?row` query param, pass to data loader
- Possibly `src/components/documents/document-chip-bar.tsx` — additive `onChipClick` prop (only if existing prop surface is insufficient)
- Existing kit tests if they touch slot interfaces affected by additive changes (smoke risk: low, since changes are additive)
- `features/composed-app-kit-inbox-and-research.md` — status `planned` → `in-progress` then `completed`
- `features/changelog.md` — Phase 4 entry

---

## Acceptance criteria (from feature spec, validated against this design)

All acceptance criteria from `features/composed-app-kit-inbox-and-research.md` are addressable by the design above. Specifically:

- ✅ `RunHistoryTimeline` exists — Wave 2
- ✅ InboxKit renders for customer-follow-up-drafter — Waves 4-6
- ✅ Trigger-source chip shown, Run Now suppressed for row-insert — Waves 3-4
- ✅ ResearchKit renders for research-digest — Waves 4-6
- ✅ Citation chips clickable + highlight matching row — Wave 4 + Wave 6 client component
- ✅ Manifest auto-inference picks `inbox`/`research` — relies on existing `pickKit` rules; Wave 5 may extend `pickKit` decision table
- ✅ `detectTriggerSource` correctness across 5 branches — Wave 3 unit tests
- ✅ Unit tests for kits — Wave 5
- ✅ Browser smoke for both apps — Wave 8
- ✅ All earlier kits still pass smokes — Wave 8 regression

---

## Open questions for the implementation plan

These are not blockers to spec approval but should be resolved when writing the plan:

1. Does `pickKit` (the manifest-inference decision table) need additional rules for Inbox/Research, or do the existing rules already select them when `view.kit` is declared? If declared-only, fine; if inference is desired, document the new rules.
2. Is there an existing `MiniBar`/`DonutRing` chart component in `src/components/charts/`, or do we need new tiny chart primitives for `<ThroughputStrip>`? (Phase 3 added chart primitives; verify reusability.)
3. The Phase 4 spec mentions an additive `onChipClick(rowId)` prop for `DocumentChipBar`. Is the existing prop surface sufficient (e.g., does it already accept arbitrary children?), or is a real new prop needed?
4. Naming: the new column on tasks is `contextRowId` (string FK to `user_table_rows.id`). If a parallel context concept emerges later (e.g., `contextDocumentId`), do we want a single JSON `triggerContext` column instead? Plan should pick one; current decision is `contextRowId` for explicitness and indexability.

## Self-review notes (resolved)

These were caught during the spec self-review pass and corrected inline. Captured here so the implementation plan honors them:

- **Slot views are content-agnostic.** Initial draft assumed Phase 4 would extend `HeroSlotView` / `ActivitySlotView` to dispatch on `kind`. Reality: those views just render `slot.content`. The cleaner approach (already used by Coach/Ledger) is to put `createElement(...)` inside `buildModel` and let the slot view stay simple. Locked in decision #7.
- **No `tasks.documentInputs` field.** The original Phase 4 feature spec referenced an FK that doesn't exist in the schema. Without a row→task linkage, Inbox can't render "draft for the selected row". Resolved by adding `tasks.contextRowId` (locked decision #8). The blueprint engine populating it for real row-insert events is part of the deferred follow-up feature; Phase 4 ships the column + UI loader + smoke seed only.

---

*End of design. Proceed to implementation plan via `superpowers:writing-plans`.*
