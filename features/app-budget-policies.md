---
title: App Budget Policies
status: deferred
priority: P3
milestone: post-mvp
source: brainstorm session 2026-04-11
dependencies: [app-extended-primitives-tier2]
---

# App Budget Policies

> **Deferred 2026-04-14.** Part of the marketplace / apps-distribution vision, which has no active plan after the pivot to 100% free Community Edition. Kept in the backlog pending future product direction.

## Description

Autonomous apps with scheduled agent runs can silently accumulate significant
token usage and API costs. Today, the `usage_ledger` table tracks global
usage but has no mechanism for per-schedule or per-app caps. An app that
ships a "daily market analysis" schedule with no cost ceiling could burn
through a user's API budget in days if the prompt grows unexpectedly or
the agent enters a tool-call loop.

This feature adds `budgetPolicies` as a new primitive on `AppBundle`,
allowing app creators to declare per-schedule token and dollar caps with
configurable enforcement actions. The runtime checks budgets before and
after each scheduled run, and the UI surfaces budget status on schedule
cards with warning banners when approaching limits.

## User Story

As a user, I want installed apps to respect declared budget limits on their
scheduled runs so that no single app can silently consume my entire API
allocation — and I want clear visibility into how much each app's schedules
are costing.

As an app creator, I want to declare sensible default budget policies for
my app's schedules so that users trust my app will not run up unexpected
costs.

## Technical Approach

### 1. New TypeScript interfaces (`src/lib/apps/types.ts`)

```ts
export interface AppBudgetPolicy {
  key: string;
  scheduleKey: string;                       // references AppScheduleTemplate.key
  maxTokensPerRun?: number;                  // hard cap per single execution
  maxCostPerRun?: number;                    // USD cap per single execution
  maxTokensPerDay?: number;                  // rolling 24h token ceiling
  maxCostPerDay?: number;                    // rolling 24h USD ceiling
  maxTokensPerMonth?: number;                // rolling 30d token ceiling
  maxCostPerMonth?: number;                  // rolling 30d USD ceiling
  onExceed: "pause" | "notify" | "continue-with-warning";
}

export interface AppBudgetStatus {
  scheduleKey: string;
  policyKey: string;
  tokensUsedToday: number;
  costUsedToday: number;
  tokensUsedThisMonth: number;
  costUsedThisMonth: number;
  lastRunTokens: number;
  lastRunCost: number;
  status: "ok" | "warning" | "exceeded" | "paused";
  warningThreshold: number;                  // percentage (default 80%)
}
```

Extend `AppBundle`:

```ts
export interface AppBundle {
  // ... existing fields ...
  budgetPolicies?: AppBudgetPolicy[];
}
```

### 2. Zod validation schema (`src/lib/apps/validation.ts`)

```ts
const budgetPolicySchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  scheduleKey: z.string().regex(/^[a-z0-9-]+$/),
  maxTokensPerRun: z.number().int().min(100).max(10_000_000).optional(),
  maxCostPerRun: z.number().min(0.001).max(100).optional(),
  maxTokensPerDay: z.number().int().min(1000).max(100_000_000).optional(),
  maxCostPerDay: z.number().min(0.01).max(1000).optional(),
  maxTokensPerMonth: z.number().int().min(10000).max(1_000_000_000).optional(),
  maxCostPerMonth: z.number().min(0.10).max(10000).optional(),
  onExceed: z.enum(["pause", "notify", "continue-with-warning"]),
}).refine(
  (data) => {
    // At least one limit must be set
    return (
      data.maxTokensPerRun !== undefined ||
      data.maxCostPerRun !== undefined ||
      data.maxTokensPerDay !== undefined ||
      data.maxCostPerDay !== undefined ||
      data.maxTokensPerMonth !== undefined ||
      data.maxCostPerMonth !== undefined
    );
  },
  { message: "Budget policy must declare at least one limit" }
);
```

Cross-reference: `scheduleKey` must reference a declared `schedules[].key`.

### 3. Bootstrap handler (`src/lib/apps/service.ts`)

**`bootstrapBudgetPolicies(appId, policies, resourceMap)`**

For each budget policy:

