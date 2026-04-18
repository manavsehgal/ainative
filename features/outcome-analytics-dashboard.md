---
title: Outcome Analytics Dashboard
status: completed
priority: P1
layer: PLG Core
dependencies:
  - local-license-manager
---

# Outcome Analytics Dashboard

> **Superseded by `community-edition-simplification` (2026-04-13).** This feature shipped but was later fully reverted when ainative pivoted to a 100% free Community Edition with no tiers, billing, or cloud dependency. Kept as historical record.

## Description

A new `/analytics` route that transforms raw execution data from the existing `usage_ledger` and `tasks` tables into actionable ROI insights — tasks completed, hours saved, value generated, success rates by profile, cost-per-outcome trends, and a profile leaderboard. This is an Operator+ tier feature; Community users see the page content behind a content-fade gate with a centered lock card overlay.

The dashboard requires zero new data collection. Every metric is derived from data ainative already captures: task status, execution duration, agent profile, and cost entries in the usage ledger. The ROI calculator uses a configurable hourly rate (stored in localStorage) to translate agent hours into dollar value.

## User Story

As an Operator tier user, I want to see how much value my AI agents are generating — tasks completed, time saved, cost efficiency by profile — so I can justify my subscription, identify my most effective agents, and optimize my workflow investments.

## Technical Approach

### Route Structure

File: `src/app/analytics/page.tsx`

Server Component with tier gate:

```tsx
export default async function AnalyticsPage() {
  const license = await getLicenseStatus();
  const isAllowed = license.tier !== 'community';

  const data = isAllowed ? await getAnalyticsData() : null;

  return (
    <PageShell title="Analytics" description="Agent performance and ROI insights">
      {isAllowed ? (
        <AnalyticsDashboard data={data} />
      ) : (
        <PremiumGateOverlay requiredTier="operator" feature="Analytics">
          <AnalyticsDashboard data={SAMPLE_DATA} />
        </PremiumGateOverlay>
      )}
    </PageShell>
  );
}
```

### PremiumGateOverlay Component

File: `src/components/shared/premium-gate-overlay.tsx`

Reusable component for gating premium content. Renders children at reduced opacity with a centered lock card — no backdrop-filter (per design system rules).

```tsx
interface PremiumGateOverlayProps {
  requiredTier: string;
  feature: string;
  children: React.ReactNode;
}

export function PremiumGateOverlay({ requiredTier, feature, children }: PremiumGateOverlayProps) {
  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-background/80 surface-card elevation-2 rounded-2xl p-8 text-center max-w-sm space-y-4">
          <Lock className="size-8 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">{feature} requires {requiredTier}</h3>
          <p className="text-sm text-muted-foreground">
            Upgrade to {requiredTier} to unlock {feature.toLowerCase()} and other premium features.
          </p>
          <Button asChild>
            <Link href={`/settings/subscription?highlight=${requiredTier}`}>
              Upgrade to {requiredTier}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

Key design decisions:
- Uses `bg-background/80` for the overlay card, NOT `backdrop-filter` (forbidden by design system)
- `opacity-50 pointer-events-none` on children creates the content-fade effect
- `aria-hidden="true"` on the faded content prevents screen readers from reading inaccessible data
- Lock card uses `elevation-2` for prominent floating appearance

### Dashboard Sections

File: `src/components/analytics/analytics-dashboard.tsx`

#### 1. ROI Summary Strip

Three stat cards in a horizontal row (`grid grid-cols-3 gap-4`):

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <StatCard
    label="Tasks Completed"
    value={data.tasksCompleted}
    description="Last 30 days"
    icon={CheckCircle}
  />
  <StatCard
    label="Hours Saved"
    value={`${data.hoursSaved.toFixed(1)}h`}
    description="Based on avg task duration"
    icon={Clock}
  />
  <StatCard
    label="Value Generated"
    value={`$${data.valueGenerated.toFixed(0)}`}
    description={`At $${hourlyRate}/hr`}
    icon={DollarSign}
  />
</div>
```

