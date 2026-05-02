---
title: Composed App Kits — Tracker & Workflow Hub
status: completed
priority: P1
milestone: post-mvp
source: ideas/composed-apps-domain-aware-view.md
dependencies: [composed-app-view-shell, composed-app-manifest-view-field, tables-spreadsheet-editor, micro-visualizations]
---

# Composed App Kits — Tracker & Workflow Hub

## Description

This is Phase 2 of the Composed Apps Domain-Aware View strategy: ship the first two real view kits, plus the four shared primitives every kit needs.

**Workflow Hub** is the catch-all default — any composed app that doesn't match a more specific rule lands here. It renders a 6-cell bento with KPI strip (run-rate, success %, cost 30d), a per-blueprint recent-runs list, and an `ErrorTimeline` for failed runs. This single kit replaces the placeholder for every app immediately, so users see real value the moment Phase 1 + 2 ship.

**Tracker** is the table-as-hero kit. It's chosen for apps where a user table with `boolean`+`date` shape combined with a schedule signals "this is something the user logs over time." Examples: habit-tracker (habits + logs), reading-radar (readings + weekly synthesis). The hero is the log table rendered through the existing `TableSpreadsheet`; KPIs sit above; a cadence visual (right side of the hero strip) shows the last 30 days of completion as a `MiniBar`.

The four shared primitives — `KPIStrip`, `LastRunCard`, `ScheduleCadenceChip`, `RunNowButton` — land here because both kits need them. Each is justified for ≥2 kits up-front.

## User Story

As a user of a composed habit-tracker app, I want to land on a screen where the log table is the hero, my current streak and this-week % are visible at the top, and I can see at a glance when the next scheduled run will fire — so the app feels like a tracker, not a settings page.

As a user of any composed app that doesn't fit a specific archetype, I want a sensible fallback dashboard that shows me run-rate, success rate, recent run history, and any failures — so even uncategorized apps are useful out of the box.

## Technical Approach

### New shared primitives (used by ≥2 kits)

| Primitive | Path | Purpose |
|---|---|---|
| `KPIStrip` | `src/components/apps/kpi-strip.tsx` | Generic 1–6 tile horizontal strip with format adapters (`int`, `currency`, `percent`, `duration`, `relative`); each tile takes `{label, value, delta?, sparkline?}` |
| `LastRunCard` | `src/components/apps/last-run-card.tsx` | Card that combines schedule × blueprint × last task status; compact variant (one-line) for non-hero slots, hero variant (with markdown body) for Coach/Research kits later |
| `ScheduleCadenceChip` | `src/components/apps/schedule-cadence-chip.tsx` | Renders `humanizeCron(cron) + " · in 2d 4h"` next-fire countdown; click opens existing schedule edit sheet |
| `RunNowButton` | `src/components/apps/run-now-button.tsx` | Client component that posts to the existing blueprint-trigger endpoint; if the blueprint declares `inputs:`, opens a `Sheet` with `WorkflowFormView`-style form first |

`humanizeCron` already exists as a helper used by the apps registry — reuse, don't duplicate.

### New kits

**`src/lib/apps/view-kits/kits/workflow-hub.ts`**

```ts
export const WorkflowHubKit: KitDefinition = {
  id: "workflow-hub",
  resolve: ({ manifest }) => ({
    blueprintIds: manifest.blueprints.map(b => b.id),
    scheduleIds:  manifest.schedules.map(s => s.id),
  }),
  buildModel: (proj, runtime) => ({
    header: { title: runtime.app.name, runNow: defaultRunNowTarget(runtime) },
    kpis: [
      { id: "run-rate",  label: "Run rate",   value: runtime.runRate30d,    format: "int" },
      { id: "success",   label: "Success %",  value: runtime.successPct,    format: "percent" },
      { id: "cost-30d",  label: "Cost 30d",   value: runtime.cost30d,       format: "currency" },
    ],
    secondary: proj.blueprintIds.map(id => ({
      kind: "recent-runs", blueprintId: id, limit: 5,
    })),
    activity: { kind: "error-timeline", taskIds: runtime.failedTaskIds.slice(0, 10) },
    footer:   { kind: "manifest", manifest: runtime.app.manifest },
  }),
};
```

**`src/lib/apps/view-kits/kits/tracker.ts`**

```ts
export const TrackerKit: KitDefinition = {
  id: "tracker",
  resolve: ({ manifest, bindings, columns }) => ({
    heroTableId:        bindings.hero?.table        ?? manifest.tables[0]?.id,
    secondaryTableIds:  bindings.secondary?.flatMap(b => "table" in b ? [b.table] : []) ?? [],
    cadenceScheduleId:  bindings.cadence?.schedule  ?? manifest.schedules[0]?.id,
    runsBlueprintId:    bindings.runs?.blueprint    ?? manifest.blueprints[0]?.id,
    kpiSpecs:           bindings.kpis ?? defaultTrackerKpis(columns),
  }),
  buildModel: (proj, runtime) => ({
    header: {
      title: runtime.app.name,
      cadenceChip: runtime.cadence,
      runNow: proj.runsBlueprintId ? { blueprintId: proj.runsBlueprintId } : undefined,
    },
    kpis: runtime.kpis,
    hero: { kind: "table-spreadsheet", tableId: proj.heroTableId, sparkColumn: "current_streak" },
    secondary: proj.secondaryTableIds.map(id => ({
      kind: "recent-rows", tableId: id, limit: 7,
    })),
    activity: { kind: "agent-logs", taskIds: runtime.recentTaskIds },
    footer:   { kind: "manifest", manifest: runtime.app.manifest },
  }),
};
```

