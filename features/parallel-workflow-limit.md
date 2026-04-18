---
title: Parallel Workflow Limit
status: completed
priority: P2
layer: PLG Core
dependencies:
  - local-license-manager
---

# Parallel Workflow Limit

> **Superseded by `community-edition-simplification` (2026-04-13).** This feature shipped but was later fully reverted when ainative pivoted to a 100% free Community Edition with no tiers, billing, or cloud dependency. Kept as historical record.

## Description

Enforce tier-based limits on the number of concurrently executing workflows: Community = 3, Operator = 10, Scale = unlimited. The check happens at the execution boundary — when `setExecution()` is called in the execution manager — and returns a clear error before any resources are consumed. This is a lightweight guardrail that leverages the existing execution tracking infrastructure with minimal new code.

Unlike the soft limits in community-edition-soft-limits (which cap stored data), this limit caps active compute. A user who hits this limit can either wait for a running workflow to finish or upgrade for more parallelism.

## User Story

As a Community tier user running multiple workflows simultaneously, I want a clear message when I've reached my concurrent limit so I know to wait for one to finish or upgrade — rather than having workflows silently queue or fail.

## Technical Approach

### Tier Constants

Add to `src/lib/license/tier-limits.ts` (extending the existing TIER_LIMITS object):

```ts
export const TIER_LIMITS = {
  community: {
    // ... existing limits
    parallelWorkflows: 3,
  },
  operator: {
    // ... existing limits
    parallelWorkflows: 10,
  },
  scale: {
    // ... existing limits
    parallelWorkflows: Infinity,
  },
} as const;
```

### Pre-Execution Check

In `src/lib/agents/execution-manager.ts`, add a concurrent workflow count check at the top of `setExecution()`:

```ts
export async function setExecution(workflowId: string, taskId: string) {
  // Count currently active workflows (status = 'running')
  const activeCount = db
    .select({ count: sql<number>`count(distinct ${tasks.workflowId})` })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'running'),
        isNotNull(tasks.workflowId)
      )
    )
    .get()?.count ?? 0;

  const tier = await getCurrentTier();
  const limit = TIER_LIMITS[tier].parallelWorkflows;

  if (activeCount >= limit) {
    return {
      blocked: true,
      error: `Concurrent workflow limit reached (${activeCount}/${limit})`,
      upgradeUrl: '/settings/subscription',
      requiredTier: getNextTier(tier),
    };
  }

  // ... existing execution logic
}
```

The count uses `count(distinct workflowId)` from the tasks table where status is `running` — this counts unique active workflows, not individual running tasks within those workflows.

### API Response

When the execution manager returns `blocked: true`, the workflow execution API route (`POST /api/workflows/[id]/execute` or `POST /api/tasks/[id]/execute`) returns HTTP 429:

```json
{
  "error": "Concurrent workflow limit reached (3/3)",
  "upgradeUrl": "/settings/subscription",
  "requiredTier": "operator",
  "limitType": "parallel_workflows",
  "current": 3,
  "max": 3
}
```

HTTP 429 (Too Many Requests) is used instead of 402 because this is a rate/concurrency limit rather than a feature gate. The `Retry-After` header is not set because the wait time depends on when a running workflow completes, which is unpredictable.

### UI Error Display

In the workflow execution UI (`src/components/workflows/` and task execution components):

```tsx
{executionError?.limitType === 'parallel_workflows' && (
  <div className="surface-card-muted rounded-xl border border-status-warning/25 p-4 flex items-center gap-3">
    <AlertTriangle className="size-5 text-status-warning shrink-0" />
    <div className="flex-1">
      <p className="text-sm font-medium">Workflow limit reached</p>
      <p className="text-sm text-muted-foreground">
        {executionError.current}/{executionError.max} workflows running.
        Wait for one to finish or{' '}
        <Link href={executionError.upgradeUrl} className="text-primary underline">
          upgrade to {executionError.requiredTier}
        </Link>.
      </p>
    </div>
  </div>
)}
```

The error is displayed inline below the execute button, not as a toast — it's a persistent state, not a transient event.

### Edge Cases

1. **Standalone tasks** (no workflowId): Not counted toward the workflow limit. This limit specifically targets workflow parallelism, not individual task execution.
2. **Workflow with multiple steps**: A single workflow execution counts as 1 regardless of how many sequential tasks it contains.
3. **Paused workflows**: Not counted as active. Only `status = 'running'` tasks contribute to the count.
4. **Race condition**: Two workflows submitted simultaneously might both pass the check. This is acceptable — the limit is a soft guardrail, not a hard mutex. The slight overshoot (4/3) corrects on the next check.
5. **Tier downgrade**: Running workflows are not killed. The limit only applies to new executions. Currently active workflows run to completion.

### Notification

When blocked, a `tier_limit` notification is emitted (reusing the pattern from community-edition-soft-limits):

```ts
await emitTierLimitNotification('parallel_workflows', {
  current: activeCount,
  max: limit,
  requiredTier: getNextTier(tier),
});
```

## Acceptance Criteria

- [ ] `parallelWorkflows` limit added to `TIER_LIMITS` for all three tiers (3, 10, Infinity)
- [ ] `setExecution()` in execution-manager.ts checks active workflow count before starting
- [ ] Active count uses `count(distinct workflowId)` from tasks where status = 'running'
- [ ] HTTP 429 returned when limit is reached, with structured error body
- [ ] Inline error displayed in workflow UI below execute button
- [ ] Error includes upgrade link to `/settings/subscription`
- [ ] Standalone tasks (no workflowId) are not counted toward the limit
- [ ] Paused workflows are not counted as active
- [ ] Running workflows are not killed on tier downgrade
- [ ] `tier_limit` notification emitted when blocked
- [ ] Slight race condition overshoot (e.g., 4/3) is tolerated and self-corrects

## Scope Boundaries

**Included:**
- Pre-execution concurrency check in execution-manager.ts
- HTTP 429 response with upgrade metadata
- Inline error display in workflow execution UI
- `parallelWorkflows` constants in tier-limits.ts
- Notification emission on block

**Excluded:**
- Workflow queuing (auto-retry when a slot opens) — future enhancement
- Per-profile workflow limits (all profiles share the global limit) — future
- Execution time limits (max duration per workflow) — separate concern
- WebSocket real-time count updates — page refresh shows current state
- Admin override to temporarily raise the limit — code-level constants only
- Dashboard showing active workflow count — visible in existing workflow list

## References

- Depends on: `features/local-license-manager.md` — `getCurrentTier()`, tier detection
- Related: `features/community-edition-soft-limits.md` — same enforcement pattern, `tier_limit` notification type
- Execution manager: `src/lib/agents/execution-manager.ts` — `setExecution()` is the enforcement point
- Workflow engine: `src/lib/workflows/engine.ts` — workflow execution orchestration
- Task status constants: `src/lib/constants/task-status.ts` — `running` status definition
- Tier limits: `src/lib/license/tier-limits.ts` — shared limit constants file