Each StatCard: `surface-card elevation-1 rounded-xl p-6`. Value in `text-2xl font-bold`. Icon in `text-primary/60`.

Hours saved calculation: sum of all completed task durations (from `agent_logs` execution time). Value generated: hours saved * hourly rate.

#### 2. Success Rate Chart

Recharts `AreaChart` showing completed vs failed tasks over 30 days, grouped by day:

```tsx
<FormSectionCard title="Success Rate" description="Task outcomes over the last 30 days">
  <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.successRateTrend}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="completed"
          stackId="1"
          stroke="oklch(0.65 0.18 145)"
          fill="oklch(0.65 0.18 145 / 0.2)"
        />
        <Area
          type="monotone"
          dataKey="failed"
          stackId="1"
          stroke="oklch(0.65 0.18 25)"
          fill="oklch(0.65 0.18 25 / 0.2)"
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
</FormSectionCard>
```

#### 3. Cost Per Outcome Trend

Recharts `LineChart` showing average cost per completed task over 30 days:

```tsx
<FormSectionCard title="Cost per Outcome" description="Average cost per completed task">
  <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data.costPerOutcomeTrend}>
        <XAxis dataKey="date" />
        <YAxis tickFormatter={(v) => `$${v.toFixed(2)}`} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="avgCost"
          stroke="oklch(0.55 0.18 250)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
</FormSectionCard>
```

#### 4. Profile Leaderboard

Sortable table showing per-profile performance:

| Profile | Completed | Success Rate | Avg Cost | Avg Duration |
|---------|-----------|--------------|----------|--------------|
| researcher | 45 | 91% | $0.12 | 2.3m |
| code-reviewer | 32 | 97% | $0.08 | 1.1m |
| document-writer | 28 | 82% | $0.15 | 3.7m |

Uses the existing DataTable component with sortable column headers. Each row links to the profile detail view.

#### 5. ROI Calculator

Interactive section at the bottom:

```tsx
<FormSectionCard title="ROI Calculator" description="Estimate the value of agent automation">
  <div className="flex items-center gap-4">
    <label className="text-sm font-medium">Your hourly rate</label>
    <Input
      type="number"
      value={hourlyRate}
      onChange={(e) => setHourlyRate(Number(e.target.value))}
      className="w-24"
      min={0}
    />
    <span className="text-sm text-muted-foreground">$/hour</span>
  </div>
  <div className="mt-4 grid grid-cols-3 gap-4">
    <div className="text-center">
      <p className="text-2xl font-bold">{hoursSaved.toFixed(1)}h</p>
      <p className="text-sm text-muted-foreground">Hours saved this month</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold">${(hoursSaved * hourlyRate).toFixed(0)}</p>
      <p className="text-sm text-muted-foreground">Value generated</p>
    </div>
    <div className="text-center">
      <p className="text-2xl font-bold">{roi.toFixed(0)}%</p>
      <p className="text-sm text-muted-foreground">ROI vs subscription cost</p>
    </div>
  </div>
</FormSectionCard>
```

Hourly rate persisted in localStorage (`ainative:hourly-rate`, default: 50).

### Query Helpers

File: `src/lib/data/analytics-queries.ts`

```ts
// Count completed tasks in last N days, grouped by profile
export function getOutcomeCountByProfile(days: number): ProfileOutcome[];

// Daily completed vs failed counts for area chart
export function getSuccessRateTrend(days: number): DailySuccessRate[];

// Average cost per completed task per day
export function getCostPerOutcomeTrend(days: number): DailyCostPerOutcome[];

// Per-profile stats for leaderboard
export function getProfileLeaderboard(): ProfileLeaderboardEntry[];

// Total hours saved (sum of execution durations for completed tasks)
export function getTotalHoursSaved(days: number): number;
```

