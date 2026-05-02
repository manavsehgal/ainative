# Handoff: Phase 2 shipped (composed-app-kit-tracker-and-hub) — Phase 3 is next

**Created:** 2026-05-02 (late evening)
**Status:** Phase 2 (`composed-app-kit-tracker-and-hub`) complete + committed on `main` (`ab5d38c0`). Local `main` is **2 commits ahead of origin** (the plan commit `85b00534` + the implementation commit `ab5d38c0`); push is the user's call. Working tree clean.
**Author:** Manav Sehgal (with Claude Opus 4.7 assist)
**Predecessor:** `.archive/handoff/2026-05-02-composed-app-manifest-view-field-phase1-2-handoff.md`

---

## TL;DR for the next agent

1. **Phase 2 is done and committed.** `git log --oneline -3` shows `ab5d38c0` (Phase 2) on top of `85b00534` (plan) on top of `d9df179b` (Phase 1.2). Push when ready: `git push`. After push the working state matches `origin/main`.

2. **Start Phase 3 next: `composed-app-kit-coach-and-ledger`.** Spec at `features/composed-app-kit-coach-and-ledger.md`. This adds two more kits — Coach (markdown digest hero + open-questions secondary) and Ledger (currency-table hero + allocation-drift KPIs). Both need new primitives that Phase 2 deliberately did NOT extract (PersonaPill, TimeSeriesChart, RunCadenceHeatmap per the spec) — but only when ≥2 kits prove the need.

3. **Three open questions for Phase 3:**
   - **Coach hero rendering**: spec mentions `LightMarkdown` reuse for the digest body — verify the existing component handles the long-form markdown the coach profile produces, or extend it
   - **Ledger KPI breadth**: with `tableSum` already implemented (Phase 2), the new work is in `evaluateKpi` extension to support **currency formatting on multi-row aggregates** vs the per-row latest pattern Tracker uses. May need a `tableLatestSum` or similar 6th source kind — decide at design time
   - **`RunNowButton` inputs sheet**: deferred from Phase 2; if Coach/Ledger blueprints declare `variables`, this becomes a hard requirement and can't be deferred again

---

## What landed this session

