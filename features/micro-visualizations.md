---
title: Micro-Visualizations & Sparklines
status: completed
priority: P2
milestone: post-mvp
source: ideas/ux-improvements.md
dependencies: [homepage-dashboard, monitoring-dashboard, project-management]
---

# Micro-Visualizations & Sparklines

## Description

Add subtle sparkline charts and micro-visualizations across the ainative homepage and secondary pages to enhance glanceability. These are small, embedded data graphics — 7-day trend sparklines in stats cards, hourly activity bar charts, completion donut rings, and status distribution bars — that supplement existing numeric values without adding clutter.

All visualizations are pure SVG (no charting library), use existing OKLCH chart color tokens, and render in Server Components where possible. They are decorative enhancements to existing data — every visualization supplements a text value, never replaces it.

## User Story

As a project manager monitoring agent activity, I want to see at-a-glance trend data embedded in my dashboard cards so that I can quickly spot patterns (rising failures, declining completions, activity spikes) without navigating to detail pages.

## Technical Approach

### Library Choice: Pure SVG (No External Dependency)

Custom SVG components instead of Recharts/D3/Nivo:
- Zero bundle size impact (~2KB total for 3 components vs ~200KB for Recharts)
- Full React 19 + Server Component compatibility
- Direct OKLCH token consumption via `var(--chart-*)` CSS custom properties
- Matches existing pattern (app already uses `<Progress>` without a charting lib)

### Chart Primitives (3 new components in `src/components/charts/`)

1. **`sparkline.tsx`** — SVG polyline with optional area fill. Props: `data: number[]`, `width`, `height`, `color`, `fillOpacity`, `label` (aria). Normalizes data to viewBox, handles <2 points gracefully.

2. **`mini-bar.tsx`** — Vertical bar sequence for distributions/hourly data. Props: `bars: {value, color, label}[]`, `width`, `height`, `gap`, `label`. Each bar is a `<rect>` proportional to max value.

3. **`donut-ring.tsx`** — Thin circular arc for completion percentages. Props: `value: number` (0-100), `size`, `strokeWidth`, `color`, `trackColor`, `label`. Uses `stroke-dasharray` / `stroke-dashoffset`.

All three: `role="img"` + `aria-label` + `<title>` for accessibility. Server-safe (no `"use client"` on primitives). Empty/zero states handled (dashed line or flat muted line).

### Data Layer (`src/lib/queries/chart-data.ts`)

New aggregation queries using Drizzle + SQLite `strftime`:

| Function | Returns | Used By |
|----------|---------|---------|
| `getCompletionsByDay(days)` | `{date, count}[]` | Homepage stats sparkline |
| `getTaskCreationsByDay(days)` | `{date, count}[]` | Homepage stats sparkline |
| `getAgentActivityByHour()` | `{hour, count}[]` | Homepage activity bar, Monitor sparkline |
| `getNotificationsByDay(days)` | `{date, count}[]` | Homepage stats sparkline |
| `getProjectCompletionTrend(id, days)` | `{date, count}[]` | Project detail sparkline |
| `getProjectStatusDistribution(id)` | `{status, count}[]` | Project detail stacked bar |

All functions fill date gaps with zeros for continuous sparklines.

### Placement Map

| Location | Component | Visualization | Color Token |
|----------|-----------|---------------|-------------|
| Homepage → Stats: Completed Today | `stats-cards.tsx` | 7-day sparkline | `--chart-2` (teal) |
| Homepage → Stats: Tasks Running | `stats-cards.tsx` | 7-day sparkline | `--chart-1` (blue) |
| Homepage → Stats: Awaiting Review | `stats-cards.tsx` | 7-day sparkline | `--chart-3` (orange) |
| Homepage → Activity Feed header | `activity-feed.tsx` | 24-bar hourly mini-bar | `--chart-1` |
| Homepage → Recent Projects | `recent-projects.tsx` | Donut ring per project | `--chart-2` |
| Project Detail → below status cards | `projects/[id]/page.tsx` | Stacked status bar (CSS flex) | semantic status tokens |
| Project Detail → below stacked bar | `projects/[id]/page.tsx` | 14-day completion sparkline | `--chart-2` |
| Monitor → Success Rate card | `monitor-overview.tsx` | Donut ring (replaces plain %) | `--status-completed` |
| Monitor → Active Agents card | `monitor-overview.tsx` | 24h activity sparkline | `--status-running` |

### Glass Morphism Integration

- Sparklines render inside existing `glass-card` / `[data-slot="card"]` containers
- SVG backgrounds are transparent — glass blur shows through
- Area fills use low opacity (0.1) to not compete with glass surface
- No additional blur layers (follows "never stack >2 blur layers" rule)

### Responsive Behavior

- Sparklines in stats cards: hidden below `sm:` breakpoint to keep cards compact on mobile
- Activity bar chart: full width, scales naturally with card
- Donut rings: always visible (small footprint)

## Acceptance Criteria

- [x] `Sparkline` component renders SVG polyline + area from numeric array data
- [x] `MiniBar` component renders vertical bar chart from labeled value array
- [x] `DonutRing` component renders circular progress arc from percentage
- [x] All 3 chart components include `role="img"`, `aria-label`, and `<title>` for accessibility
- [x] All chart components handle empty data (<2 points) with muted placeholder
- [x] All chart components handle all-zero data with flat muted line
- [x] Homepage stats cards show 7-day trend sparklines for Running, Completed, Awaiting
- [x] Homepage activity feed shows 24-hour agent activity bar chart
- [x] Homepage recent projects show completion donut rings
- [x] Project detail page shows stacked status distribution bar
- [x] Project detail page shows 14-day completion trend sparkline
- [x] Monitor success rate card shows donut ring visualization
- [x] Monitor active agents card shows 24h activity sparkline
- [x] All visualizations use OKLCH chart/status tokens (no hardcoded colors)
- [x] Visualizations render correctly in both light and dark modes
- [x] Sparklines hidden on mobile (`sm:` breakpoint) in stats cards
- [x] Chart data queries fill date gaps with zeros for continuous sparklines
- [x] No external charting library added — pure SVG only

## Scope Boundaries

**Included:**
- 3 reusable SVG chart primitives
- Data aggregation query module
- Integration into homepage, project detail, and monitor pages
- Accessibility (aria labels, screen reader descriptions)
- Light/dark mode support via OKLCH tokens
- Responsive hiding on small screens

**Excluded:**
- Interactive tooltips on hover (future enhancement)
- Click-to-expand detail views
- Inbox page visualizations (notification list doesn't benefit)
- Workflows page visualizations (step counts are too static)
- Real-time updating sparklines (data refreshes on page load only)
- Animation/transition effects on sparklines
- Projects list page donut rings (would require query changes to ProjectList client component)

## References

- Source: `ideas/ux-improvements.md` — dashboard enhancements
- Related features: `homepage-dashboard` (completed), `monitoring-dashboard` (completed), `project-management` (completed)
- Design system: `design-system/MASTER.md` — chart tokens, glass system, forbidden patterns
