---
title: Composed App Kits — Coach & Ledger (design)
date: 2026-05-02
phase: 3
feature: composed-app-kit-coach-and-ledger
predecessor: features/composed-app-kit-tracker-and-hub.md (Phase 2)
status: design — pending user approval
scope_mode: HOLD
---

# Phase 3 Design — Coach & Ledger Kits

## Purpose

Add two domain-specific kits to the composed-apps view-kit registry:

- **Coach** — for `*-coach` profile + schedule apps (e.g., `weekly-portfolio-check-in`). Hero is the latest agent digest rendered as full GitHub-flavored markdown; secondary panes show cadence heatmap and recent rows; activity strip lists recent runs.
- **Ledger** — for currency-shaped tables + ≥1 blueprint (e.g., `finance-pack`). Hero pairs a `TimeSeriesChart` with a `DonutRing`; secondary is a transactions table; KPIs span Net / Inflow / Outflow / Run-rate. Period selector (MTD/QTD/YTD) re-scopes KPIs and chart at request time.

Both kits build on the frozen contracts established in Phase 2: pure projection functions, kit-aware data dispatch, evaluated KPIs from a discriminated-union spec.

## Decisions (locked during brainstorming)

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Scope mode | **HOLD** | Spec is well-bounded; new contracts deserve rigor over ambition. |
| 2 | Coach markdown | **`react-markdown` + `remark-gfm`**, isolated to `LastRunCard variant="hero"` | `LightMarkdown`'s own docstring defers tables/code-fences/GFM to ReactMarkdown. Both deps already in `package.json`. `LightMarkdown` stays unchanged for compact callers. |
| 3 | Citations bar | **Defer to Phase 4** | `DocumentChipBar` is the document-detail editor (delete/unlink/project-select), wrong primitive for read-only citations. A `DocumentCitationStrip` would pull document loading into Coach. Phase 4's Inbox kit needs document loading anyway — defer there. |
| 4 | KpiContext extension | **New source kind `tableSumWindowed`** with optional `sign` and `window` fields | Preserves discriminated-union discipline (Phase 2's frozen contract). Sign + window orthogonal; period scoped via `userTableRows.createdAt`. Period flows URL → page → projection (no runtime override magic). |
| 5 | RunNowButton inputs sheet | **Extract `VariableInput`** from `blueprint-preview.tsx` to `src/components/workflows/variable-input.tsx`; new `RunNowSheet` opens conditionally only when blueprint declares variables (pre-fetched server-side via `getBlueprint(id)` into projection). Pure validator helper `validateVariables(values, defs) → { errors: Record<string, string> }` extracted to `src/lib/workflows/blueprints/validate-variables.ts` for unit-test access. | DRY-with-judgment: second use justifies extraction. Asymmetric UX (sheet only when needed) reduces friction. Server-side pre-fetch is in-memory registry lookup, no extra round trip. |

## File map

```
NEW PRIMITIVES (charts):
  src/components/charts/
    time-series-chart.tsx          # recharts AreaChart wrapper, 30d/90d/mtd/qtd/ytd
    run-cadence-heatmap.tsx        # 12wk × 7d grid, success/fail dots
                                   #   borrows SVG technique from playbook/adoption-heatmap.tsx

NEW PRIMITIVES (apps):
  src/components/apps/
    run-now-sheet.tsx              # Sheet body: VariableInput grid + Submit
    period-selector-chip.tsx       # MTD/QTD/YTD chip group (client; updates ?period=)
    ledger-hero-panel.tsx          # composes TimeSeriesChart + DonutRing
    transactions-table.tsx         # read-only table for Ledger secondary
    monthly-close-summary.tsx      # collapsed markdown of latest monthly-close run
    run-history-strip.tsx          # horizontal scroll of recent run cards (Coach)

EXTRACTED PRIMITIVE:
  src/components/workflows/
    variable-input.tsx             # extracted from blueprint-preview.tsx (zero behavior change)
    blueprint-preview.tsx          # imports VariableInput from new file

MODIFIED PRIMITIVES:
  src/components/apps/
    last-run-card.tsx              # +variant="hero" → ReactMarkdown body,
                                   #   metadata footer (model, duration, cost),
                                   #   "Previous runs ▾" disclosure (Sheet)
    run-now-button.tsx             # +variables prop; null → POST direct (Phase 2),
                                   #   non-null → opens RunNowSheet

NEW KITS:
  src/lib/apps/view-kits/kits/
    coach.ts                       # KitDefinition; hero=last-run-hero,
                                   #   secondary=run-cadence-heatmap + recent-rows,
                                   #   activity=run-history-strip
    ledger.ts                      # KitDefinition; hero=ledger-hero,
                                   #   secondary=transactions-table,
                                   #   activity=monthly-close-summary

DEFAULT KPI HELPERS:
  src/lib/apps/view-kits/
    default-kpis.ts                # +defaultLedgerKpis(table, columns, period)
                                   #   → 3-4 specs (Net, Inflow, Outflow,
                                   #   optional Run-rate when blueprint present)

KPI ENGINE EXTENSIONS:
  src/lib/apps/view-kits/
    evaluate-kpi.ts                # +case "tableSumWindowed"
    kpi-context.ts                 # +tableSumWindowed(table, column, sign?, window?)
  src/lib/apps/registry.ts         # +tableSumWindowed Zod arm in KpiSpecSchema

KIT-AWARE DATA DISPATCH:
  src/lib/apps/view-kits/data.ts   # +if (kitId === "coach") { ... }
                                   # +if (kitId === "ledger") { ... }
                                   # +loadCoachDigest(taskRecency: 1)
                                   # +loadCoachRunHistory(blueprintId, limit)
                                   # +loadCoachCadenceCells(blueprintId, weeks)
                                   # +loadLedgerTimeSeries(tableId, column, period)
                                   # +loadLedgerCategoryDonut(tableId, column, period)
                                   # +loadBlueprintVariables(blueprintId)
                                   # +loadMonthlyCloseSummary(blueprintId)
                                   # NOTE: switch now at 4 branches — registry
                                   #   refactor still deferred to Phase 4 (HOLD).
                                   # CACHE KEY adds period:
                                   #   ["app-runtime", app.id, kitId, period ?? "default"]

NEW SLOT VARIANTS:
  src/components/apps/kit-view/slots/
    hero.tsx                       # +last-run-hero, +ledger-hero
    secondary.tsx                  # +run-cadence-heatmap, +transactions-table
    activity.tsx                   # +run-history-strip, +monthly-close-summary

PAGE WIRING:
  src/app/apps/[id]/page.tsx       # reads ?period=mtd|qtd|ytd via Zod;
                                   #   passes through to projection (Ledger only)

STARTER (Ledger dogfood):
  .claude/apps/starters/
    finance-pack.yaml              # currency-table + monthly-close blueprint;
                                   #   compose hint for browser smoke gate

INFERENCE (verify, do not redesign):
  src/lib/apps/view-kits/inference.ts  # already has coach/ledger heuristics
                                       #   from Phase 1.2 — add explicit tests
```

## Data flow

```
              ┌──────────────────────────────────────────────────────┐
              │  /apps/<id>?period=mtd                               │
              │  page.tsx (server component)                         │
              └─────────────┬────────────────────────────────────────┘
                            │ load AppDetail + columns
                            ▼
              ┌──────────────────────────────────────────────────────┐
              │  pickKit(manifest, columns) → "coach" | "ledger" |   │
              │                                "tracker" | ...      │
              └─────────────┬────────────────────────────────────────┘
                            ▼
              ┌──────────────────────────────────────────────────────┐
              │  kit.resolve({ manifest, columns, period? })          │
              │    Coach   → { runsBlueprintId, cadenceScheduleId,    │
              │                secondaryTableIds, runsBlueprintVars } │
              │    Ledger  → { heroTableId, runsBlueprintId, period,  │
              │                kpiSpecs (windowed), runsBlueprintVars}│
              └─────────────┬────────────────────────────────────────┘
                            ▼
              ┌──────────────────────────────────────────────────────┐
              │  loadRuntimeState(app, bindings, kitId, projection)   │
              │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
              │  │ baseline │  │ kit-spec │  │ blueprint vars   │     │
              │  │ (always) │  │ branches │  │ (in-memory reg.) │     │
              │  └──────────┘  │ tracker  │  └──────────────────┘     │
              │                │ wf-hub   │                           │
              │                │ +coach   │                           │
              │                │ +ledger  │                           │
              │                └──────────┘                           │
              └─────────────┬────────────────────────────────────────┘
                            ▼
              ┌──────────────────────────────────────────────────────┐
              │  kit.buildModel(projection, runtime) → ViewModel      │
              │    Coach hero  = createElement(LastRunCard,           │
              │                    {variant:"hero", task, blueprint}) │
              │    Ledger hero = createElement(LedgerHeroPanel,       │
              │                    {timeseries, donut, period})       │
              └─────────────┬────────────────────────────────────────┘
                            ▼
              ┌──────────────────────────────────────────────────────┐
              │  <KitView model={viewModel}/> → slot renderers        │
              │  PeriodSelector (Ledger) → router.replace ?period=    │
              │  RunNowButton/Sheet → POST /api/blueprints/{id}/inst. │
              └──────────────────────────────────────────────────────┘
```

### Period selector flow

PeriodSelectorChip (client) calls `router.replace(\`/apps/${id}?period=${value}\`)` → server re-renders → `loadRuntimeState` reads `period` from projection → `tableSumWindowed` re-evaluates with windowed SQL → fresh KPI tiles + chart. Cache key includes `period` so MTD↔YTD switches do not serve stale state.

## Frozen-contract impact

Only one contract change — extending `KpiSpec` discriminated union with `tableSumWindowed` arm. Phase 2's principle ("no formula strings, no manifest escape hatch") is preserved: the new arm is a typed, named source kind with explicit fields, not a generic predicate.

Kit dispatch in `data.ts` grows from 2 → 4 branches. Phase 2 docstring said "refactor at 4." HOLD mode says no extra scope — refactor stays deferred to Phase 4 when the 5th kit (Inbox or Research) arrives.

## Error & Rescue Registry

| Error | Trigger | Impact | Rescue |
|---|---|---|---|
| Coach: no completed task yet | App just installed, blueprint never ran | Hero would be empty | Render empty-state card "No digest yet — click Run now" with CTA wired to RunNowSheet |
| Coach: latest task failed | Blueprint errored on last run | Hero would show error text as markdown | Detect `task.status === "failed"`; show muted error card + "View previous runs ▾" pre-expanded |
| Ledger: hero table empty | New app, no transactions | KPIs all `—`, chart empty | TimeSeriesChart shows muted "No data yet" placeholder; KPI tiles render `—` (formatKpi already does this) |
| Ledger: currency column not numeric | User authored bad manifest | `tableSumWindowed` returns `null` | Tile renders `—`; chart placeholder; manifest validation already catches at upload time |
| Period query param tampered | `?period=foo` in URL | Could break Zod or skew cache key | `z.enum(["mtd","qtd","ytd"]).default("mtd")` at page entry; bad values silently fall back |
| Blueprint variables missing on RunNow | `getBlueprint(id)` returns null | Sheet would crash | Projection records `runsBlueprintVars: null`; RunNowButton renders disabled state with tooltip "Blueprint not found" |
| Required variable left blank | User submits empty input | API 400 with field-level error | Inline error next to field (parse 400 body for `field` + `message`); sheet stays open; submit button re-enables |
| Network failure on instantiate | Offline / 500 | User loses input | Sheet stays open; toast "Run failed — try again"; values preserved (controlled state) |
| `react-markdown` parse error | Malformed digest output | Whole hero crashes | Wrap markdown render in error boundary; fallback to `<pre>` raw text + warning chip |
| Heatmap: no runs in 12wk window | Brand-new blueprint | Empty grid | Render grid with all cells at "no data" tone; legend shows total = 0 |
| Recharts SSR hydration mismatch | ResponsiveContainer + SSR | Layout shift on first paint | `dynamic(() => ..., { ssr: false })` for the chart wrapper, deterministic skeleton fallback |
| `unstable_cache` stale across period switches | Forgot to add `period` to cache key | Wrong KPIs shown for 30s | Cache key includes `period` |
| RunNowSheet: blueprint variables changed mid-session | User edits blueprint while another tab has stale form | Submit might 400 on unknown field | API should reject unknown fields with 400; sheet shows error toast + "Reload" CTA that re-fetches blueprint definition |
| Ledger: no monthly-close blueprint declared | App has currency table but no `*-close` blueprint | Activity slot would have nothing to render; Run-rate KPI absent | `defaultLedgerKpis` already drops Run-rate when blueprint missing; activity slot renders empty-state ("No monthly-close blueprint configured") instead of crashing; remaining KPIs (Net/Inflow/Outflow) still render |
| Ledger: hero table has no `currency`-shaped column | Wrong inference, manifest authored without currency tag | `defaultLedgerKpis` would synthesize zero specs | Fall through to placeholder kit (`pickKit` returns "ledger" only when currency column detected — verify with explicit test); never reach this branch unless tampering |

## NOT in scope (deferred with rationale)

- **Document citation strip** — `DocumentChipBar` is the wrong primitive (document-detail editor with delete/unlink/project-select). A read-only `DocumentCitationStrip` is small but pulls coach task → linked-document loading into Phase 3 scope. Defer to Phase 4 alongside Inbox kit which already needs document loading.
- **Top mover (24h) KPI** — Needs diff-based aggregation (latest row vs row 24h ago). No primitive available. Phase 5 hardening.
- **Allocation drift %** — Needs target-allocation reference (where stored?). Underspecified. Phase 5.
- **`RunHistoryTimeline` primitive** — Spec already defers; Coach uses inline horizontal strip in this phase.
- **Kit-loader registry refactor** — At 4 branches (refactor threshold), but HOLD says no extra scope; refactor in Phase 4 when 5+ branches arrive.
- **Period range customization beyond MTD/QTD/YTD** — out per spec.
- **TimeSeriesChart formats beyond AreaChart** — out per spec.
- **TableSpreadsheet for Ledger transactions** — Ledger uses a simpler read-only `TransactionsTable` slot variant (date + label + amount + tags); the editable spreadsheet would invite mid-digest edits we do not want.

## What already exists (reuse, do not rebuild)

- `LightMarkdown` (kept for compact callers; not extended)
- `VariableInput` (in `blueprint-preview.tsx` lines 175-247 — extract, do not rewrite)
- `formatKpi` + `KpiPrimitive` (handle currency, percent, duration, int, relative)
- `evaluateKpi` switch (extend with new arm — pattern from Phase 2)
- `unstable_cache` wrapping in `data.ts` (extend cache key with `period`)
- `humanizeCron` (cadence chip already wired)
- `getBlueprint(id)` from `@/lib/workflows/blueprints/registry` (in-memory, no DB)
- `recharts` AreaChart + ResponsiveContainer (used by `analytics-dashboard.tsx`)
- `adoption-heatmap.tsx` SVG technique (template for cadence heatmap)
- `Sheet` from shadcn/ui (RunNowSheet body)
- `DonutRing` at `src/components/charts/donut-ring.tsx` (Ledger hero composes this with `TimeSeriesChart`; do not rebuild)
- `weekly-portfolio-check-in` starter (Coach dogfood target — already exists)
- `react-markdown` ^10.1.0 + `remark-gfm` ^4.0.1 (already in `package.json`, no install needed)

## Acceptance gates

1. **Unit tests** (~80 new):
   - `time-series-chart.test.tsx`, `run-cadence-heatmap.test.tsx` — empty/full states, formatting
   - `last-run-card.test.tsx` adds `variant="hero"` cases (markdown render, metadata footer, previous-runs disclosure)
   - `run-now-sheet.test.tsx`, `variable-input.test.tsx` — form rendering, validation, submit, field-level errors, network failure
   - `coach.test.ts`, `ledger.test.ts` — resolve + buildModel, empty + full bindings, failed-task hero rescue
   - `default-kpis.test.ts` adds `defaultLedgerKpis` cases (sign filters, period scoping, no-blueprint variant)
   - `evaluate-kpi.test.ts` adds `tableSumWindowed` arm
   - `kpi-context.test.ts` adds period-bounded SQL with seeded fixtures
   - `dispatcher.test.ts` adds coach/ledger registration
   - `inference.test.ts` adds explicit Coach/Ledger pickKit cases
2. **`npx tsc --noEmit`** clean for `src/(app|lib|components)/(apps|charts|workflows)`
3. **Browser smoke** (HOLD requires both kits visible end-to-end):
   - `/apps/<weekly-portfolio-check-in>` renders Coach (after composing the existing starter)
   - `/apps/<finance-pack>` renders Ledger; PeriodSelectorChip toggles re-scope KPIs + chart
   - Run Now opens sheet for blueprint with required variables; instantiate succeeds end-to-end
4. **No regression** on `habit-tracker` (Phase 2 Tracker gate still passes)

## Open risks (non-blocking, surfaced for plan)

- **Recharts SSR hydration** — known Next.js issue; mitigation listed in Error Registry. Plan should budget a small `dynamic(...{ssr:false})` wrapper.
- **`finance-pack` starter authoring** — currency-shaped table + monthly-close blueprint pair must compose successfully via the existing planner. May need a one-off compose smoke during plan-build to validate the YAML.
- **Cache invalidation on `?period=` switch** — included in design (cache key carries `period`), but worth a regression test that verifies the unstable_cache key composition.

## Next step

User reviews this design. On approval, invoke `superpowers:writing-plans` to produce a step-by-step implementation plan with verification checkpoints.