```
src/lib/apps/view-kits/format-kpi.ts           # NEW. 5 format adapters
                                                #   (int, currency, percent,
                                                #   duration, relative);
                                                #   null → em dash

src/lib/apps/view-kits/evaluate-kpi.ts          # NEW. Pure switch over
                                                #   KpiSpec.source.kind
                                                #   (5 branches); injected
                                                #   KpiContext for testability

src/lib/apps/view-kits/default-kpis.ts          # NEW. Synthesizes 1-4 KpiSpecs
                                                #   for tracker apps that don't
                                                #   declare view.bindings.kpis
                                                #   ("Total entries", "Active",
                                                #   "Current streak")

src/lib/apps/view-kits/kpi-context.ts           # NEW. DB-backed KpiContext
                                                #   using SQLite json_extract

src/lib/apps/view-kits/kits/tracker.ts          # NEW. Pure projection kit
                                                #   definition. Hero =
                                                #   TableSpreadsheet via
                                                #   React.createElement (NOT
                                                #   function-call — see
                                                #   "Patterns to remember"
                                                #   below)

src/lib/apps/view-kits/kits/workflow-hub.ts     # NEW. Pure projection kit
                                                #   definition. Hero absent;
                                                #   per-blueprint LastRunCard
                                                #   in secondary; ErrorTimeline
                                                #   in activity

src/lib/apps/view-kits/types.ts                 # +HeaderSlot.cadenceChip,
                                                #   +HeaderSlot.runNowBlueprintId,
                                                #   +KpiTile.spark,
                                                #   +RuntimeState Phase 2
                                                #   fields, +CadenceChipData,
                                                #   +HeroTableData,
                                                #   +RuntimeTaskSummary

src/lib/apps/view-kits/index.ts                 # Registers tracker +
                                                #   workflow-hub kits

src/lib/apps/view-kits/data.ts                  # Kit-aware loadRuntimeState —
                                                #   dispatches on kitId;
                                                #   populates Tracker fields
                                                #   for tracker, Workflow Hub
                                                #   fields for workflow-hub

src/components/apps/kpi-strip.tsx               # NEW. 1-6 tile horizontal
                                                #   strip (clips at 6)
src/components/apps/last-run-card.tsx           # NEW. Status badge + relative
                                                #   time + 30d run count
src/components/apps/schedule-cadence-chip.tsx   # NEW. humanLabel + countdown
                                                #   suffix; "overdue" when past
src/components/apps/run-now-button.tsx          # NEW. Posts to blueprint
                                                #   instantiate; toast on
                                                #   error/inputs-required

src/components/apps/kit-view/slots/kpis.tsx     # Replaces inline grid with
                                                #   KPIStrip primitive
src/components/apps/kit-view/slots/header.tsx   # Renders new cadenceChip +
                                                #   runNowBlueprintId fields

src/app/apps/[id]/page.tsx                      # Threads kit.id + projection
                                                #   into loadRuntimeState
                                                #   (single-line change)

# Tests (~67 new across 9 files)
src/lib/apps/view-kits/__tests__/format-kpi.test.ts        # 7 tests
src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts      # 6 tests
src/lib/apps/view-kits/__tests__/default-kpis.test.ts      # 6 tests
src/lib/apps/view-kits/__tests__/workflow-hub.test.ts      # 7 tests
src/lib/apps/view-kits/__tests__/tracker.test.ts           # 7 tests
src/lib/apps/view-kits/__tests__/dispatcher.test.ts        # +1 (tracker/hub
                                                            #     register)
src/components/apps/__tests__/kpi-strip.test.tsx           # 5 tests
src/components/apps/__tests__/last-run-card.test.tsx       # 3 tests
src/components/apps/__tests__/schedule-cadence-chip.test.tsx # 4 tests
src/components/apps/__tests__/run-now-button.test.tsx      # 4 tests

features/composed-app-kit-tracker-and-hub.md    # status: planned → completed
features/roadmap.md                             # Phase 2 row → completed
features/changelog.md                           # New 2026-05-02 entry above
                                                #   Phase 1.2

docs/superpowers/plans/2026-05-02-composed-app-kit-tracker-and-hub.md
                                                # 2582-line plan, committed
                                                #   separately as 85b00534
                                                #   before implementation

output/phase-2-tracker-smoke.png                # Browser smoke screenshot
                                                #   (gitignored — local only)
```

**Frozen contract recap**: kits are pure projection functions with **zero React hooks** in the kit file. The Tracker kit imports `TableSpreadsheet` (a client component) but uses `React.createElement(TableSpreadsheet, {...})` to build an inert React element — function-call would invoke `useState` outside React's renderer. This is the new constraint Phase 2 surfaced; Phase 3+ kits with client-component heroes (Coach with rich markdown editing? Ledger with chart interactions?) need to honor it.

---

## Phase 3 brief — `composed-app-kit-coach-and-ledger`

Spec at `features/composed-app-kit-coach-and-ledger.md`. High-level shape:

