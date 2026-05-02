---
title: Composed App Kits — Coach & Ledger
status: planned
priority: P2
milestone: post-mvp
source: ideas/composed-apps-domain-aware-view.md
dependencies: [composed-app-kit-tracker-and-hub]
---

# Composed App Kits — Coach & Ledger

## Description

Phase 3 of the Composed Apps Domain-Aware View strategy: add two domain-specific kits for digest-shaped and finance-shaped apps, plus the two new chart primitives they need.

**Coach** is the briefing/digest kit. The hero is the **last run's output** — markdown rendered with metadata footer (model, duration, cost). Selected for apps where a single blueprint runs a `*-coach` profile on a schedule (weekly-portfolio-check-in, business-daily-briefing, daily research digest). The user lands on the most recent advisory output and can drill into past runs via a horizontal run-history strip.

**Ledger** is the finance/transactions kit. KPI strip up top (net, inflow, outflow, run-rate), a 90-day `TimeSeriesChart` paired with a `DonutRing` of categories, transactions table below, and a collapsed monthly-close summary at the bottom. Selected for apps where a hero table has a `currency`-shaped numeric column + date column (finance-pack, expense-tracker).

Two new chart primitives land here:
- `TimeSeriesChart` — a thin recharts wrapper for 30-day / 90-day / YTD views; used by Tracker (could replace inline sparklines on dense Tracker apps) and Ledger.
- `RunCadenceHeatmap` — a 12-week × 7-day grid of run firings, derived from the existing `AdoptionHeatmap`; used by Tracker (completion grid) and Coach (run reliability).

`LastRunCard` (already shipped in Phase 2) gets a `variant: "hero"` mode in this feature — full markdown body, citations bar, "View previous runs ▾" disclosure.

## User Story

As an investor using the weekly-portfolio-check-in app, I want to land directly on this week's digest output with all relevant numbers and commentary, with one click to last week's digest, so the app feels like a coaching assistant rather than a settings page.

As a user of finance-pack, I want a finance dashboard that shows my month-to-date net, a 90-day trend, category breakdown, and a transactions table — so the app feels like a ledger, not a manifest viewer.

## Technical Approach

### New shared primitives

**`src/components/charts/time-series.tsx`**

```ts
type TimeSeriesPoint = { date: string; value: number; label?: string };

export function TimeSeriesChart({
  data,
  format = "int",
  height = 240,
  range = "90d",
}: {
  data: TimeSeriesPoint[];
  format?: KpiFormat;
  height?: number;
  range?: "30d" | "90d" | "ytd" | "mtd";
}): JSX.Element;
```

Wraps recharts `AreaChart` + `CartesianGrid` + `Tooltip` + `ResponsiveContainer` (the same imports already used in `analytics-dashboard.tsx`). Empty-data state renders a muted "No data yet" placeholder (Calm Ops discipline).

**`src/components/charts/run-cadence-heatmap.tsx`**

```ts
type CadenceCell = { date: string; runs: number; status?: "success" | "fail" };

export function RunCadenceHeatmap({
  cells,
  weeks = 12,
}: {
  cells: CadenceCell[];
  weeks?: number;
}): JSX.Element;
```

Borrows the SVG grid technique from `src/components/playbook/adoption-heatmap.tsx` but parameterizes the data source (run firings, not feature adoption) and the cell color scale (none/light/full → success; red dot → fail).

### `LastRunCard` enhancement

Add a `variant` prop to the existing `LastRunCard`:
- `"compact"` (existing default, used by Tracker/Ledger headers)
- `"hero"` (new) — full markdown body via `LightMarkdown`, document citations bar via existing `DocumentChipBar`, run metadata footer (model, duration, cost), "Previous runs ▾" disclosure that opens a `Sheet` with the last N runs as clickable cards

### New kits

**`src/lib/apps/view-kits/kits/coach.ts`**

```ts
export const CoachKit: KitDefinition = {
  id: "coach",
  resolve: ({ manifest, bindings }) => ({
    runsBlueprintId:   bindings.runs?.blueprint   ?? manifest.blueprints[0]?.id,
    cadenceScheduleId: bindings.cadence?.schedule ?? manifest.schedules[0]?.id,
    secondaryTableIds: bindings.secondary?.flatMap(b => "table" in b ? [b.table] : []) ?? [],
  }),
  buildModel: (proj, runtime) => ({
    header: {
      title: runtime.app.name,
      cadenceChip: runtime.cadence,
      runNow: proj.runsBlueprintId ? { blueprintId: proj.runsBlueprintId } : undefined,
    },
    hero: { kind: "last-run-hero", taskId: runtime.lastTaskId, blueprintId: proj.runsBlueprintId },
    secondary: [
      { kind: "run-cadence-heatmap", blueprintId: proj.runsBlueprintId, weeks: 12 },
      ...proj.secondaryTableIds.map(id => ({ kind: "recent-rows" as const, tableId: id, limit: 5 })),
    ],
    activity: { kind: "run-history-strip", blueprintId: proj.runsBlueprintId, limit: 8 },
    footer:   { kind: "manifest", manifest: runtime.app.manifest },
  }),
};
```

**`src/lib/apps/view-kits/kits/ledger.ts`**

