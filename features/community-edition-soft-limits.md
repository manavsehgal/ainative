---
title: Community Edition Soft Limits
status: planned
priority: P0
layer: PLG Core
dependencies:
  - local-license-manager
---

# Community Edition Soft Limits

## Description

Enforce four soft limits for the Community (free) tier that create natural upgrade pressure without blocking core functionality. Each limit is checked via the `isFeatureAllowed()` gate from the local license manager and emits a `tier_limit` notification when triggered. The limits are generous enough for solo hobby use but insufficient for serious production workflows — exactly the gap that Operator and Scale tiers fill.

The four Community tier limits:

1. **50 agent memories per profile** — caps the memory extractor write site in the episodic memory system
2. **10 learned context versions per profile** — caps the versioned instruction proposals in `learned_context`
3. **5 active heartbeat schedules** — checked at schedule creation in `scheduler.ts` and the `POST /api/schedules` route
4. **30-day execution history retention** — daily cleanup job registered in `instrumentation.ts` that prunes `agent_logs` and `usage_ledger` rows older than 30 days for Community users

Paid tiers get progressively higher limits: Operator (500 memories, 100 versions, 50 schedules, 1-year retention), Scale (unlimited on all four).

## User Story

As a Community tier user, I want to use Stagent for free with reasonable limits so that I can evaluate the product fully before deciding to upgrade — and when I hit a limit, I want a clear explanation of what happened and how to unlock more capacity.

## Technical Approach

### Tier Limit Constants

New file `src/lib/license/tier-limits.ts`:

```ts
export const TIER_LIMITS = {
  community: {
    memoriesPerProfile: 50,
    contextVersionsPerProfile: 10,
    activeSchedules: 5,
    historyRetentionDays: 30,
  },
  operator: {
    memoriesPerProfile: 500,
    contextVersionsPerProfile: 100,
    activeSchedules: 50,
    historyRetentionDays: 365,
  },
  scale: {
    memoriesPerProfile: Infinity,
    contextVersionsPerProfile: Infinity,
    activeSchedules: Infinity,
    historyRetentionDays: Infinity,
  },
} as const;
```

### Enforcement Points

#### 1. Memory Cap (50/profile)

In the memory extraction write path (`src/lib/agents/memory-extractor.ts` or wherever `agent_memory` INSERT occurs):

```ts
const count = db.select({ count: sql`count(*)` })
  .from(agentMemory)
  .where(eq(agentMemory.profileId, profileId))
  .get();

if (count >= getLimitForTier('memoriesPerProfile')) {
  await emitTierLimitNotification('memory_cap', profileId, count, limit);
  return { blocked: true, reason: 'memory_cap' };
}
```

The extraction still runs (to give the agent good context for the current task) but the INSERT is skipped. The agent receives a system note: "Memory storage is at capacity for this profile."

#### 2. Learned Context Versions (10/profile)

In `src/lib/agents/learned-context.ts` at the proposal creation site:

```ts
const versionCount = db.select({ count: sql`count(*)` })
  .from(learnedContext)
  .where(eq(learnedContext.profileId, profileId))
  .get();
```

When the limit is reached, the oldest archived version can be tombstoned to make room (soft-delete with a `tombstoned` flag), or the insert is blocked. The agent is informed that self-improvement proposals are at capacity.

#### 3. Active Schedule Cap (5)

Two enforcement points:

- **API route** (`src/app/api/schedules/route.ts` POST handler): Before inserting, count active schedules. Return HTTP 402 if at limit.
- **Scheduler engine** (`src/lib/schedules/scheduler.ts`): Safety check in the poll loop — if an active schedule somehow exceeds the cap (e.g., tier downgrade), skip execution and emit notification.

```ts
const activeCount = db.select({ count: sql`count(*)` })
  .from(schedules)
  .where(eq(schedules.status, 'active'))
  .get();

if (activeCount >= getLimitForTier('activeSchedules')) {
  return NextResponse.json(
    { error: 'Schedule limit reached', upgradeUrl: '/settings/subscription', requiredTier: 'operator' },
    { status: 402 }
  );
}
```

#### 4. History Retention (30 days)

Daily cleanup job registered in `src/instrumentation.ts` (Next.js `register()` hook):

```ts
function scheduleHistoryCleanup() {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  async function cleanup() {
    const tier = await getCurrentTier();
    const retentionDays = TIER_LIMITS[tier].historyRetentionDays;
    if (retentionDays === Infinity) return;

    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    db.delete(agentLogs).where(lt(agentLogs.createdAt, cutoff)).run();
    db.delete(usageLedger).where(lt(usageLedger.createdAt, cutoff)).run();
  }

  setInterval(cleanup, CLEANUP_INTERVAL);
  cleanup(); // Run once on startup
}
```