1. Resolve `scheduleKey` to a real schedule ID via `resourceMap.schedules`.
2. Store the policy in a new `budget_policies` table (or as JSON in the
   app instance's `resourceMapJson`). Using `resourceMapJson` is simpler
   and avoids a new migration:

   ```ts
   resourceMap.budgetPolicies = {
     [policy.key]: {
       scheduleId: resourceMap.schedules[policy.scheduleKey],
       ...policy,
     },
   };
   ```

3. If the app ships with `onExceed: "pause"`, the schedule starts in
   an active state but will auto-pause if the budget is exceeded on
   the first run.

### 4. Runtime enforcement

Modify the schedule executor (`src/lib/schedules/scheduler.ts`) to check
budget policies before and after each run:

**Pre-run check:**

```ts
async function checkBudgetBeforeRun(
  scheduleId: string,
  appId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const policy = getBudgetPolicyForSchedule(appId, scheduleId);
  if (!policy) return { allowed: true };

  const usage = await getUsageForSchedule(scheduleId, policy);

  // Check daily limits
  if (policy.maxTokensPerDay && usage.tokensUsedToday >= policy.maxTokensPerDay) {
    return handleExceed(policy, "daily token limit reached");
  }
  if (policy.maxCostPerDay && usage.costUsedToday >= policy.maxCostPerDay) {
    return handleExceed(policy, "daily cost limit reached");
  }

  // Check monthly limits
  if (policy.maxTokensPerMonth && usage.tokensUsedThisMonth >= policy.maxTokensPerMonth) {
    return handleExceed(policy, "monthly token limit reached");
  }
  if (policy.maxCostPerMonth && usage.costUsedThisMonth >= policy.maxCostPerMonth) {
    return handleExceed(policy, "monthly cost limit reached");
  }

  return { allowed: true };
}
```

**Post-run check:**

After the agent run completes and usage is recorded in `usage_ledger`,
check per-run limits:

```ts
async function checkBudgetAfterRun(
  scheduleId: string,
  appId: string,
  runUsage: { tokens: number; cost: number }
): Promise<void> {
  const policy = getBudgetPolicyForSchedule(appId, scheduleId);
  if (!policy) return;

  if (policy.maxTokensPerRun && runUsage.tokens > policy.maxTokensPerRun) {
    await handleExceedAction(policy, scheduleId,
      `Run used ${runUsage.tokens} tokens (limit: ${policy.maxTokensPerRun})`);
  }
  if (policy.maxCostPerRun && runUsage.cost > policy.maxCostPerRun) {
    await handleExceedAction(policy, scheduleId,
      `Run cost $${runUsage.cost.toFixed(4)} (limit: $${policy.maxCostPerRun})`);
  }
}
```

**Enforcement actions:**

```ts
function handleExceedAction(
  policy: AppBudgetPolicy,
  scheduleId: string,
  reason: string
): void {
  switch (policy.onExceed) {
    case "pause":
      pauseSchedule(scheduleId);
      createNotification({
        type: "warning",
        title: "Schedule paused — budget exceeded",
        body: reason,
      });
      break;
    case "notify":
      createNotification({
        type: "warning",
        title: "Budget warning",
        body: reason,
      });
      break;
    case "continue-with-warning":
      // Log warning but don't interrupt
      console.warn(`[budget] ${reason}`);
      break;
  }
}
```

### 5. Per-schedule cost tracking (new platform capability)

The existing `usage_ledger` table tracks usage per task (`taskId` column)
and per runtime (`runtimeId`), but does not link usage to a specific
schedule. Add schedule-level tracking:

**Option A (preferred):** Add a `scheduleId` column to `usage_ledger`:

```sql
ALTER TABLE usage_ledger ADD COLUMN schedule_id TEXT
  REFERENCES schedules(id) ON DELETE SET NULL;
CREATE INDEX idx_usage_ledger_schedule_id ON usage_ledger(schedule_id);
```

The schedule executor already knows the schedule ID when it creates tasks —
pass it through to the usage recording path.

**Option B (lighter):** Derive schedule association from the task chain.
Schedules create tasks; tasks create usage_ledger entries. Join
`schedules → tasks → usage_ledger` to aggregate. This avoids a migration
but is slower for budget checks on every run.

Go with Option A for query performance — budget checks happen on every
scheduled run and must be fast.

### 6. Usage aggregation queries

```ts
async function getUsageForSchedule(
  scheduleId: string,
  policy: AppBudgetPolicy
): Promise<AppBudgetStatus> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Aggregate from usage_ledger where schedule_id matches
  const dailyUsage = db
    .select({
      totalTokens: sql<number>`SUM(${usageLedger.totalTokens})`,
      totalCost: sql<number>`SUM(${usageLedger.totalCostUsd})`,
    })
    .from(usageLedger)
    .where(
      and(
        eq(usageLedger.scheduleId, scheduleId),
        gte(usageLedger.finishedAt, dayAgo)
      )
    )
    .get();

  // Similar query for monthly window
  // ...

  return {
    scheduleKey: policy.scheduleKey,
    policyKey: policy.key,
    tokensUsedToday: dailyUsage?.totalTokens ?? 0,
    costUsedToday: dailyUsage?.totalCost ?? 0,
    // ... monthly fields ...
    status: computeStatus(dailyUsage, monthlyUsage, policy),
    warningThreshold: 80,
  };
}
```

### 7. UI: Budget status on schedule cards

Extend the schedule card component (`src/components/schedules/`) to show
budget status when a budget policy is associated:

- **Green badge** — "Budget OK" (under 80% of any limit)
- **Amber badge** — "Budget Warning" (80-100% of any limit)
- **Red badge** — "Budget Exceeded" (over 100%, schedule may be paused)
- **Tooltip** — Shows breakdown: tokens used/limit, cost used/limit,
  per-run last values

Add a warning banner to the schedule detail view when budget is in
warning or exceeded state.

### 8. Budget override for users

Users can override app-declared budget policies via the installed app
settings page. An override can:

- Increase or decrease any limit
- Change the `onExceed` action
- Disable the budget policy entirely (user takes full responsibility)

Overrides are stored in `resourceMapJson` alongside the original policy,
with a `userOverride: true` flag.

### 9. Built-in app examples (`src/lib/apps/builtins.ts`)

**wealth-manager:**

```ts
budgetPolicies: [
  {
    key: "daily-review-budget",
    scheduleKey: "daily-review",
    maxTokensPerRun: 50000,
    maxCostPerRun: 0.50,
    maxTokensPerDay: 100000,
    maxCostPerDay: 1.00,
    onExceed: "notify",
  },
],
```

**growth-module:**

```ts
budgetPolicies: [
  {
    key: "experiment-check-budget",
    scheduleKey: "experiment-check",
    maxTokensPerRun: 30000,
    maxCostPerRun: 0.30,
    maxTokensPerDay: 60000,
    maxCostPerDay: 0.60,
    maxTokensPerMonth: 1000000,
    maxCostPerMonth: 10.00,
    onExceed: "pause",
  },
],
```

## Acceptance Criteria

- [ ] `AppBudgetPolicy` and `AppBudgetStatus` interfaces added to
      `src/lib/apps/types.ts`.
- [ ] Zod schema validates at least one limit is set per policy.
- [ ] `scheduleKey` cross-reference validation catches invalid references.
- [ ] `bootstrapBudgetPolicies()` stores policies in `resourceMapJson`.
- [ ] `usage_ledger` table has a `schedule_id` column (new migration +
      bootstrap sync).
- [ ] Schedule executor records `schedule_id` on every usage entry.
- [ ] Pre-run budget check blocks execution when daily/monthly limits are
      exceeded (for `pause` action).
- [ ] Post-run budget check enforces per-run limits after the fact.
- [ ] `pause` action auto-pauses the schedule and creates a notification.
- [ ] `notify` action creates a notification but allows the run to continue.
- [ ] `continue-with-warning` action logs without interruption.
- [ ] Schedule cards show budget status badges (green/amber/red).
- [ ] Users can override budget policies from the installed app settings.
- [ ] `wealth-manager` and `growth-module` builtins include budget policy
      examples.
- [ ] Unit tests cover: pre-run check, post-run check, each onExceed
      action, aggregation queries, user overrides.
- [ ] `npm test` passes; `npx tsc --noEmit` clean.

## Scope Boundaries

**Included:**
- `AppBudgetPolicy` type, Zod schema, bootstrap handler
- `schedule_id` column on `usage_ledger` (migration + bootstrap)
- Per-schedule usage aggregation queries
- Runtime enforcement in schedule executor (pre-run + post-run)
- Budget status badges on schedule cards
- User budget override mechanism
- Built-in app examples

**Excluded:**
- Global (non-app) budget caps (separate concern — platform-level feature)
- Real-time cost estimation during a run (only check before/after)
- Cost alerting via external channels (email/Slack) — use platform
  notifications only
- Token price lookup service (use static price table per model)
- Budget policies for non-schedule primitives (e.g., chat tool calls)
- Multi-currency support (USD only)
- Budget visualization charts / historical trends (future enhancement)

## References

- Source: brainstorm session 2026-04-11, plan `flickering-petting-hammock.md`
  section 3d
- Related: `app-extended-primitives-tier2`, `marketplace-trust-ladder`
- Files to modify:
  - `src/lib/apps/types.ts` — new interfaces, extend AppBundle
  - `src/lib/apps/validation.ts` — budget policy Zod schema
  - `src/lib/apps/service.ts` — bootstrap handler
  - `src/lib/apps/builtins.ts` — examples in both builtin apps
  - `src/lib/schedules/scheduler.ts` — pre-run and post-run budget checks
  - `src/lib/db/schema.ts` — add `scheduleId` column to `usageLedger`
  - `src/lib/db/bootstrap.ts` — sync new column in bootstrap DDL
  - `src/components/schedules/` — budget status badges on schedule cards
- Files to create:
  - `src/lib/apps/budget-checker.ts` — budget enforcement logic
    (aggregation queries, status computation, exceed handlers)
  - `src/lib/db/migrations/00XX_add_usage_ledger_schedule_id.sql` — new
    migration for schedule_id column
  - `src/lib/apps/__tests__/budget-policies.test.ts` — unit tests for
    budget enforcement
