---
title: Cost & Usage Dashboard
status: completed
priority: P2
milestone: post-mvp
source: features/usage-metering-ledger.md, features/spend-budget-guardrails.md, user request 2026-03-12
dependencies: [usage-metering-ledger, spend-budget-guardrails, micro-visualizations]
---

# Cost & Usage Dashboard

## Description

Once usage data and budget policy exist, Stagent needs a first-class surface for operators to inspect them. Cost governance should not be buried in Settings or inferred from raw monitoring logs. Users need a dedicated view that answers three practical questions quickly: how much did we spend, where did the tokens go, and what activity created that usage.

This feature adds `Cost & Usage` as a top-level sidebar destination and introduces a dedicated dashboard route for spend, tokens, budget state, and auditability. The view combines high-signal summary cards, trend charts, provider/model breakdowns, and a filterable activity ledger so users can move from overview to specific execution records without leaving the operational shell.

## User Story

As a Stagent operator, I want a dedicated Cost & Usage screen so that I can review spend trends, identify which provider or model drove usage, and audit the activity behind each dollar or token count.

## Technical Approach

- Add a new sidebar navigation item and route, preferably `/costs`, using the existing app shell patterns in `src/components/shared/app-sidebar.tsx`.
- Build the page as a dense operational surface rather than a decorative analytics page. Reuse the existing micro-visualization primitives and query-helper pattern instead of introducing a heavyweight charting dependency.
- Recommended page structure:
  - top summary row with today/month spend, today/month tokens, active budget status, and remaining budget where configured
  - trend section with 7-day and 30-day spend/token series
  - provider/runtime breakdown showing share of spend and tokens by Claude vs Codex
  - model breakdown table for model-level hotspots and unknown-pricing rows
  - audit log table with filters for date range, activity type, provider/runtime, status, and project/task association
- Show budget state directly on the page:
  - warning banner when near a configured cap
  - blocked-state banner when new provider activity is currently disabled
  - next reset time for the active blocked window
- The audit table should link back to the originating task, workflow, or schedule when context exists. Standalone events such as task assist or profile tests should still show a human-readable activity label.
- Use explicit empty and partial-data states:
  - no usage yet
  - token-only rows where pricing is unknown
  - budgets not configured

## Acceptance Criteria

- [x] Sidebar includes a first-class `Cost & Usage` navigation item
- [x] `/costs` renders current day/month spend and token summary cards
- [x] The page shows budget status and remaining budget when budgets are configured
- [x] Trend visualizations exist for spend and token usage without adding a new charting library
- [x] Provider/runtime breakdown distinguishes Claude and Codex usage clearly
- [x] Model breakdown surfaces model-level spend/token concentrations and unknown-pricing rows
- [x] Audit log lists timestamp, activity type, linked entity, provider/runtime, model, tokens, cost, and status
- [x] Audit log supports filters for provider/runtime, status, activity type, and date range
- [x] Audit rows link back to the associated task/workflow/schedule when that context exists
- [x] Empty states and blocked-budget states are represented explicitly instead of rendering blank cards

## Scope Boundaries

**Included:**
- Sidebar navigation item and dedicated dashboard route
- Summary cards, trend charts, provider/model breakdowns, and audit table
- Budget-state messaging on the dashboard
- Filters and deep links back to originating entities

**Excluded:**
- CSV export, scheduled reports, or shareable public URLs
- Custom date-range presets beyond a small bounded filter set
- Forecasting, anomaly detection, or optimization recommendations
- ROI, business-value, or time-saved reporting

## References

- Depends on: [usage-metering-ledger](usage-metering-ledger.md), [spend-budget-guardrails](spend-budget-guardrails.md)
- Related features: [micro-visualizations](micro-visualizations.md), [monitoring-dashboard](monitoring-dashboard.md), [app-shell](app-shell.md)