`defaultTrackerKpis(columns)` synthesizes 3-4 sensible KPIs from the hero table's columns — count of active rows, latest value of any `streak`-named column, etc. Apps that want explicit KPIs declare `view.bindings.kpis`.

### KPI evaluation engine

**`src/lib/apps/view-kits/evaluate-kpi.ts`** — a single pure switch:

```ts
export async function evaluateKpi(spec: KpiSpec, ctx: KpiContext): Promise<KpiTile> {
  switch (spec.source.kind) {
    case "tableCount":       return tileFrom(spec, await ctx.tableCount(spec.source.table, spec.source.where));
    case "tableSum":         return tileFrom(spec, await ctx.tableSum(spec.source.table, spec.source.column));
    case "tableLatest":      return tileFrom(spec, await ctx.tableLatest(spec.source.table, spec.source.column));
    case "blueprintRunCount":return tileFrom(spec, await ctx.blueprintRunCount(spec.source.blueprint, spec.source.window));
    case "scheduleNextFire": return tileFrom(spec, await ctx.scheduleNextFire(spec.source.schedule));
  }
}
```

Each branch is straightforward DB access via the existing data accessors plus the three new ones from the data plan (added in `composed-app-view-shell`'s `data.ts`).

### Slot renderers

`src/components/apps/kit-view/slots/kpis.tsx` — renders `KPIStrip` from the model's `kpis` array.
`src/components/apps/kit-view/slots/hero.tsx` — discriminates on `hero.kind`; for `table-spreadsheet`, renders the existing `TableSpreadsheet` component; for `recent-runs` (used by hub), renders `RecentProjects`-style cards.
`src/components/apps/kit-view/slots/activity.tsx` — discriminates on `kind`; for `error-timeline`, renders the existing `ErrorTimeline`; for `agent-logs`, renders `ActivityFeed`.

### Registry update

`src/lib/apps/view-kits/index.ts` registers both kits:

```ts
export const kits: Record<KitId, KitDefinition> = {
  "workflow-hub": WorkflowHubKit,
  "tracker":      TrackerKit,
  "coach":        PlaceholderKit, // Phase 3
  "ledger":       PlaceholderKit, // Phase 3
  "inbox":        PlaceholderKit, // Phase 4
  "research":     PlaceholderKit, // Phase 4
  "auto":         PlaceholderKit, // never resolved — pickKit returns concrete id
};
```

## Acceptance Criteria

- [ ] `KPIStrip`, `LastRunCard`, `ScheduleCadenceChip`, `RunNowButton` exist under `src/components/apps/`, each with at least one Storybook-style usage in another component
- [ ] `KPIStrip` supports formats `int`, `currency`, `percent`, `duration`, `relative` and renders 1–6 tiles responsively
- [ ] `RunNowButton` posts to the existing blueprint-trigger endpoint; opens an inputs sheet when the blueprint has declared inputs; otherwise fires immediately
- [ ] `WorkflowHubKit` is registered and renders for any app with ≥2 blueprints OR no clear hero table
- [ ] `TrackerKit` is registered and renders for habit-tracker, reading-radar with the hero table = log table, KPI strip above, schedule cadence chip in the header
- [ ] `evaluateKpi` covers all 5 `KpiSpec.source.kind` cases; each has a unit test against seeded data
- [ ] Browser smoke: `npm run dev` → `/apps/habit-tracker` renders Tracker layout (KPIs, table-spreadsheet hero, manifest sheet still reachable)
- [ ] Browser smoke: `npm run dev` → `/apps/<any-multi-blueprint-app>` renders Workflow Hub layout (KPIs, recent runs, error timeline)
- [ ] Manifest auto-inference picks `tracker` for habit-tracker (no explicit `view:` declared)
- [ ] Unit tests for `WorkflowHubKit.resolve` + `buildModel` covering empty-manifest, single-blueprint, multi-blueprint cases
- [ ] Unit tests for `TrackerKit.resolve` + `buildModel` covering missing-bindings (uses defaults) and explicit-bindings cases
- [ ] No new React state in any kit file (lint rule or code-review check)

## Scope Boundaries

**Included:**
- 4 new shared primitives (KPIStrip, LastRunCard, ScheduleCadenceChip, RunNowButton)
- 2 new kits (workflow-hub, tracker) registered in the view-kit registry
- KPI evaluation engine + 5 source-kind branches
- Slot renderers for `kpis`, `hero`, `activity` (those needed by these two kits)
- Default KPI synthesis for tracker apps that don't declare `view.bindings.kpis`

**Excluded:**
- Coach / Ledger kits (Phase 3 feature)
- Inbox / Research kits (Phase 4 feature)
- TimeSeriesChart / RunCadenceHeatmap primitives (Phase 3 feature)
- RunHistoryTimeline primitive (Phase 4 feature)
- PersonaPill primitive (deferred — not strictly needed for these two kits)
- LightMarkdown changes (existing component reused; no edits)
- Hardening of column-shape inference probes (Phase 5 feature)

## References

- Source: `ideas/composed-apps-domain-aware-view.md` — sections 1.A (Tracker), 1.F (Workflow Hub), 7 (Net-New Primitives), 13 shard #3
- Related features: `composed-app-view-shell` (provides the dispatcher), `composed-app-manifest-view-field` (provides `pickKit`), `composed-app-kit-coach-and-ledger` (next phase, builds on these primitives)
- Reference primitives: `src/components/charts/{sparkline,mini-bar,donut-ring}.tsx`, `src/components/dashboard/{stats-cards,activity-feed,recent-projects}.tsx`, `src/components/workflows/error-timeline.tsx`, `src/components/tables/table-spreadsheet.tsx`
- Anti-pattern reminders: kits are pure projection functions; KPIStrip is generic (never says "habits"); no per-app React routes