All queries use the existing `tasks` and `usage_ledger` tables via Drizzle query builder. No raw SQL subqueries (per architecture decision about Drizzle column references).

### Sidebar Navigation

Add "Analytics" to the Manage group in `src/components/shared/app-sidebar.tsx`:

```ts
{ title: 'Analytics', url: '/analytics', icon: BarChart3 }
```

Position: after "Cost & Usage" in the Manage group.

### Sample Data for Gate Preview

`SAMPLE_DATA` constant provides realistic-looking but clearly fake data for the Community tier content-fade preview. This gives free users a taste of what the dashboard looks like populated, increasing upgrade motivation.

## Acceptance Criteria

- [ ] `/analytics` route renders with PageShell and all five dashboard sections
- [ ] Community users see content-fade gate (opacity-50, pointer-events-none) with lock card overlay
- [ ] Lock card uses `bg-background/80` — no backdrop-filter anywhere
- [ ] `PremiumGateOverlay` is a reusable component (used here, available for future features)
- [ ] Operator+ users see full interactive dashboard
- [ ] ROI Summary Strip shows tasks completed, hours saved, and value generated
- [ ] Success Rate Chart renders Recharts AreaChart with completed/failed areas
- [ ] Cost Per Outcome Trend renders Recharts LineChart
- [ ] Profile Leaderboard renders sortable DataTable with per-profile stats
- [ ] ROI Calculator allows configurable hourly rate persisted in localStorage
- [ ] All data derived from existing `tasks` and `usage_ledger` tables — no new data collection
- [ ] Query helpers use Drizzle typed query builder (no raw SQL subqueries)
- [ ] Sidebar has "Analytics" entry in Manage group with BarChart3 icon
- [ ] Sample data shown behind content-fade for Community users
- [ ] `aria-hidden="true"` on faded content for accessibility

## Scope Boundaries

**Included:**
- `/analytics` route with five dashboard sections
- `PremiumGateOverlay` reusable component
- Query helpers for outcome counts, success rates, cost trends, leaderboard
- ROI Calculator with localStorage hourly rate
- Sidebar navigation entry
- Sample data for Community gate preview
- Recharts AreaChart and LineChart visualizations

**Excluded:**
- Export analytics to PDF/CSV — future enhancement
- Custom date range picker (fixed to 30 days for V1) — future
- Real-time updating (charts refresh on page load only) — future
- Agent comparison view (side-by-side profile analysis) — future
- Predictive analytics / forecasting — future
- Email digest of analytics — out of scope for local-first
- Vector-based anomaly detection on cost trends — over-engineered for V1

### Creator Analytics Tab (Operator+ only)

When the user has published marketplace blueprints, a "Creator" tab appears alongside the main analytics view:

- Total marketplace revenue (all time + this month)
- Install count per listing (bar chart)
- Success rate per listing (from aggregated telemetry data)
- Revenue per listing breakdown
- Highlight: "Your top blueprint: {name} — {installs} installs, ${revenue} earned"
- Revenue split reminder: "You earn 70% of each sale" (or 80% for Scale)
- Data sourced from Supabase `blueprints` table (install_count, success_rate) + Stripe Connect payouts
- This tab makes the Operator tier self-justifying: users can see whether their marketplace earnings offset subscription cost

## References

- Depends on: `features/local-license-manager.md` — tier gate for premium content
- Related: `features/community-edition-soft-limits.md` — analytics is Operator+ feature
- Related: `features/subscription-management-ui.md` — upgrade links point to subscription page
- Data sources: `src/lib/db/schema.ts` — tasks table (status, agentProfile, createdAt), usage_ledger table (cost, createdAt)
- Existing cost page: `src/app/costs/` — analytics complements cost tracking
- DataTable: `src/components/shared/` — reuse for profile leaderboard
- Design system: `design-system/MASTER.md` — elevation-1, surface-card, OKLCH tokens, no backdrop-filter
- Recharts: already a project dependency for chart rendering