### Notification Type Extension

Add `tier_limit` to the notifications type enum in `src/lib/db/schema.ts`:

```ts
// Existing: 'info' | 'warning' | 'error' | 'tool_request'
// New:      'info' | 'warning' | 'error' | 'tool_request' | 'tier_limit'
```

Tier limit notifications include structured metadata:

```ts
{
  type: 'tier_limit',
  title: 'Memory limit reached',
  message: 'Profile "researcher" has 50/50 agent memories. Upgrade to Operator for 500.',
  metadata: JSON.stringify({
    limitType: 'memory_cap',
    currentCount: 50,
    maxCount: 50,
    profileId: 'researcher',
    requiredTier: 'operator',
    upgradeUrl: '/settings/subscription',
  }),
}
```

### HTTP 402 Response Format

All API endpoints that enforce limits return a consistent 402 response:

```json
{
  "error": "Memory limit reached for profile 'researcher'",
  "upgradeUrl": "/settings/subscription",
  "requiredTier": "operator",
  "limitType": "memory_cap",
  "current": 50,
  "max": 50
}
```

### Helper Functions

```ts
// src/lib/license/limit-check.ts
export function getLimitForTier(limitKey: keyof TierLimits): number;
export function checkLimit(limitKey: string, currentCount: number): LimitCheckResult;
export function emitTierLimitNotification(limitType: string, context: LimitContext): Promise<void>;
```

`checkLimit()` returns `{ allowed: boolean, current: number, max: number, requiredTier: string }` — used by both API routes and internal enforcement points.

### Tier Downgrade Handling

When a user downgrades (or a subscription lapses), existing data is not deleted. Instead:

- Excess memories become read-only (no new writes until under limit)
- Excess schedules are paused (not deleted) with a `paused_reason: 'tier_downgrade'`
- History cleanup begins on the next daily cycle
- Learned context proposals are blocked but existing versions remain

## Acceptance Criteria

- [ ] `TIER_LIMITS` constant defines limits for community, operator, and scale tiers
- [ ] Memory extraction blocks INSERT when profile reaches 50 memories on Community tier
- [ ] Learned context blocks new version proposals at 10 per profile on Community tier
- [ ] Schedule creation returns HTTP 402 at 5 active schedules on Community tier
- [ ] Scheduler engine skips execution for excess schedules after tier downgrade
- [ ] Daily cleanup job in `instrumentation.ts` prunes history older than tier retention period
- [ ] `tier_limit` notification type added to schema enum
- [ ] Each enforcement point emits a `tier_limit` notification with structured metadata
- [ ] HTTP 402 responses include `error`, `upgradeUrl`, `requiredTier`, `limitType`, `current`, `max`
- [ ] `checkLimit()` helper is reusable across all enforcement points
- [ ] Tier downgrade pauses excess schedules and blocks excess writes (no data deletion)
- [ ] Paid tiers (operator, scale) have proportionally higher limits
- [ ] All limit checks call `isFeatureAllowed()` from the license manager

## Scope Boundaries

**Included:**
- Four soft limits with enforcement at write sites and API routes
- `tier_limit` notification type with structured metadata
- HTTP 402 response format for API limit hits
- Daily history cleanup job
- Tier downgrade grace handling (pause, block, no delete)
- Shared `checkLimit()` and `emitTierLimitNotification()` helpers

**Excluded:**
- Hard rate limiting (requests per minute) — separate concern, not tier-gated
- Usage-based billing (pay per execution) — see stripe-billing-integration
- Real-time usage dashboards — see subscription-management-ui for usage summary cards
- Limit configuration UI (admin override of limits) — constants are code-level for now
- Notification UI changes — existing inbox handles `tier_limit` type with standard rendering

## References

- Depends on: `features/local-license-manager.md` — provides `isFeatureAllowed()` and tier detection
- Related: `features/agent-episodic-memory.md` — memory cap enforced at extraction write site
- Related: `features/scheduled-prompt-loops.md` — schedule cap enforced in scheduler.ts
- Scheduler startup: `src/instrumentation.ts` — history cleanup job registered here
- Notification schema: `src/lib/db/schema.ts` — notifications table type enum
- Learned context: `src/lib/agents/learned-context.ts` — version cap enforced here
- Usage ledger: `src/lib/db/schema.ts` — `usage_ledger` table (history retention target)
