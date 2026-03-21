---
title: "Cost & Usage"
category: "feature-reference"
section: "cost-usage"
route: "/costs"
tags: [costs, usage, budget, metering, tokens, spend, guardrails]
features: ["cost-and-usage-dashboard", "usage-metering-ledger", "spend-budget-guardrails"]
screengrabCount: 1
lastUpdated: "2026-03-21"
---

# Cost & Usage

Track spend across providers and monitor token consumption with the cost and usage dashboard. The usage metering ledger records every token used by task, project, and provider, while budget guardrails enforce configurable spend caps to prevent runaway costs. Visual meters give you an at-a-glance view of current spend versus your configured budget.

## Screenshots

![Cost and usage dashboard with spend breakdown](../screengrabs/cost-usage-list.png)
*The cost and usage dashboard showing spend metrics, provider breakdown, and budget pacing indicators.*

## Key Features

### Spend Dashboard
The cost dashboard provides an overview of total spend across all provider runtimes. Key metrics include total spend to date, current period spend, and trend indicators showing whether costs are increasing or decreasing relative to prior periods.

### Usage Metering Ledger
Every agent execution records token consumption in the usage ledger. The ledger tracks input tokens, output tokens, and total tokens broken down by individual task, parent project, and provider runtime. This granular data enables precise cost attribution and optimization.

### Provider Breakdown
Spend is segmented by provider runtime, showing separate cost totals for Claude (Agent SDK) and Codex (App Server). The breakdown helps you understand which provider is driving costs and make informed decisions about runtime selection.

### Budget Guardrails
Configure spend caps to prevent unexpected cost overruns. Set an overall budget limit and monthly allocation splits. When spend approaches the cap, alerts notify you before the limit is reached. Once the cap is hit, guardrails can pause new executions to prevent further charges.

### Visual Budget Meters
Progress bars and visual meters display current spend relative to your configured budget. Color-coded indicators shift from green to yellow to red as spend approaches the cap, providing immediate visual feedback on budget health.

## How To

### Review Current Spend
1. Navigate to `/costs` from the sidebar under the **Configure** group.
2. View the total spend summary at the top of the dashboard.
3. Check the provider breakdown to see Claude vs. Codex spend.
4. Review the visual meters for budget pacing.

### Set a Budget Cap
1. Navigate to `/settings` and open the **Budget** section.
2. Enter an overall spend cap amount.
3. Configure the monthly split to distribute the budget across the billing period.
4. Save the settings. The budget meters on the cost dashboard will reflect the new cap.

### Investigate High Spend
1. Open the cost dashboard at `/costs`.
2. Identify which provider or project is contributing the most spend.
3. Drill into the usage ledger to find high-token-count tasks.
4. Consider switching to a different provider runtime or adjusting task prompts to reduce token usage.

## Related
- [Settings](./settings.md)
- [Monitoring](./monitoring.md)
- [Schedules](./schedules.md)