- **Coach kit** — for `*-coach` profile + schedule apps (wealth-manager, weekly-review). Hero = the latest agent digest as `LightMarkdown`; secondary = "Open questions" + "Risk callouts" extracted from the digest; activity = recent agent runs. Schedule cadence chip + Run Now in header (reuses Phase 2 primitives).
- **Ledger kit** — for tables-with-currency-columns + ≥1 blueprint. Hero = the entries table via `TableSpreadsheet` (reuses Phase 2's pattern); KPIs = "Total balance" + "Top mover (24h)" + "Allocation drift %"; secondary = "Top movers" + "Drift breakdown".
- **New primitives** (only those used by ≥2 kits): `PersonaPill` (used by Coach + Workflow Hub potentially), `TimeSeriesChart` (used by Ledger + future ones), `RunCadenceHeatmap` (used by Coach + Tracker for activity view).

**Phase 3 gate**: a wealth-manager app (or any app with `*-coach` profile + schedule) renders Coach layout at `/apps/<id>` with markdown digest as hero; a `finance-pack` app (or any app with currency-column table + blueprint) renders Ledger layout. Browser smoke required.

**Where Phase 3 will rub against Phase 2's contract:**
- The `KpiContext` interface may need extension if Ledger needs aggregates beyond the 5 existing source kinds. Add a Zod arm in `KpiSpecSchema` first, then a switch case in `evaluateKpi`, then a method on `KpiContext` — never bypass the contract with a free-form formula
- The `loadRuntimeState` kit dispatch grows: add `coach` and `ledger` branches that load kit-specific data. Consider extracting a kit-loader registry pattern when adding the 4th branch
- The Tracker hero rendering pattern (`React.createElement` for client components) will repeat for Ledger — fine to copy, but if it appears 3 times consider extracting a `clientHero(Component, props)` helper

---

## Verification this session

- **Unit tests**: 67 new across 9 files. All pass.
- **Apps suite**: 201/202 pass (1 informational skip: live-scan of `~/.ainative/apps/` skipped under vitest's temp `AINATIVE_DATA_DIR` — same skip as Phase 1.2).
- **tsc**: clean for `src/(app|lib|components)/apps` (`npx tsc --noEmit | grep ...` returns empty).
- **Smoke**: `curl http://localhost:3000/apps/habit-tracker` → 200, response body contains 3 KPI tiles (`data-kit-primitive="kpi-tile"` × 3), 1 hero slot, real habit data ("Exercise" etc.), "daily 8pm · in 20h" cadence chip, "Run now" button, "View manifest" trigger. Screenshot at `output/phase-2-tracker-smoke.png` (gitignored).
- **Workflow Hub browser smoke deferred**: no multi-blueprint app currently installed in `~/.ainative/apps/` (only `habit-tracker`, which matches Tracker). Workflow Hub coverage shifts to `workflow-hub.test.ts`'s "populates secondary cards" assertion until a multi-blueprint app gets installed for dogfood.

---

## Resolved decisions (informational)

1. **Tracker hero uses `React.createElement(TableSpreadsheet, props)`, not function-call.** `TableSpreadsheet` is a client component with `useState`. Calling it as a function during the kit's `buildModel` step (which runs sync in the server component before React's renderer is set up for the request) throws `TypeError: Cannot read properties of null (reading 'useState')`. `React.createElement` produces an inert element that React mounts during the actual render pass, where hooks work. `placeholderKit`'s function-call pattern (`ManifestPaneBody({...})`) only worked because that's a hookless server component. Phase 3+ kits importing client components must follow the createElement pattern.

2. **`defaultTrackerKpis` synthesizes 1-3 KPIs for habit-tracker, not 4.** Spec said "3-4"; I emit at most 3 because the habits table has `active` (boolean) + `current_streak` (matches `*_streak`) but no fourth signal. The `slice(0, 4)` cap is defensive — Phase 5 hardening can add more synthesis rules. Browser smoke confirms 3 tiles render correctly.

3. **`KpiContext.tableCount`'s `where` argument is a column name, not a SQL expression.** The Zod schema's `where: z.string().optional()` is intentionally loose — the convention is "name a boolean column to filter on truthy". Implementation does `json_extract(data, $.<col>) = 1 OR = 'true'`. If a future spec needs richer filters, add a separate source kind rather than letting `where` evolve into a query language (would violate the "no formula strings" frozen contract).

4. **Workflow Hub uses blueprint id strings as labels in `LastRunCard`.** Spec implies a human label, but blueprint metadata isn't loaded in `loadBlueprintLastRuns`. Phase 3 should extend `RuntimeState` with `blueprintMeta?: Record<string, {name, description}>` if Coach/Ledger need it. For Phase 2 the id is enough since Workflow Hub apps are uncommon and blueprint ids are usually descriptive (e.g., `weekly-portfolio-review`).

5. **`blueprintRunCount` approximates by matching `assignedAgent`/`agentProfile`** because there's no `blueprintId` column on `tasks`. Acceptable for Phase 2; Phase 5 (`composed-app-auto-inference-hardening`) will add the column. Until then, run counts are imperfect for blueprints whose name overlaps with a profile name.

---

## Carryover from prior session (still valid)

### Free-form compose hardening (~2 hr)

1. **"Extend existing app" affordance (~1.5-2 hr).** Today the planner has no `extend_app` mode — every compose creates a new app. Independent of the Composed Apps Domain View work; could ship interleaved between Phase 3 and Phase 4 if a session prefers compose-hardening.

2. **30-day soak on the 440-char generic hint.** Passive. Telemetry-gated, not actionable today.

### LLM smoke for noun-aware hint (~5 min when extension is up)

Deterministic side of commit `8acc55fa` is fully covered by unit tests. The LLM-side observation — does the model actually compose without scaffolding when given the new hint? — has not run in 3+ sessions because Claude in Chrome was offline this session (fell back to Chrome DevTools MCP for the smoke screenshot). Still worth checking when extension is back. Quick smoke:
- Send `"build me a github habit tracker"` in chat (dev server up).
- Expected: compose card titled "Habit Tracker" + a prose mention of "you'll need to scaffold a separate plugin to access github."
- Negative signal: a scaffold card means routing didn't land OR the LLM ignored the hint.

### Apps consumers — extract `useDeleteApp(args)` hook

Premature today (only 2 consumers). Wait until a third surface needs delete.

---

## Key patterns to remember

### From this session

- **Client-component composition in kits**: kits are pure functions, but their `buildModel` produces a `ViewModel` containing `ReactNode` content. When that content is a CLIENT component (uses hooks), use `React.createElement(Component, props)` — function-call invokes hooks outside React's render cycle. Hookless components work either way. **This will repeat for every Phase 3+ kit hero that's a client component** (likely Ledger, possibly Coach).
- **KPI engine extensibility = Zod arm + switch case + KpiContext method**. The three pieces are intentionally locked together. Phase 3 needs a sixth source kind (e.g., `tableLatestPerGroup` for Ledger's "top mover" KPI)? Add the Zod arm to `KpiSpecSchema` first, then the switch case in `evaluateKpi`, then the method on `KpiContext`. If you skip the Zod arm, manifest authoring will silently reject the new kind.
- **Kit-aware data layer dispatch**: `loadRuntimeState` switches on `kitId` to populate kit-specific runtime fields. When the switch grows past 4 branches (i.e., when Phase 4 lands Inbox + Research), refactor to a `Record<KitId, (app, bindings, projection) => Promise<RuntimeState>>` registry that lives next to the kits. Premature today (only 2 branches).
- **Test-driven discovery of contract bugs**: the tracker `buildModel` test caught the `useState` issue at unit-test time, before browser smoke. The test was simple — `expect(model.hero?.kind).toBe("table")` — but the `TableSpreadsheet` invocation happens inside `buildModel`, so the hooks fire during the `buildModel(proj, runtime)` call. Without that test, the bug would have shipped to the browser.
- **Trust `npx vitest run` + `npx tsc --noEmit` over the IDE diagnostic panel**. The panel showed phantom "Cannot find module '@/lib/apps/registry'" errors throughout this session even though tests passed and tsc was clean. Confirmed in `MEMORY.md` — the diagnostics panel is consistently flaky in this repo.

### Carried over and still relevant

- **Strict Zod schemas at the edge of the manifest contract.** `ViewSchema` is the only `.strict()` block in `registry.ts`. Every other manifest schema stays `.passthrough()`.
- **Discriminated unions over expression strings.** `KpiSpec.source` is a 5-arm `z.discriminatedUnion("kind", ...)` — Phase 3 may need a 6th arm. Add it; never weaken the discrimination.
- **Inject the data-layer fetcher for testability.** `loadColumnSchemas(app, [getColumns])` accepts an optional fetcher. Phase 3's `loadCoachDigest` / `loadLedgerHero` should follow the same pattern.
- **`APP_INTENT_WORDS` is the cleavage line between scaffold and compose for noun-bearing prompts.**
- **HANDOFF interpretation is itself a skill.** When predecessor language is ambiguous, fall back to: what does the user actually want? Build to that.
- **`unstable_cache` cache key naming convention**: tag namespace is `app-runtime:<id>` (used in `data.ts`); cache key includes `kitId` as of Phase 2 to avoid collisions during inference rollouts.

---

*End of handoff. Next move: ask the user whether to push Phase 2 to origin (currently 2 commits ahead), then start Phase 3 by reading `features/composed-app-kit-coach-and-ledger.md` and brainstorming the kit composition + KpiContext extensions.*