```ts
export const LedgerKit: KitDefinition = {
  id: "ledger",
  resolve: ({ manifest, bindings, columns }) => ({
    heroTableId:       bindings.hero?.table       ?? manifest.tables[0]?.id,
    runsBlueprintId:   bindings.runs?.blueprint   ?? manifest.blueprints[0]?.id,
    kpiSpecs:          bindings.kpis ?? defaultLedgerKpis(columns), // net, inflow, outflow, run-rate
  }),
  buildModel: (proj, runtime) => ({
    header: {
      title: runtime.app.name,
      runNow: proj.runsBlueprintId ? { blueprintId: proj.runsBlueprintId } : undefined,
      // Period selector (MTD/QTD/YTD) is a client-side chip group; passes a query param to refetch
    },
    kpis: runtime.kpis,
    hero: { kind: "ledger-hero", tableId: proj.heroTableId, range: runtime.period },
    // ledger-hero slot composes TimeSeriesChart + DonutRing side by side
    secondary: [
      { kind: "transactions-table", tableId: proj.heroTableId, range: runtime.period },
    ],
    activity: { kind: "monthly-close-summary", blueprintId: proj.runsBlueprintId },
    footer:   { kind: "manifest", manifest: runtime.app.manifest },
  }),
};
```

### Slot renderer additions

- `src/components/apps/kit-view/slots/hero.tsx` gets new variants: `last-run-hero`, `ledger-hero`
- `src/components/apps/kit-view/slots/secondary.tsx` gets `run-cadence-heatmap`, `transactions-table`
- `src/components/apps/kit-view/slots/activity.tsx` gets `run-history-strip` (small horizontal scroll of clickable run cards), `monthly-close-summary` (collapsed markdown of the latest monthly-close run)

### Default KPI synthesis

`defaultLedgerKpis(columns)` walks the hero table's columns and synthesizes:
- **Net**: `tableSum` over the currency column with no filter
- **Inflow**: `tableSum` over the currency column with `where: amount > 0`
- **Outflow**: `tableSum` over the currency column with `where: amount < 0`
- **Run-rate**: `blueprintRunCount` for the monthly-close blueprint (window 30d) — only included if a blueprint is declared

### Period selector wiring

The Ledger header includes an MTD / QTD / YTD chip group. This is a small client component (`src/components/apps/period-selector-chip.tsx`) that updates a query param `?period=mtd|qtd|ytd`. The page reads the param server-side and passes it into `loadRuntimeState`, which scopes the `tableSum` queries.

## Acceptance Criteria

- [ ] `TimeSeriesChart` renders an `AreaChart` for 30/90/MTD/YTD ranges with proper formatting (int/currency/percent/duration); empty-data state renders a muted placeholder
- [ ] `RunCadenceHeatmap` renders a 12-week × 7-day grid; cell color scales with run count; failed runs marked
- [ ] `LastRunCard` `variant: "hero"` renders the latest task's output as markdown with metadata footer + "Previous runs ▾" disclosure that opens a Sheet
- [ ] `CoachKit` renders for weekly-portfolio-check-in: hero is the latest digest, run cadence heatmap secondary, run history strip activity
- [ ] `LedgerKit` renders for finance-pack: KPI strip on top (net/inflow/outflow/run-rate), TimeSeriesChart + DonutRing in hero, transactions table secondary, monthly-close collapsed at bottom
- [ ] Period selector (MTD/QTD/YTD) on Ledger updates the query param and re-scopes server-side queries
- [ ] Manifest auto-inference picks `coach` for weekly-portfolio-check-in and `ledger` for finance-pack (no explicit `view:` needed)
- [ ] Unit tests for `CoachKit.resolve` / `buildModel` and `LedgerKit.resolve` / `buildModel`, covering empty + full bindings
- [ ] Unit tests for `defaultLedgerKpis` against a seeded `transactions` table fixture
- [ ] Browser smoke: `npm run dev` → `/apps/<weekly-portfolio-check-in>` renders Coach layout; `/apps/<finance-pack>` renders Ledger layout
- [ ] No regression on Tracker / Workflow Hub apps (Phase 2 still works)

## Scope Boundaries

**Included:**
- `TimeSeriesChart`, `RunCadenceHeatmap` primitives
- `LastRunCard` `hero` variant
- `CoachKit`, `LedgerKit` registered in the view-kit registry
- Period selector chip for Ledger
- Slot renderer additions: `last-run-hero`, `ledger-hero`, `run-cadence-heatmap`, `transactions-table`, `run-history-strip`, `monthly-close-summary`
- Default KPI synthesis for Ledger apps without explicit `view.bindings.kpis`

**Excluded:**
- Inbox / Research kits (Phase 4 feature)
- RunHistoryTimeline primitive (Phase 4 feature; Coach uses an inline strip in this phase)
- Period range customization beyond MTD/QTD/YTD (out of scope)
- Forecasting or predictive analytics on TimeSeriesChart (just historical render)
- New chart formats beyond AreaChart (LineChart, BarChart variants are deferred until a kit needs them)

## References

- Source: `ideas/composed-apps-domain-aware-view.md` — sections 1.B (Coach), 1.E (Ledger), 7 (Net-New Primitives), 13 shard #4
- Related features: `composed-app-kit-tracker-and-hub` (provides KPIStrip, LastRunCard, ScheduleCadenceChip, RunNowButton), `composed-app-kit-inbox-and-research` (next phase)
- Reference primitives: `src/components/playbook/adoption-heatmap.tsx` (pattern for RunCadenceHeatmap), `src/components/analytics/analytics-dashboard.tsx` (recharts usage pattern), `src/components/shared/light-markdown.tsx`, `src/components/documents/document-chip-bar.tsx`
- Anti-pattern reminders: charts must show real data (no decorative); empty states are explicit; no per-app CSS overrides
