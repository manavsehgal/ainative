# Schedule Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent concurrent scheduled agents from starving the chat SSE stream by introducing a global concurrency cap enforced via atomic slot claim, per-schedule turn budgets, lease-based timeouts with a reaper, a minimal pre-flight collision warning, and a time-series metrics table for evidence-based cap tuning.

**Architecture:** Changes are concentrated in `src/lib/schedules/scheduler.ts`, a new `src/lib/schedules/slot-claim.ts` primitive, and the claude runtime adapter. Coordination uses atomic single-SQL conditional updates (no check-then-act). Lease expiry via `AbortController` reaped at each tick. Per-schedule turn budget is a new `max_turns` column propagated into the `tasks` row at firing time and threaded into the SDK `query()` call. Chat soft pressure uses a module-level `Set<conversationId>` in `src/lib/chat/active-streams.ts` checked by `tickScheduler()` to defer (not block) new firings.

**Tech Stack:** TypeScript, better-sqlite3 (synchronous), Drizzle ORM, `@anthropic-ai/claude-agent-sdk`, `cron-parser` (already in tree for `expandCronMinutes`), vitest with real temp-dir SQLite, Next.js `register()` instrumentation hook.

**Worktree guidance:** This plan makes invasive changes to scheduler semantics. Run it in a dedicated worktree:

```bash
git worktree add -b schedule-orchestration ../stagent-schedule-orchestration main
cd ../stagent-schedule-orchestration
```

---

## NOT in scope

Explicit deferrals to prevent scope re-creep during execution:

- **`concurrencyGroup` column and per-group locks** — deferred to a follow-up spec. The 2026-04-08 incident was a global-cap problem; groups add a second coordination primitive whose correctness depends on solving the first. Ship global cap alone.
- **Auto-stagger endpoint, 48h forecast, collision-forecast notifications** — future spec "Schedule Predictability & Forecasting". Only the minimal save-time collision *warning* is in this plan.
- **Turn drift detection across 3-run moving window, efficiency scoring (`useful_actions / total_turns`)** — future spec "Schedule Observability".
- **`turnBudgetAction: 'optimize'` meta-agent prompt rewriter** — future spec "Agent Self-Optimization".
- **Hard chat priority / `pauseSchedulesDuringChat` setting** — only if the soft pressure signal proves insufficient post-launch.
- **Dynamic adaptive cap** based on measured P99 chat latency — architect explicitly recommended against until static cap proves insufficient.
- **`usage_ledger.turn_count` column** — derivable from `schedule_firing_metrics` and `agent_logs`.
- **`swarm_snapshots` time-series table** — deferred to Spec C follow-ups ("Swarm Activity Feed").
- **Worker-thread isolation for the agent runtime** — architectural bet, separate design effort.
- **UI visibility layer** — delivered by Spec C (Swarm Visibility), which depends on this plan's API shape but is a separate plan.

## What already exists

Reusable code and patterns confirmed during exploration. Do not rebuild these:

- **`src/lib/schedules/scheduler.ts:238-252`** — atomic per-schedule claim via conditional WHERE UPDATE. The new global-cap claim follows the same single-SQL-statement pattern.
- **`src/lib/schedules/scheduler.ts:51-95`** — `drainQueue()` with module-level `draining` flag. The new atomic claim must be correct under the drain + tick interleaving.
- **`src/lib/schedules/scheduler.ts:304-322`** — existing title-pattern sibling guard. Keep as-is; global cap layers on top.
- **`src/lib/schedules/scheduler.ts:122-133`** — `detectFailureReason()`. Keep as fallback; runtime adapter will write explicit `failure_reason` at terminal transitions.
- **`src/lib/schedules/scheduler.ts:140-186`** — `recordFiringMetrics()` is the natural hook for inserting into the new firing-metrics table.
- **`src/lib/schedules/interval-parser.ts:92`** — `expandCronMinutes()` expands a cron into the list of fire minutes. Reuse for collision-check bucketing.
- **`src/lib/agents/execution-manager.ts:14-62`** — in-memory `Map<taskId, RunningExecution>` with `abortController` on each entry. The reaper uses this to abort expired leases.
- **`src/lib/agents/claude-agent.ts:444-470`** — SDK `query()` invocation. `maxTurns` is passed through `ctx.maxTurns`. Override when a task came from a schedule with its own `max_turns`.
- **`src/lib/agents/claude-agent.ts:358-414`** — `buildTaskQueryContext()` resolves `maxTurns` from profile fallback. Keep as default; schedule-level override takes precedence.
- **`src/lib/db/bootstrap.ts:266-275`** — `addColumnIfMissing()` helper: tolerates `duplicate column` errors so `ALTER TABLE ADD COLUMN` is idempotent across dev and deployed DBs. Use this for all new columns.
- **`src/lib/data/clear.ts`** — FK-safe deletion order. Tests enforce that every schema table is deleted. New tables must be added here.
- **`src/lib/settings/helpers.ts:12`** — `getSettingSync(key)` for in-process reads. Use sync helpers inside hot scheduler paths to avoid needless awaits.
- **`src/lib/constants/settings.ts`** — `SETTINGS_KEYS` enum. Add new keys here.
- **`src/lib/chat/engine.ts:256`** — chat stream start point (where `fullText = ""` is initialized and streaming begins). The `active-streams.ts` set will be populated here and cleared in the finally block alongside `cleanupConversation()`.
- **`src/test/setup.ts:6-10`** — vitest setup creates a temp-dir SQLite per run via `STAGENT_DATA_DIR`. Tests can freely insert/query against a real DB.
- **`src/lib/chat/reconcile.ts`** (NEW from Spec B hotfix, already committed) — `finalizeStreamingMessage()` and `reconcileStreamingMessages()`. Pattern reference for pure DB-only helpers tested in isolation.

## Error & Rescue Registry

HOLD-mode feature — each primitive's failure path is enumerated and rescued.

| Error | Trigger | Impact | Rescue |
|---|---|---|---|
| Two ticks race on slot claim | `drainQueue()` concurrent with `tickScheduler()` via `.then()` chain at scheduler.ts:420 | Cap breached if naive check-then-act | Atomic single-SQL claim — `changes=0` means lost the race; leave row in `queued`, let next drain retry |
| SDK hangs mid-run | Upstream Opus stall, network partition, subprocess deadlock | Slot held forever, cap permanently reduced (e.g. 2→1 effective) | Lease expiry + reaper at each tick aborts via `execution-manager.RunningExecution.abortController`; DB update to `failed`/`lease_expired` frees the slot |
| Reaper itself throws | Rare DB error during `SELECT expired` or per-task `UPDATE` | Expired leases accumulate | Reaper catches per-task errors; the sweep continues to the next expired row. Next tick retries anything missed |
| Reaper aborts a task that legitimately needs 25 min | Per-schedule `max_run_duration_sec` not configured; default 20 min too tight | Legitimate run killed | Per-schedule `max_run_duration_sec` override. Drift-warn when a run completes at >80% of lease on 3 consecutive firings so users raise the cap |
| User sets `max_turns=10` on schedule averaging 40 | Config footgun | Would trip auto-pause in 3 firings under shared streak | First-breach grace + separate `turn_budget_breach_streak` with threshold 5; drift warning at 2 advising raise |
| `detectFailureReason()` misclassifies | SDK error text changes format | Wrong streak incremented | Runtime adapter writes explicit `failure_reason` at terminal transitions; string-match is fallback only |
| Manual execute spammed | User double-clicks "Run now" 5× | Could exceed cap under naive design | Manual honors cap by default; returns `429 {error, slotEtaSec}`; `?force=true` bypasses with audit log |
| Chat pressure delay causes schedule to miss a minute | User has `* * * * *` cron, chat is streaming for 45s | Minute skipped | 30s delay is one-shot per tick; next tick re-evaluates. Documented in UI help text |
| Firing metrics unbounded growth | High-frequency schedules over months | Disk bloat | Periodic cleanup `DELETE WHERE fired_at < now() - 30 days` in a post-tick maintenance pass |
| Clock skew between JS `Date.now()` and SQLite `CURRENT_TIMESTAMP` | Container restart, NTP drift | `lease_expires_at` mismatches | Use consistent Unix-ms integers everywhere; no mixing of SQL clock and JS clock inside one comparison |
| Collision check runs against in-flight chat-pressure-shifted fire time | Deterministic warning becomes nondeterministic | Confusing UX | Collision check always runs against *nominal* cron expansion, never adjusted times |
| `SCHEDULE_MAX_CONCURRENT` env var typo | User sets `=abc` | Silent fallback to default | `parseInt` with NaN guard; log warning; use default. Same pattern as existing SDK timeout handling |
| Tests pollute each other via shared temp DB | Multiple test files hitting same tables | Flaky tests | Every test file uses `beforeEach` to delete in FK-safe order (pattern from `src/lib/chat/__tests__/reconcile.test.ts`) |

---

## File Structure

**New files:**

```
src/lib/schedules/slot-claim.ts              — Atomic claim primitive + reap helper
src/lib/schedules/collision-check.ts         — 24h cron expansion + 5-min bucket overlap detector
src/lib/schedules/config.ts                  — Config reader helpers for the new settings keys
src/lib/chat/active-streams.ts               — Module-level Set tracking in-flight chat streams
src/app/api/schedules/[id]/execute/route.ts  — Manual fire endpoint (does not exist today)

src/lib/schedules/__tests__/slot-claim.test.ts            — Race + reap tests
src/lib/schedules/__tests__/collision-check.test.ts       — Overlap detection tests
src/lib/schedules/__tests__/turn-budget.test.ts           — First-breach grace + streak threshold
src/lib/schedules/__tests__/tick-scheduler.test.ts        — Cap + chat pressure
src/lib/schedules/__tests__/firing-metrics.test.ts        — Metrics insertion
src/lib/schedules/__tests__/integration.test.ts           — End-to-end
src/lib/schedules/__tests__/config.test.ts                — Config reader
src/lib/chat/__tests__/active-streams.test.ts             — Set lifecycle
src/lib/agents/__tests__/failure-reason.test.ts           — Classifier
src/app/api/schedules/__tests__/execute-route.test.ts     — 429 + force bypass

.claude/skills/architect/references/tdr-atomic-slot-claim.md
.claude/skills/architect/references/tdr-evidence-based-cap.md
.claude/skills/architect/references/tdr-failure-class-streaks.md
.claude/skills/architect/references/tdr-manual-honors-cap.md
.claude/skills/architect/references/tdr-lock-holders-leased.md
.claude/skills/architect/references/tdr-chat-shares-event-loop.md
```

**Modified files:**

```
src/lib/db/schema.ts                         — New columns on tasks + schedules, new table
src/lib/db/bootstrap.ts                      — CREATE TABLE + addColumnIfMissing calls
src/lib/data/clear.ts                        — Delete new table in FK-safe order
src/lib/constants/settings.ts                — SCHEDULE_MAX_CONCURRENT etc.
src/lib/schedules/scheduler.ts               — Wire slot claim + reaper + chat pressure + metrics
src/lib/agents/claude-agent.ts               — Override maxTurns from tasks.maxTurns; write failure_reason
src/lib/chat/engine.ts                       — Register/unregister in activeChatStreams
src/app/api/schedules/route.ts               — Attach collision warnings in POST response
src/app/api/schedules/[id]/route.ts          — Attach collision warnings in PUT response
src/components/schedules/schedule-form.tsx   — New "Max agent steps" field, tooltip, calibration hint
src/components/schedules/schedule-create-sheet.tsx — Render collision warning banner
src/components/schedules/schedule-edit-sheet.tsx   — Render collision warning banner
```

---

## Task 1: Add schema columns + new firing-metrics table

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/bootstrap.ts`
- Modify: `src/lib/data/clear.ts`

- [ ] **Step 1.1: Add Drizzle schema definitions**

Edit `src/lib/db/schema.ts`. Inside the `tasks` table definition (around line 16-53), add these columns before `createdAt`:

```typescript
/** When the slot for this task was atomically claimed */
slotClaimedAt: integer("slot_claimed_at", { mode: "timestamp" }),
/** Wall-clock expiry; reaper aborts tasks whose lease has passed */
leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp" }),
/** Explicit terminal-state reason written by the runtime adapter */
failureReason: text("failure_reason"),
/** Per-task turn budget copied from schedules.maxTurns at firing time */
maxTurns: integer("max_turns"),
```

Add a new index at the end of the `tasks` table definition's index array:

```typescript
index("idx_tasks_running_scheduled").on(table.status, table.sourceType, table.leaseExpiresAt),
```

Inside the `schedules` table definition (around line 165-228), add these columns before `createdAt`:

```typescript
/** Hard cap on turns per firing; NULL inherits the global MAX_TURNS setting */
maxTurns: integer("max_turns"),
/** Timestamp when maxTurns was last edited — drives first-breach grace */
maxTurnsSetAt: integer("max_turns_set_at", { mode: "timestamp" }),
/** Wall-clock lease override in seconds; NULL inherits global default (1200s) */
maxRunDurationSec: integer("max_run_duration_sec"),
/** Counter separate from failureStreak — only increments on maxTurns breach */
turnBudgetBreachStreak: integer("turn_budget_breach_streak").default(0).notNull(),
```

Append a new table definition at the bottom of `schema.ts`, before the `export type` block:

```typescript
export const scheduleFiringMetrics = sqliteTable(
  "schedule_firing_metrics",
  {
    id: text("id").primaryKey(),
    scheduleId: text("schedule_id")
      .references(() => schedules.id)
      .notNull(),
    taskId: text("task_id").references(() => tasks.id),
    firedAt: integer("fired_at", { mode: "timestamp" }).notNull(),
    slotClaimedAt: integer("slot_claimed_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    slotWaitMs: integer("slot_wait_ms"),
    durationMs: integer("duration_ms"),
    turnCount: integer("turn_count"),
    maxTurnsAtFiring: integer("max_turns_at_firing"),
    eventLoopLagMs: real("event_loop_lag_ms"),
    peakRssMb: integer("peak_rss_mb"),
    chatStreamsActive: integer("chat_streams_active"),
    concurrentSchedules: integer("concurrent_schedules"),
    failureReason: text("failure_reason"),
  },
  (table) => [
    index("idx_sfm_schedule_time").on(table.scheduleId, table.firedAt),
  ]
);

export type ScheduleFiringMetricRow = InferSelectModel<typeof scheduleFiringMetrics>;
```

- [ ] **Step 1.2: Add bootstrap CREATE TABLE + addColumnIfMissing calls**

Edit `src/lib/db/bootstrap.ts`. Inside the `STAGENT_TABLES` const (around line 4-51), append `"schedule_firing_metrics"` to the array.

Inside `bootstrapStagentDatabase()`, after the `schedules` CREATE TABLE (around line 190), add a new `CREATE TABLE IF NOT EXISTS schedule_firing_metrics (...)` with columns matching the Drizzle schema above. Also add `CREATE INDEX IF NOT EXISTS idx_sfm_schedule_time ON schedule_firing_metrics(schedule_id, fired_at);`.

At the end of the `addColumnIfMissing` call block (around line 558), add:

```typescript
addColumnIfMissing(`ALTER TABLE tasks ADD COLUMN slot_claimed_at INTEGER;`);
addColumnIfMissing(`ALTER TABLE tasks ADD COLUMN lease_expires_at INTEGER;`);
addColumnIfMissing(`ALTER TABLE tasks ADD COLUMN failure_reason TEXT;`);
addColumnIfMissing(`ALTER TABLE tasks ADD COLUMN max_turns INTEGER;`);
addColumnIfMissing(`ALTER TABLE schedules ADD COLUMN max_turns INTEGER;`);
addColumnIfMissing(`ALTER TABLE schedules ADD COLUMN max_turns_set_at INTEGER;`);
addColumnIfMissing(`ALTER TABLE schedules ADD COLUMN max_run_duration_sec INTEGER;`);
addColumnIfMissing(`ALTER TABLE schedules ADD COLUMN turn_budget_breach_streak INTEGER DEFAULT 0 NOT NULL;`);
```

Also add an index creation line (using the existing sqlite handle):

```typescript
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_running_scheduled ON tasks(status, source_type, lease_expires_at);`);
```

- [ ] **Step 1.3: Add firing-metrics delete to clear.ts (FK-safe order)**

Edit `src/lib/data/clear.ts`. Add `scheduleFiringMetrics` to the imports from `@/lib/db/schema`. Add the delete call BEFORE the existing `schedulesDeleted = db.delete(schedules)...` line, because it references `schedules`:

```typescript
const scheduleFiringMetricsDeleted = db.delete(scheduleFiringMetrics).run().changes;
const schedulesDeleted = db.delete(schedules).run().changes;
```

Include the count in the returned object at the end of `clearAllData`:

```typescript
return {
  // ... existing keys ...
  scheduleFiringMetrics: scheduleFiringMetricsDeleted,
};
```

- [ ] **Step 1.4: Run the clear.ts safety-net test**

Run: `npx vitest run src/lib/data/__tests__/clear.test.ts`
Expected: PASS. The safety-net test verifies every schema table has a `db.delete()` call. If it fails, you forgot to add `scheduleFiringMetrics` to clear.ts.

- [ ] **Step 1.5: Run full test suite**

Run: `npx vitest run`
Expected: PASS — all existing tests still pass. New columns are nullable so no existing seeds break.

- [ ] **Step 1.6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/bootstrap.ts src/lib/data/clear.ts
git commit -m "feat(schedules): add schema columns + firing metrics table"
```

---

## Task 2: Settings keys + config reader helpers

**Files:**
- Modify: `src/lib/constants/settings.ts`
- Create: `src/lib/schedules/config.ts`
- Test: `src/lib/schedules/__tests__/config.test.ts`

- [ ] **Step 2.1: Write failing config reader tests**

Create `src/lib/schedules/__tests__/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getScheduleMaxConcurrent,
  getScheduleMaxRunDurationSec,
  getScheduleChatPressureDelaySec,
} from "../config";

describe("schedule config", () => {
  beforeEach(() => {
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxRunDurationSec")).run();
    db.delete(settings).where(eq(settings.key, "schedule.chatPressureDelaySec")).run();
  });

  it("returns default max concurrent of 2 when setting is absent", () => {
    expect(getScheduleMaxConcurrent()).toBe(2);
  });

  it("reads max concurrent from settings when set", () => {
    db.insert(settings)
      .values({
        key: "schedule.maxConcurrent",
        value: "3",
        updatedAt: new Date(),
      })
      .run();
    expect(getScheduleMaxConcurrent()).toBe(3);
  });

  it("reads max concurrent from SCHEDULE_MAX_CONCURRENT env var", () => {
    const original = process.env.SCHEDULE_MAX_CONCURRENT;
    process.env.SCHEDULE_MAX_CONCURRENT = "5";
    try {
      expect(getScheduleMaxConcurrent()).toBe(5);
    } finally {
      if (original === undefined) delete process.env.SCHEDULE_MAX_CONCURRENT;
      else process.env.SCHEDULE_MAX_CONCURRENT = original;
    }
  });

  it("falls back to default when env var is NaN", () => {
    const original = process.env.SCHEDULE_MAX_CONCURRENT;
    process.env.SCHEDULE_MAX_CONCURRENT = "abc";
    try {
      expect(getScheduleMaxConcurrent()).toBe(2);
    } finally {
      if (original === undefined) delete process.env.SCHEDULE_MAX_CONCURRENT;
      else process.env.SCHEDULE_MAX_CONCURRENT = original;
    }
  });

  it("returns default max run duration of 1200s", () => {
    expect(getScheduleMaxRunDurationSec()).toBe(1200);
  });

  it("returns default chat pressure delay of 30s", () => {
    expect(getScheduleChatPressureDelaySec()).toBe(30);
  });
});
```

- [ ] **Step 2.2: Run to verify RED**

Run: `npx vitest run src/lib/schedules/__tests__/config.test.ts`
Expected: FAIL — module `../config` does not exist.

- [ ] **Step 2.3: Add settings keys**

Edit `src/lib/constants/settings.ts`. Add inside the `SETTINGS_KEYS` const:

```typescript
SCHEDULE_MAX_CONCURRENT: "schedule.maxConcurrent",
SCHEDULE_MAX_RUN_DURATION_SEC: "schedule.maxRunDurationSec",
SCHEDULE_CHAT_PRESSURE_DELAY_SEC: "schedule.chatPressureDelaySec",
```

- [ ] **Step 2.4: Implement config helpers**

Create `src/lib/schedules/config.ts`:

```typescript
import { getSettingSync } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_MAX_RUN_DURATION_SEC = 1200; // 20 minutes
const DEFAULT_CHAT_PRESSURE_DELAY_SEC = 30;

function readIntConfig(
  envVar: string,
  settingKey: string,
  defaultValue: number,
): number {
  const envRaw = process.env[envVar];
  if (envRaw !== undefined) {
    const parsed = parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    console.warn(
      `[schedule-config] ${envVar}="${envRaw}" is not a positive integer; using default ${defaultValue}`,
    );
  }

  const settingRaw = getSettingSync(settingKey);
  if (settingRaw !== null) {
    const parsed = parseInt(settingRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return defaultValue;
}

export function getScheduleMaxConcurrent(): number {
  return readIntConfig(
    "SCHEDULE_MAX_CONCURRENT",
    SETTINGS_KEYS.SCHEDULE_MAX_CONCURRENT,
    DEFAULT_MAX_CONCURRENT,
  );
}

export function getScheduleMaxRunDurationSec(): number {
  return readIntConfig(
    "SCHEDULE_MAX_RUN_DURATION_SEC",
    SETTINGS_KEYS.SCHEDULE_MAX_RUN_DURATION_SEC,
    DEFAULT_MAX_RUN_DURATION_SEC,
  );
}

export function getScheduleChatPressureDelaySec(): number {
  return readIntConfig(
    "SCHEDULE_CHAT_PRESSURE_DELAY_SEC",
    SETTINGS_KEYS.SCHEDULE_CHAT_PRESSURE_DELAY_SEC,
    DEFAULT_CHAT_PRESSURE_DELAY_SEC,
  );
}
```

- [ ] **Step 2.5: Run to verify GREEN**

Run: `npx vitest run src/lib/schedules/__tests__/config.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/constants/settings.ts src/lib/schedules/config.ts src/lib/schedules/__tests__/config.test.ts
git commit -m "feat(schedules): add concurrency + lease + chat-pressure config readers"
```

---

## Task 3: Atomic slot claim primitive

**Files:**
- Create: `src/lib/schedules/slot-claim.ts`
- Test: `src/lib/schedules/__tests__/slot-claim.test.ts`

This is the load-bearing primitive. The atomic claim MUST be a single SQL statement — check-then-act is forbidden because `tickScheduler()` and `drainQueue()` run concurrently via the `.then()` chain at scheduler.ts:420.

- [ ] **Step 3.1: Write failing tests**

Create `src/lib/schedules/__tests__/slot-claim.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { tasks, schedules, projects, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { claimSlot, countRunningScheduledSlots } from "../slot-claim";

function seedProject(): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(projects)
    .values({ id, name: "test", status: "active", createdAt: now, updatedAt: now })
    .run();
  return id;
}

function seedSchedule(projectId: string): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(schedules)
    .values({
      id,
      projectId,
      name: `sched-${id.slice(0, 4)}`,
      prompt: "test",
      cronExpression: "* * * * *",
      status: "active",
      type: "scheduled",
      firingCount: 0,
      suppressionCount: 0,
      heartbeatSpentToday: 0,
      failureStreak: 0,
      turnBudgetBreachStreak: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

function seedQueuedTask(scheduleId: string): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(tasks)
    .values({
      id,
      scheduleId,
      title: "test firing",
      status: "queued",
      priority: 2,
      sourceType: "scheduled",
      resumeCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

describe("claimSlot", () => {
  beforeEach(() => {
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
  });

  it("claims a slot when capacity available, transitioning queued→running", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    const result = claimSlot(tid, 2, 1200);

    expect(result.claimed).toBe(true);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.status).toBe("running");
    expect(row?.slotClaimedAt).not.toBeNull();
    expect(row?.leaseExpiresAt).not.toBeNull();
  });

  it("refuses to claim when cap=0", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    const result = claimSlot(tid, 0, 1200);

    expect(result.claimed).toBe(false);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.status).toBe("queued");
  });

  it("refuses when cap already full", () => {
    const pid = seedProject();
    const sid1 = seedSchedule(pid);
    const sid2 = seedSchedule(pid);
    const tid1 = seedQueuedTask(sid1);
    const tid2 = seedQueuedTask(sid2);

    expect(claimSlot(tid1, 1, 1200).claimed).toBe(true);
    expect(claimSlot(tid2, 1, 1200).claimed).toBe(false);

    const row2 = db.select().from(tasks).where(eq(tasks.id, tid2)).get();
    expect(row2?.status).toBe("queued");
  });

  it("two concurrent claim attempts for the same task yield exactly one winner", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    const first = claimSlot(tid, 10, 1200);
    const second = claimSlot(tid, 10, 1200);

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(false); // task already running, can't re-claim
  });

  it("respects cap across multiple tasks from different schedules", () => {
    const pid = seedProject();
    const tids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const sid = seedSchedule(pid);
      tids.push(seedQueuedTask(sid));
    }

    // Cap of 3 → first 3 claim, last 2 fail
    const results = tids.map((tid) => claimSlot(tid, 3, 1200));
    expect(results.filter((r) => r.claimed).length).toBe(3);
    expect(results.filter((r) => !r.claimed).length).toBe(2);

    expect(countRunningScheduledSlots()).toBe(3);
  });

  it("countRunningScheduledSlots ignores non-scheduled tasks", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const schedTid = seedQueuedTask(sid);
    claimSlot(schedTid, 10, 1200);

    // Insert a manual running task — must not count against scheduled cap
    const manualId = randomUUID();
    const now = new Date();
    db.insert(tasks)
      .values({
        id: manualId,
        title: "manual",
        status: "running",
        priority: 2,
        sourceType: "manual",
        resumeCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(countRunningScheduledSlots()).toBe(1);
  });

  it("writes leaseExpiresAt = slotClaimedAt + leaseSec", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    const before = Date.now();
    claimSlot(tid, 10, 60);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();

    expect(row?.slotClaimedAt?.getTime()).toBeGreaterThanOrEqual(before);
    expect(
      row!.leaseExpiresAt!.getTime() - row!.slotClaimedAt!.getTime(),
    ).toBe(60 * 1000);
  });
});
```

- [ ] **Step 3.2: Run to verify RED**

Run: `npx vitest run src/lib/schedules/__tests__/slot-claim.test.ts`
Expected: FAIL — module `../slot-claim` does not exist.

- [ ] **Step 3.3: Implement slot-claim.ts**

Create `src/lib/schedules/slot-claim.ts`:

```typescript
import { sqlite } from "@/lib/db";

export interface ClaimResult {
  claimed: boolean;
}

/**
 * Atomic slot claim: transitions a queued scheduled task to running IFF the
 * global cap of concurrent running scheduled tasks is not exceeded.
 *
 * Must be a single SQL statement — check-then-act would race between the
 * scheduler tick loop and the drain loop that scheduler.ts currently dispatches
 * concurrently. Using a subquery inside the WHERE clause guarantees SQLite
 * serializes the count and update under its write lock, so two concurrent
 * claim attempts cannot both succeed against the same cap.
 *
 * Returns `{ claimed: true }` when the task transitioned; `{ claimed: false }`
 * when either (a) the task is no longer in queued state (already claimed) or
 * (b) the global cap is full.
 */
export function claimSlot(
  taskId: string,
  cap: number,
  leaseSec: number,
): ClaimResult {
  const now = Date.now();
  const leaseExpires = now + leaseSec * 1000;

  const stmt = sqlite.prepare(
    "UPDATE tasks SET status = 'running', slot_claimed_at = ?, lease_expires_at = ?, updated_at = ? WHERE id = ? AND status = 'queued' AND source_type IN ('scheduled', 'heartbeat') AND (SELECT COUNT(*) FROM tasks WHERE status = 'running' AND source_type IN ('scheduled', 'heartbeat')) < ?",
  );

  const result = stmt.run(now, leaseExpires, now, taskId, cap);
  return { claimed: result.changes === 1 };
}

/**
 * Count currently running scheduled/heartbeat tasks — used by the drain loop,
 * manual-execute endpoint, and telemetry.
 */
export function countRunningScheduledSlots(): number {
  const row = sqlite
    .prepare(
      "SELECT COUNT(*) AS n FROM tasks WHERE status = 'running' AND source_type IN ('scheduled', 'heartbeat')",
    )
    .get() as { n: number } | undefined;
  return row?.n ?? 0;
}
```

- [ ] **Step 3.4: Run to verify GREEN**

Run: `npx vitest run src/lib/schedules/__tests__/slot-claim.test.ts`
Expected: PASS — 7 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/schedules/slot-claim.ts src/lib/schedules/__tests__/slot-claim.test.ts
git commit -m "feat(schedules): atomic slot claim primitive with race coverage"
```

---

## Task 4: Lease reaper

**Files:**
- Modify: `src/lib/schedules/slot-claim.ts`
- Modify: `src/lib/schedules/__tests__/slot-claim.test.ts` (extend)

- [ ] **Step 4.1: Append failing reaper tests**

Append to `src/lib/schedules/__tests__/slot-claim.test.ts`:

```typescript
import { reapExpiredLeases } from "../slot-claim";

describe("reapExpiredLeases", () => {
  beforeEach(() => {
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
  });

  it("marks an expired running task as failed with failure_reason=lease_expired", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    // Claim with a 1-second lease, then fast-forward via direct DB edit
    claimSlot(tid, 10, 1);
    const past = new Date(Date.now() - 5000);
    db.update(tasks)
      .set({ leaseExpiresAt: past })
      .where(eq(tasks.id, tid))
      .run();

    const reaped = reapExpiredLeases();

    expect(reaped).toEqual([tid]);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.status).toBe("failed");
    expect(row?.failureReason).toBe("lease_expired");
  });

  it("leaves fresh running tasks alone", () => {
    const pid = seedProject();
    const sid = seedSchedule(pid);
    const tid = seedQueuedTask(sid);

    claimSlot(tid, 10, 3600); // 1-hour lease

    const reaped = reapExpiredLeases();

    expect(reaped).toEqual([]);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.status).toBe("running");
  });

  it("reaps multiple expired tasks in one sweep", () => {
    const pid = seedProject();
    const tids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const sid = seedSchedule(pid);
      const tid = seedQueuedTask(sid);
      claimSlot(tid, 10, 1);
      tids.push(tid);
    }
    const past = new Date(Date.now() - 5000);
    for (const tid of tids) {
      db.update(tasks)
        .set({ leaseExpiresAt: past })
        .where(eq(tasks.id, tid))
        .run();
    }

    const reaped = reapExpiredLeases();

    expect(reaped.sort()).toEqual([...tids].sort());
    expect(countRunningScheduledSlots()).toBe(0);
  });
});
```

- [ ] **Step 4.2: Run to verify RED**

Run: `npx vitest run src/lib/schedules/__tests__/slot-claim.test.ts`
Expected: FAIL — `reapExpiredLeases` not exported.

- [ ] **Step 4.3: Implement reapExpiredLeases**

Append to `src/lib/schedules/slot-claim.ts`:

```typescript
import { getExecution } from "@/lib/agents/execution-manager";

/**
 * Reap running scheduled tasks whose lease has expired. For each expired
 * task: (1) abort the in-memory execution via AbortController, (2) mark
 * the DB row as failed with failure_reason='lease_expired'. Returns the
 * list of reaped task IDs for logging.
 *
 * Idempotent — safe to call on every scheduler tick.
 */
export function reapExpiredLeases(): string[] {
  const now = Date.now();
  const expiredRows = sqlite
    .prepare(
      "SELECT id FROM tasks WHERE status = 'running' AND source_type IN ('scheduled', 'heartbeat') AND lease_expires_at IS NOT NULL AND lease_expires_at < ?",
    )
    .all(now) as Array<{ id: string }>;

  const reaped: string[] = [];
  for (const { id } of expiredRows) {
    // Abort the in-process execution so the SDK stops immediately
    const execution = getExecution(id);
    if (execution) {
      try {
        execution.abortController.abort();
      } catch {
        // Already aborted — safe to ignore
      }
    }

    const updateResult = sqlite
      .prepare(
        "UPDATE tasks SET status = 'failed', failure_reason = 'lease_expired', updated_at = ? WHERE id = ? AND status = 'running'",
      )
      .run(now, id);
    if (updateResult.changes === 1) reaped.push(id);
  }

  return reaped;
}
```

- [ ] **Step 4.4: Run to verify GREEN**

Run: `npx vitest run src/lib/schedules/__tests__/slot-claim.test.ts`
Expected: PASS — 10 tests (7 claim + 3 reap).

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/schedules/slot-claim.ts src/lib/schedules/__tests__/slot-claim.test.ts
git commit -m "feat(schedules): lease reaper aborts hung runs via AbortController"
```

---

## Task 5: Chat active-streams tracker

**Files:**
- Create: `src/lib/chat/active-streams.ts`
- Test: `src/lib/chat/__tests__/active-streams.test.ts`
- Modify: `src/lib/chat/engine.ts` (register/unregister)

- [ ] **Step 5.1: Write failing tests**

Create `src/lib/chat/__tests__/active-streams.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerChatStream,
  unregisterChatStream,
  getActiveChatStreamCount,
  isAnyChatStreaming,
} from "../active-streams";

describe("active chat streams", () => {
  beforeEach(() => {
    for (const id of ["a", "b", "c"]) unregisterChatStream(id);
  });

  it("starts empty", () => {
    expect(getActiveChatStreamCount()).toBe(0);
    expect(isAnyChatStreaming()).toBe(false);
  });

  it("tracks a single registered stream", () => {
    registerChatStream("a");
    expect(getActiveChatStreamCount()).toBe(1);
    expect(isAnyChatStreaming()).toBe(true);
  });

  it("tracks multiple streams independently", () => {
    registerChatStream("a");
    registerChatStream("b");
    expect(getActiveChatStreamCount()).toBe(2);
  });

  it("is idempotent — registering the same id twice still counts as one", () => {
    registerChatStream("a");
    registerChatStream("a");
    expect(getActiveChatStreamCount()).toBe(1);
  });

  it("unregisters by id", () => {
    registerChatStream("a");
    registerChatStream("b");
    unregisterChatStream("a");
    expect(getActiveChatStreamCount()).toBe(1);
    expect(isAnyChatStreaming()).toBe(true);
  });

  it("unregistering a non-existent id is a no-op", () => {
    expect(() => unregisterChatStream("never-registered")).not.toThrow();
    expect(getActiveChatStreamCount()).toBe(0);
  });
});
```

- [ ] **Step 5.2: Run to verify RED**

Run: `npx vitest run src/lib/chat/__tests__/active-streams.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 5.3: Implement active-streams.ts**

Create `src/lib/chat/active-streams.ts`:

```typescript
/**
 * In-memory tracker for chat conversations that currently have an SSE stream
 * in flight. Used by the scheduler tick loop to apply a soft pressure signal
 * — when chat is active, new schedule firings are deferred by N seconds to
 * keep the Node event loop responsive for the user's conversation.
 *
 * Module-level state; single-process (same Node instance as the scheduler).
 * Must NOT be persisted — crash recovery relies on the set starting empty.
 */

const activeStreams = new Set<string>();

export function registerChatStream(conversationId: string): void {
  activeStreams.add(conversationId);
}

export function unregisterChatStream(conversationId: string): void {
  activeStreams.delete(conversationId);
}

export function getActiveChatStreamCount(): number {
  return activeStreams.size;
}

export function isAnyChatStreaming(): boolean {
  return activeStreams.size > 0;
}
```

- [ ] **Step 5.4: Run to verify GREEN**

Run: `npx vitest run src/lib/chat/__tests__/active-streams.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5.5: Wire engine.ts to register/unregister**

Edit `src/lib/chat/engine.ts`. Add import at the top:

```typescript
import { registerChatStream, unregisterChatStream } from "./active-streams";
```

Find the stream start point (just before `yield { type: "status", phase: "connecting" ... }` near line 280) and call:

```typescript
registerChatStream(conversationId);
```

In the top-level `finally` block (the one that already calls `finalizeStreamingMessage()` from Spec B), add `unregisterChatStream(conversationId);` alongside the finalize call so the set is cleared even on abnormal exit.

- [ ] **Step 5.6: Run chat tests**

Run: `npx vitest run src/lib/chat`
Expected: PASS — all existing chat tests still pass; new active-streams tests pass.

- [ ] **Step 5.7: Commit**

```bash
git add src/lib/chat/active-streams.ts src/lib/chat/__tests__/active-streams.test.ts src/lib/chat/engine.ts
git commit -m "feat(chat): track active streams for scheduler pressure signal"
```

---

## Task 6: Wire slot claim + reaper + chat pressure into tickScheduler

**Files:**
- Modify: `src/lib/schedules/scheduler.ts`
- Test: `src/lib/schedules/__tests__/tick-scheduler.test.ts`

- [ ] **Step 6.1: Write failing tick-scheduler tests**

Create `src/lib/schedules/__tests__/tick-scheduler.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { tasks, schedules, projects, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { tickScheduler } from "../scheduler";
import { registerChatStream, unregisterChatStream } from "@/lib/chat/active-streams";

// Stub the runtime — we're testing coordination, not the SDK
vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: vi.fn().mockResolvedValue(undefined),
}));

function seedProject(): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(projects)
    .values({ id, name: "test", status: "active", createdAt: now, updatedAt: now })
    .run();
  return id;
}

function seedScheduleDue(projectId: string, nextFireAt: Date): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(schedules)
    .values({
      id,
      projectId,
      name: `sched-${id.slice(0, 4)}`,
      prompt: "test prompt",
      cronExpression: "* * * * *",
      status: "active",
      type: "scheduled",
      firingCount: 0,
      suppressionCount: 0,
      heartbeatSpentToday: 0,
      failureStreak: 0,
      turnBudgetBreachStreak: 0,
      nextFireAt,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

describe("tickScheduler with concurrency cap", () => {
  beforeEach(() => {
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
    db.insert(settings)
      .values({ key: "schedule.maxConcurrent", value: "2", updatedAt: new Date() })
      .run();
    for (const id of ["x", "y", "z"]) unregisterChatStream(id);
  });

  it("fires up to cap schedules, queues the rest", async () => {
    const pid = seedProject();
    const past = new Date(Date.now() - 10_000);
    for (let i = 0; i < 5; i++) seedScheduleDue(pid, past);

    await tickScheduler();

    const runningCount = db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "running"))
      .all().length;
    const queuedCount = db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "queued"))
      .all().length;

    expect(runningCount).toBe(2); // cap=2
    expect(queuedCount).toBe(3); // remaining 3 waiting
  });

  it("defers new firings when chat is active", async () => {
    const pid = seedProject();
    const past = new Date(Date.now() - 10_000);
    const sid = seedScheduleDue(pid, past);

    registerChatStream("x");

    await tickScheduler();

    // No task should have been created
    const taskCount = db.select().from(tasks).all().length;
    expect(taskCount).toBe(0);

    // The schedule's next_fire_at should have been pushed forward ≥25s
    const row = db.select().from(schedules).where(eq(schedules.id, sid)).get();
    expect(row?.nextFireAt?.getTime()).toBeGreaterThan(Date.now() + 25 * 1000);

    unregisterChatStream("x");
  });
});
```

- [ ] **Step 6.2: Run to verify RED**

Run: `npx vitest run src/lib/schedules/__tests__/tick-scheduler.test.ts`
Expected: FAIL — cap enforcement not yet wired; all 5 schedules would fire.

- [ ] **Step 6.3: Wire reaper + chat pressure + atomic claim into scheduler.ts**

Edit `src/lib/schedules/scheduler.ts`. Add imports at the top alongside existing imports:

```typescript
import { claimSlot, reapExpiredLeases, countRunningScheduledSlots } from "./slot-claim";
import { isAnyChatStreaming } from "@/lib/chat/active-streams";
import {
  getScheduleMaxConcurrent,
  getScheduleMaxRunDurationSec,
  getScheduleChatPressureDelaySec,
} from "./config";
```

At the top of `tickScheduler()` (around line 221), add the reaper pass:

```typescript
export async function tickScheduler(): Promise<void> {
  // Reap any running tasks whose lease has expired before claiming new slots.
  try {
    const reaped = reapExpiredLeases();
    if (reaped.length > 0) {
      console.warn(
        `[scheduler] reaped ${reaped.length} expired lease(s): ${reaped.join(", ")}`,
      );
    }
  } catch (err) {
    console.error("[scheduler] lease reaper error:", err);
  }

  const now = new Date();
  // ... existing function body continues unchanged ...
```

Right after fetching `dueSchedules` (around line 224-232) and before the `for` loop, add the chat pressure check:

```typescript
  // Chat soft pressure: defer new firings by N seconds when a chat stream is
  // in flight. In-flight scheduled runs are NOT affected — this only gates
  // new claims.
  if (isAnyChatStreaming() && dueSchedules.length > 0) {
    const delayMs = getScheduleChatPressureDelaySec() * 1000;
    const deferredUntil = new Date(now.getTime() + delayMs);
    for (const schedule of dueSchedules) {
      await db
        .update(schedules)
        .set({ nextFireAt: deferredUntil, updatedAt: now })
        .where(eq(schedules.id, schedule.id));
    }
    console.log(
      `[scheduler] chat streaming — deferred ${dueSchedules.length} firings by ${delayMs}ms`,
    );
    return;
  }
```

In `fireSchedule()` (around line 300-445), after the task INSERT and BEFORE the `executeTaskWithRuntime(taskId)` call at line 412, add the atomic claim:

```typescript
  // Atomic slot claim — if the global cap is full, leave the task in queued
  // state. drainQueue will pick it up when a running slot frees.
  const cap = getScheduleMaxConcurrent();
  const leaseSec = schedule.maxRunDurationSec ?? getScheduleMaxRunDurationSec();
  const { claimed } = claimSlot(taskId, cap, leaseSec);

  if (!claimed) {
    console.log(
      `[scheduler] schedule "${schedule.name}" queued — cap full (${countRunningScheduledSlots()}/${cap})`,
    );
    return;
  }
```

In `drainQueue()` (around line 51-95), replace the body of the `while (true)` loop so it claims slots atomically and stops when the cap is full:

```typescript
  while (true) {
    const cap = getScheduleMaxConcurrent();
    if (countRunningScheduledSlots() >= cap) return;

    const [nextQueued] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "queued"),
          inArray(tasks.sourceType, ["scheduled", "heartbeat"])
        )
      )
      .orderBy(asc(tasks.createdAt))
      .limit(1);

    if (!nextQueued) return;

    const leaseSec = getScheduleMaxRunDurationSec();
    const { claimed } = claimSlot(nextQueued.id, cap, leaseSec);
    if (!claimed) return; // lost race or cap filled again

    console.log(`[scheduler] draining queue → running task ${nextQueued.id}`);
    try {
      await executeTaskWithRuntime(nextQueued.id);
    } catch (err) {
      console.error(`[scheduler] drain task ${nextQueued.id} failed:`, err);
    }

    try {
      const [taskRow] = await db
        .select({ scheduleId: tasks.scheduleId })
        .from(tasks)
        .where(eq(tasks.id, nextQueued.id));
      if (taskRow?.scheduleId) {
        await recordFiringMetrics(taskRow.scheduleId, nextQueued.id);
      }
    } catch (err) {
      console.error(`[scheduler] metrics recording failed for ${nextQueued.id}:`, err);
    }
  }
```

- [ ] **Step 6.4: Run tick-scheduler tests to verify GREEN**

Run: `npx vitest run src/lib/schedules/__tests__/tick-scheduler.test.ts`
Expected: PASS — both cap-enforcement and chat-pressure tests.

- [ ] **Step 6.5: Run full scheduler test suite**

Run: `npx vitest run src/lib/schedules`
Expected: PASS — no regressions.

- [ ] **Step 6.6: Run full test suite**

Run: `npx vitest run`
Expected: PASS across the codebase.

- [ ] **Step 6.7: Commit**

```bash
git add src/lib/schedules/scheduler.ts src/lib/schedules/__tests__/tick-scheduler.test.ts
git commit -m "feat(schedules): enforce global concurrency cap with lease reaper + chat pressure"
```

---

## Task 7: Per-schedule turn budget propagation

**Files:**
- Modify: `src/lib/schedules/scheduler.ts` (populate `tasks.max_turns` at firing)
- Modify: `src/lib/agents/claude-agent.ts` (override `ctx.maxTurns` from `task.maxTurns`)
- Test: `src/lib/schedules/__tests__/turn-budget.test.ts`

- [ ] **Step 7.1: Write failing test for task.maxTurns propagation**

Create `src/lib/schedules/__tests__/turn-budget.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { tasks, schedules, projects, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { tickScheduler } from "../scheduler";

vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: vi.fn().mockResolvedValue(undefined),
}));

describe("per-schedule turn budget propagation", () => {
  beforeEach(() => {
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
    db.insert(settings)
      .values({ key: "schedule.maxConcurrent", value: "10", updatedAt: new Date() })
      .run();
  });

  it("copies schedules.max_turns into tasks.max_turns at firing time", async () => {
    const pid = randomUUID();
    const sid = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
      .run();
    db.insert(schedules)
      .values({
        id: sid,
        projectId: pid,
        name: "bounded",
        prompt: "test",
        cronExpression: "* * * * *",
        status: "active",
        type: "scheduled",
        firingCount: 0,
        suppressionCount: 0,
        heartbeatSpentToday: 0,
        failureStreak: 0,
        turnBudgetBreachStreak: 0,
        nextFireAt: new Date(now.getTime() - 10_000),
        maxTurns: 42,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await tickScheduler();

    const [task] = db.select().from(tasks).where(eq(tasks.scheduleId, sid)).all();
    expect(task?.maxTurns).toBe(42);
  });

  it("leaves tasks.max_turns null when schedules.max_turns is null", async () => {
    const pid = randomUUID();
    const sid = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
      .run();
    db.insert(schedules)
      .values({
        id: sid,
        projectId: pid,
        name: "unbounded",
        prompt: "test",
        cronExpression: "* * * * *",
        status: "active",
        type: "scheduled",
        firingCount: 0,
        suppressionCount: 0,
        heartbeatSpentToday: 0,
        failureStreak: 0,
        turnBudgetBreachStreak: 0,
        nextFireAt: new Date(now.getTime() - 10_000),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await tickScheduler();

    const [task] = db.select().from(tasks).where(eq(tasks.scheduleId, sid)).all();
    expect(task?.maxTurns).toBeNull();
  });
});
```

- [ ] **Step 7.2: Run to verify RED**

Run: `npx vitest run src/lib/schedules/__tests__/turn-budget.test.ts`
Expected: FAIL — `task.maxTurns` will be null because the scheduler doesn't copy it yet.

- [ ] **Step 7.3: Populate tasks.max_turns in fireSchedule**

Edit `src/lib/schedules/scheduler.ts`, inside `fireSchedule()` at the `db.insert(tasks).values({ ... })` call (around line 350-364). Add `maxTurns: schedule.maxTurns,` to the inserted values, placed before `createdAt`:

```typescript
  await db.insert(tasks).values({
    id: taskId,
    projectId: schedule.projectId,
    workflowId: null,
    scheduleId: schedule.id,
    title: `${schedule.name} — firing #${firingNumber}`,
    description: budgetHeader + schedule.prompt,
    status: "queued",
    assignedAgent: schedule.assignedAgent,
    agentProfile: schedule.agentProfile,
    priority: 2,
    sourceType: "scheduled",
    maxTurns: schedule.maxTurns, // per-schedule override, NULL = inherit global
    createdAt: now,
    updatedAt: now,
  });
```

Do the same change in `fireHeartbeat()` (around line 528-542) for the heartbeat task insert.

- [ ] **Step 7.4: Run to verify GREEN**

Run: `npx vitest run src/lib/schedules/__tests__/turn-budget.test.ts`
Expected: PASS — both propagation tests pass.

- [ ] **Step 7.5: Override ctx.maxTurns in executeClaudeTask**

Edit `src/lib/agents/claude-agent.ts`. Find `executeClaudeTask()` (line 416-499). After `const ctx = await buildTaskQueryContext(task, agentProfileId);` (around line 433), add:

```typescript
    // Per-schedule override: if the task carries its own maxTurns (set by
    // fireSchedule from schedules.maxTurns), it takes precedence over the
    // profile default. This is the runtime-enforced budget cap.
    const effectiveMaxTurns = task.maxTurns ?? ctx.maxTurns;
```

In the SDK `query()` call options (around line 456), replace `maxTurns: ctx.maxTurns,` with `maxTurns: effectiveMaxTurns,`.

Do the same in `resumeClaudeTask()` (around line 570).

- [ ] **Step 7.6: Run full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions.

- [ ] **Step 7.7: Commit**

```bash
git add src/lib/schedules/scheduler.ts src/lib/agents/claude-agent.ts src/lib/schedules/__tests__/turn-budget.test.ts
git commit -m "feat(schedules): propagate per-schedule max_turns into SDK query options"
```

---

## Task 8: Separate `turnBudgetBreachStreak` with first-breach grace

**Files:**
- Modify: `src/lib/schedules/scheduler.ts` (`recordFiringMetrics`)
- Modify: `src/lib/schedules/__tests__/turn-budget.test.ts` (extend)

The existing `recordFiringMetrics()` at scheduler.ts:140-186 uses a single `failureStreak`. Split turn-budget breaches into their own counter so a misconfigured `maxTurns` doesn't auto-pause via the generic threshold of 3.

- [ ] **Step 8.1: Append failing tests for streak split + grace + auto-pause**

Append to `src/lib/schedules/__tests__/turn-budget.test.ts`:

```typescript
import { recordFiringMetrics } from "../scheduler";

async function seedBreachedTask(scheduleId: string): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  db.insert(tasks)
    .values({
      id,
      scheduleId,
      title: "firing",
      status: "failed",
      result: "Agent exhausted its turn limit (42 turns used)",
      priority: 2,
      sourceType: "scheduled",
      resumeCount: 0,
      failureReason: "turn_limit_exceeded",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

describe("turn_budget_breach_streak", () => {
  beforeEach(() => {
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
  });

  it("does NOT increment generic failureStreak on turn-budget breach", async () => {
    const pid = randomUUID();
    const sid = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
      .run();
    db.insert(schedules)
      .values({
        id: sid,
        projectId: pid,
        name: "bounded",
        prompt: "test",
        cronExpression: "* * * * *",
        status: "active",
        type: "scheduled",
        firingCount: 1,
        suppressionCount: 0,
        heartbeatSpentToday: 0,
        failureStreak: 0,
        turnBudgetBreachStreak: 0,
        maxTurns: 20,
        maxTurnsSetAt: new Date(now.getTime() - 86400_000), // yesterday
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const tid = await seedBreachedTask(sid);
    await recordFiringMetrics(sid, tid);

    const row = db.select().from(schedules).where(eq(schedules.id, sid)).get();
    expect(row?.failureStreak).toBe(0);
    expect(row?.turnBudgetBreachStreak).toBe(1);
  });

  it("applies first-breach grace when maxTurns was set recently", async () => {
    const pid = randomUUID();
    const sid = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
      .run();
    db.insert(schedules)
      .values({
        id: sid,
        projectId: pid,
        name: "bounded",
        prompt: "test",
        cronExpression: "0 * * * *", // hourly
        status: "active",
        type: "scheduled",
        firingCount: 1,
        suppressionCount: 0,
        heartbeatSpentToday: 0,
        failureStreak: 0,
        turnBudgetBreachStreak: 0,
        maxTurns: 20,
        // maxTurnsSetAt 30 min ago → first firing after edit → grace applies
        maxTurnsSetAt: new Date(now.getTime() - 30 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const tid = await seedBreachedTask(sid);
    await recordFiringMetrics(sid, tid);

    const row = db.select().from(schedules).where(eq(schedules.id, sid)).get();
    expect(row?.turnBudgetBreachStreak).toBe(0); // grace applied
  });

  it("auto-pauses at turn_budget_breach_streak >= 5", async () => {
    const pid = randomUUID();
    const sid = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
      .run();
    db.insert(schedules)
      .values({
        id: sid,
        projectId: pid,
        name: "bounded",
        prompt: "test",
        cronExpression: "* * * * *",
        status: "active",
        type: "scheduled",
        firingCount: 5,
        suppressionCount: 0,
        heartbeatSpentToday: 0,
        failureStreak: 0,
        turnBudgetBreachStreak: 4, // next breach trips the threshold
        maxTurns: 20,
        maxTurnsSetAt: new Date(now.getTime() - 86400_000),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const tid = await seedBreachedTask(sid);
    await recordFiringMetrics(sid, tid);

    const row = db.select().from(schedules).where(eq(schedules.id, sid)).get();
    expect(row?.status).toBe("paused");
    expect(row?.turnBudgetBreachStreak).toBe(5);
  });
});
```

- [ ] **Step 8.2: Run to verify RED**

Run: `npx vitest run src/lib/schedules/__tests__/turn-budget.test.ts`
Expected: FAIL — `recordFiringMetrics` doesn't split streaks yet.

- [ ] **Step 8.3: Refactor recordFiringMetrics**

Edit `src/lib/schedules/scheduler.ts`. Replace the body of `recordFiringMetrics()` (lines 140-186) with a version that splits streaks and honors first-breach grace:

```typescript
const TURN_BUDGET_BREACH_AUTO_PAUSE_THRESHOLD = 5;
const GRACE_PERIOD_MULTIPLIER = 2; // grace window = 2 × cron interval

export async function recordFiringMetrics(
  scheduleId: string,
  taskId: string,
): Promise<void> {
  const [task] = await db
    .select({
      status: tasks.status,
      result: tasks.result,
      failureReason: tasks.failureReason,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!task) return;

  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId));
  if (!schedule) return;

  const turnCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentLogs)
    .where(eq(agentLogs.taskId, taskId));
  const turns = Number(turnCountResult[0]?.count ?? 0);

  const prevAvg = schedule.avgTurnsPerFiring ?? turns;
  const newAvg = Math.round(prevAvg * 0.7 + turns * 0.3);

  const isFailure = task.status === "failed";
  const failureReason =
    task.failureReason ?? (isFailure ? detectFailureReason(task.result) : null);
  const isTurnBudgetBreach = failureReason === "turn_limit_exceeded";
  const isGenericFailure = isFailure && !isTurnBudgetBreach;

  // First-breach grace
  let turnBudgetStreakDelta = 0;
  if (isTurnBudgetBreach) {
    const graceApplies = shouldApplyGrace(
      schedule.maxTurnsSetAt,
      schedule.cronExpression,
      task.updatedAt,
    );
    if (!graceApplies) turnBudgetStreakDelta = 1;
  }

  const newFailureStreak = isGenericFailure ? (schedule.failureStreak ?? 0) + 1 : 0;
  const newBudgetStreak =
    turnBudgetStreakDelta > 0
      ? (schedule.turnBudgetBreachStreak ?? 0) + 1
      : isTurnBudgetBreach
      ? schedule.turnBudgetBreachStreak
      : 0;
  const shouldAutoPauseGeneric =
    isGenericFailure && newFailureStreak >= 3 && schedule.status === "active";
  const shouldAutoPauseBudget =
    newBudgetStreak >= TURN_BUDGET_BREACH_AUTO_PAUSE_THRESHOLD &&
    schedule.status === "active";
  const shouldAutoPause = shouldAutoPauseGeneric || shouldAutoPauseBudget;

  await db
    .update(schedules)
    .set({
      lastTurnCount: turns,
      avgTurnsPerFiring: newAvg,
      failureStreak: newFailureStreak,
      turnBudgetBreachStreak: newBudgetStreak,
      lastFailureReason: failureReason,
      status: shouldAutoPause ? "paused" : schedule.status,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, scheduleId));

  if (shouldAutoPauseGeneric) {
    console.warn(
      `[scheduler] auto-paused "${schedule.name}" after 3 consecutive failures`,
    );
  }
  if (shouldAutoPauseBudget) {
    console.warn(
      `[scheduler] auto-paused "${schedule.name}" after 5 consecutive turn-budget breaches (avg: ${newAvg} steps, cap: ${schedule.maxTurns})`,
    );
  }
}

/**
 * First-breach grace: if maxTurnsSetAt was recent enough that this is the
 * first-or-second firing after the edit, don't count the breach toward the
 * auto-pause streak.
 */
function shouldApplyGrace(
  maxTurnsSetAt: Date | null,
  cronExpression: string,
  completedAt: Date | null,
): boolean {
  if (!maxTurnsSetAt || !completedAt) return false;
  try {
    const nextAfterSet = computeNextFireTime(cronExpression, maxTurnsSetAt);
    const cronIntervalMs = nextAfterSet.getTime() - maxTurnsSetAt.getTime();
    const graceWindowEnd = new Date(
      maxTurnsSetAt.getTime() + GRACE_PERIOD_MULTIPLIER * cronIntervalMs,
    );
    return completedAt <= graceWindowEnd;
  } catch {
    return false;
  }
}
```

- [ ] **Step 8.4: Run to verify GREEN**

Run: `npx vitest run src/lib/schedules/__tests__/turn-budget.test.ts`
Expected: PASS — all turn-budget tests (propagation + streak + grace + auto-pause).

- [ ] **Step 8.5: Run full scheduler suite**

Run: `npx vitest run src/lib/schedules`
Expected: PASS — no regressions.

- [ ] **Step 8.6: Commit**

```bash
git add src/lib/schedules/scheduler.ts src/lib/schedules/__tests__/turn-budget.test.ts
git commit -m "feat(schedules): separate turn-budget breach streak with first-breach grace"
```

---

## Task 9: Runtime adapter writes explicit `failure_reason`

**Files:**
- Modify: `src/lib/agents/claude-agent.ts`
- Test: `src/lib/agents/__tests__/failure-reason.test.ts`

The runtime adapter currently catches errors in `handleExecutionError()` but does not write `tasks.failure_reason`. The reaper and recordFiringMetrics rely on this column. Populate it at terminal-state transitions so `detectFailureReason()` (scheduler.ts:122) becomes a fallback, not the primary classifier.

- [ ] **Step 9.1: Write failing classifier tests**

Create `src/lib/agents/__tests__/failure-reason.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { writeTerminalFailureReason } from "../claude-agent";

function seedRunningTask(): string {
  const pid = randomUUID();
  const tid = randomUUID();
  const now = new Date();
  db.insert(projects)
    .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
    .run();
  db.insert(tasks)
    .values({
      id: tid,
      projectId: pid,
      title: "t",
      status: "running",
      priority: 2,
      resumeCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return tid;
}

describe("writeTerminalFailureReason", () => {
  beforeEach(() => {
    db.delete(tasks).run();
    db.delete(projects).run();
  });

  it("writes 'turn_limit_exceeded' on turn limit errors", async () => {
    const tid = seedRunningTask();
    await writeTerminalFailureReason(
      tid,
      new Error("Agent exhausted its turn limit (42 turns used)"),
    );
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.failureReason).toBe("turn_limit_exceeded");
  });

  it("writes 'aborted' on AbortError", async () => {
    const tid = seedRunningTask();
    const err = new Error("aborted");
    err.name = "AbortError";
    await writeTerminalFailureReason(tid, err);
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.failureReason).toBe("aborted");
  });

  it("writes 'sdk_error' for unknown errors", async () => {
    const tid = seedRunningTask();
    await writeTerminalFailureReason(tid, new Error("something weird"));
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.failureReason).toBe("sdk_error");
  });

  it("writes 'rate_limited' on 429 errors", async () => {
    const tid = seedRunningTask();
    await writeTerminalFailureReason(tid, new Error("HTTP 429 rate limit"));
    const row = db.select().from(tasks).where(eq(tasks.id, tid)).get();
    expect(row?.failureReason).toBe("rate_limited");
  });
});
```

- [ ] **Step 9.2: Run to verify RED**

Run: `npx vitest run src/lib/agents/__tests__/failure-reason.test.ts`
Expected: FAIL — `writeTerminalFailureReason` not exported.

- [ ] **Step 9.3: Add writeTerminalFailureReason helper**

Edit `src/lib/agents/claude-agent.ts`. Add this helper near the other top-level exports (after the imports block):

```typescript
/**
 * Write an explicit failure_reason to tasks at terminal-state transitions.
 * Called from handleExecutionError and the execute/resume functions on known
 * error classes. Prefer this over reverse-engineering reasons from text via
 * detectFailureReason in scheduler.ts, which is fragile to SDK message changes.
 */
export async function writeTerminalFailureReason(
  taskId: string,
  error: unknown,
): Promise<void> {
  const reason = classifyError(error);
  await db
    .update(tasks)
    .set({ failureReason: reason, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

function classifyError(error: unknown): string {
  if (!(error instanceof Error)) return "sdk_error";
  if (error.name === "AbortError" || error.message.includes("aborted")) {
    return "aborted";
  }
  const lower = error.message.toLowerCase();
  if (
    lower.includes("turn") &&
    (lower.includes("limit") || lower.includes("exhausted") || lower.includes("max"))
  ) {
    return "turn_limit_exceeded";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) return "timeout";
  if (lower.includes("budget")) return "budget_exceeded";
  if (lower.includes("authentication") || lower.includes("oauth")) {
    return "auth_failed";
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return "rate_limited";
  }
  return "sdk_error";
}
```

- [ ] **Step 9.4: Call it from handleExecutionError**

Still in `claude-agent.ts`, find `handleExecutionError()`. At the point where it updates `tasks.status = 'failed'`, add a call to `writeTerminalFailureReason(taskId, error)` alongside the status update.

- [ ] **Step 9.5: Run to verify GREEN**

Run: `npx vitest run src/lib/agents/__tests__/failure-reason.test.ts`
Expected: PASS — 4 classification tests.

- [ ] **Step 9.6: Run full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9.7: Commit**

```bash
git add src/lib/agents/claude-agent.ts src/lib/agents/__tests__/failure-reason.test.ts
git commit -m "feat(agents): runtime adapter writes explicit failure_reason at terminal states"
```

---

## Task 10: Manual execute endpoint with cap + force bypass

**Files:**
- Create: `src/app/api/schedules/[id]/execute/route.ts`
- Test: `src/app/api/schedules/__tests__/execute-route.test.ts`

No manual-execute endpoint exists today. Build one that honors the cap by default with explicit `?force=true` bypass.

- [ ] **Step 10.1: Write failing route tests**

Create `src/app/api/schedules/__tests__/execute-route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { tasks, schedules, projects, settings, usageLedger } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { POST } from "../[id]/execute/route";

vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: vi.fn().mockResolvedValue(undefined),
}));

function req(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"));
}

function seedSchedule(): string {
  const pid = randomUUID();
  const sid = randomUUID();
  const now = new Date();
  db.insert(projects)
    .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
    .run();
  db.insert(schedules)
    .values({
      id: sid,
      projectId: pid,
      name: "manual",
      prompt: "test",
      cronExpression: "0 0 * * *",
      status: "active",
      type: "scheduled",
      firingCount: 0,
      suppressionCount: 0,
      heartbeatSpentToday: 0,
      failureStreak: 0,
      turnBudgetBreachStreak: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return sid;
}

describe("POST /api/schedules/:id/execute", () => {
  beforeEach(() => {
    db.delete(usageLedger).run();
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
    db.insert(settings)
      .values({ key: "schedule.maxConcurrent", value: "1", updatedAt: new Date() })
      .run();
  });

  it("fires when capacity available, returns 200 with taskId", async () => {
    const sid = seedSchedule();
    const res = await POST(req(`/api/schedules/${sid}/execute`), {
      params: Promise.resolve({ id: sid }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taskId).toBeDefined();
  });

  it("returns 429 when cap is full", async () => {
    const sid1 = seedSchedule();
    const sid2 = seedSchedule();

    const res1 = await POST(req(`/api/schedules/${sid1}/execute`), {
      params: Promise.resolve({ id: sid1 }),
    });
    expect(res1.status).toBe(200);

    const res2 = await POST(req(`/api/schedules/${sid2}/execute`), {
      params: Promise.resolve({ id: sid2 }),
    });
    expect(res2.status).toBe(429);
    const body = await res2.json();
    expect(body.error).toBe("capacity_full");
    expect(body.slotEtaSec).toBeGreaterThanOrEqual(0);
  });

  it("bypasses the cap when ?force=true and writes audit-log entry", async () => {
    const sid1 = seedSchedule();
    const sid2 = seedSchedule();

    await POST(req(`/api/schedules/${sid1}/execute`), {
      params: Promise.resolve({ id: sid1 }),
    });

    const res2 = await POST(
      req(`/api/schedules/${sid2}/execute?force=true`),
      { params: Promise.resolve({ id: sid2 }) },
    );
    expect(res2.status).toBe(200);

    const ledger = db
      .select()
      .from(usageLedger)
      .where(eq(usageLedger.activityType, "manual_force_bypass"))
      .all();
    expect(ledger.length).toBe(1);
  });

  it("returns 404 when the schedule does not exist", async () => {
    const res = await POST(req("/api/schedules/nonexistent/execute"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 10.2: Run to verify RED**

Run: `npx vitest run src/app/api/schedules/__tests__/execute-route.test.ts`
Expected: FAIL — route module does not exist.

- [ ] **Step 10.3: Implement the manual-execute route**

Create `src/app/api/schedules/[id]/execute/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schedules, tasks, usageLedger } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeTaskWithRuntime } from "@/lib/agents/runtime";
import { claimSlot, countRunningScheduledSlots } from "@/lib/schedules/slot-claim";
import {
  getScheduleMaxConcurrent,
  getScheduleMaxRunDurationSec,
} from "@/lib/schedules/config";
import { randomUUID } from "crypto";

/**
 * Manually fire a schedule. Honors the global concurrency cap by default.
 * Use `?force=true` to bypass the cap (logged to usage_ledger as
 * manual_force_bypass for audit).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scheduleId } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";

  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId));
  if (!schedule) {
    return NextResponse.json({ error: "schedule_not_found" }, { status: 404 });
  }

  const taskId = randomUUID();
  const firingNumber = schedule.firingCount + 1;
  const now = new Date();

  await db.insert(tasks).values({
    id: taskId,
    projectId: schedule.projectId,
    workflowId: null,
    scheduleId: schedule.id,
    title: `${schedule.name} — manual firing #${firingNumber}`,
    description: schedule.prompt,
    status: "queued",
    assignedAgent: schedule.assignedAgent,
    agentProfile: schedule.agentProfile,
    priority: 2,
    sourceType: "scheduled",
    maxTurns: schedule.maxTurns,
    createdAt: now,
    updatedAt: now,
  });

  const cap = getScheduleMaxConcurrent();
  const leaseSec = schedule.maxRunDurationSec ?? getScheduleMaxRunDurationSec();

  const effectiveCap = force ? Number.MAX_SAFE_INTEGER : cap;
  const { claimed } = claimSlot(taskId, effectiveCap, leaseSec);

  if (!claimed) {
    await db.delete(tasks).where(eq(tasks.id, taskId));
    const slotEtaSec = 60;
    return NextResponse.json(
      {
        error: "capacity_full",
        message: `Swarm at capacity (${countRunningScheduledSlots()}/${cap}). Retry in ~${slotEtaSec}s or add ?force=true to bypass.`,
        slotEtaSec,
      },
      { status: 429 },
    );
  }

  if (force) {
    await db.insert(usageLedger).values({
      id: randomUUID(),
      taskId,
      scheduleId: schedule.id,
      projectId: schedule.projectId,
      activityType: "manual_force_bypass",
      runtimeId: schedule.assignedAgent ?? null,
      providerId: null,
      modelId: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      costMicros: 0,
      status: "completed",
      startedAt: now,
      finishedAt: now,
    } as typeof usageLedger.$inferInsert);
  }

  executeTaskWithRuntime(taskId).catch((err) => {
    console.error(`[api/schedules/execute] task ${taskId} failed:`, err);
  });

  return NextResponse.json({ taskId, forced: force });
}
```

**Note:** if `usageLedger` schema columns differ from the insert shape above, read `src/lib/db/schema.ts` lines 297-340 for the actual column names and adjust. The `activityType` field may need to be added to the enum — check `tasks.status` pattern for reference.

- [ ] **Step 10.4: Run to verify GREEN**

Run: `npx vitest run src/app/api/schedules/__tests__/execute-route.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 10.5: Commit**

```bash
git add src/app/api/schedules/[id]/execute/route.ts src/app/api/schedules/__tests__/execute-route.test.ts
git commit -m "feat(schedules): manual execute endpoint honors cap with force bypass + audit"
```

---

## Task 11: Firing metrics insertion

**Files:**
- Modify: `src/lib/schedules/scheduler.ts` (`recordFiringMetrics` — add insert at end)
- Test: `src/lib/schedules/__tests__/firing-metrics.test.ts`

- [ ] **Step 11.1: Write failing metrics test**

Create `src/lib/schedules/__tests__/firing-metrics.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  tasks,
  schedules,
  projects,
  scheduleFiringMetrics,
  agentLogs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { recordFiringMetrics } from "../scheduler";

describe("schedule_firing_metrics insertion", () => {
  beforeEach(() => {
    db.delete(scheduleFiringMetrics).run();
    db.delete(agentLogs).run();
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
  });

  it("inserts a row for every firing with slot_wait_ms and duration_ms", async () => {
    const pid = randomUUID();
    const sid = randomUUID();
    const tid = randomUUID();
    const firedAt = new Date(Date.now() - 5000);
    const slotClaimedAt = new Date(Date.now() - 4000);
    const completedAt = new Date(Date.now() - 100);

    db.insert(projects)
      .values({
        id: pid,
        name: "p",
        status: "active",
        createdAt: firedAt,
        updatedAt: firedAt,
      })
      .run();
    db.insert(schedules)
      .values({
        id: sid,
        projectId: pid,
        name: "test",
        prompt: "x",
        cronExpression: "* * * * *",
        status: "active",
        type: "scheduled",
        firingCount: 1,
        suppressionCount: 0,
        heartbeatSpentToday: 0,
        failureStreak: 0,
        turnBudgetBreachStreak: 0,
        maxTurns: 50,
        createdAt: firedAt,
        updatedAt: firedAt,
      })
      .run();
    db.insert(tasks)
      .values({
        id: tid,
        scheduleId: sid,
        title: "firing",
        status: "completed",
        priority: 2,
        sourceType: "scheduled",
        resumeCount: 0,
        slotClaimedAt,
        createdAt: firedAt,
        updatedAt: completedAt,
      })
      .run();
    for (let i = 0; i < 7; i++) {
      db.insert(agentLogs)
        .values({
          id: randomUUID(),
          taskId: tid,
          agentType: "test",
          event: "assistant_message",
          timestamp: new Date(),
        })
        .run();
    }

    await recordFiringMetrics(sid, tid);

    const rows = db
      .select()
      .from(scheduleFiringMetrics)
      .where(eq(scheduleFiringMetrics.scheduleId, sid))
      .all();

    expect(rows.length).toBe(1);
    expect(rows[0].turnCount).toBe(7);
    expect(rows[0].maxTurnsAtFiring).toBe(50);
    expect(rows[0].slotWaitMs).toBeGreaterThan(0);
    expect(rows[0].durationMs).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 11.2: Run to verify RED**

Run: `npx vitest run src/lib/schedules/__tests__/firing-metrics.test.ts`
Expected: FAIL — no row inserted.

- [ ] **Step 11.3: Append metric insertion to recordFiringMetrics**

Edit `src/lib/schedules/scheduler.ts`. At the end of `recordFiringMetrics()` (after the schedule UPDATE), add the metric insertion:

```typescript
  try {
    const [taskRow] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));
    if (taskRow) {
      const firedAtDate = taskRow.createdAt;
      const slotClaimedAt = taskRow.slotClaimedAt;
      const completedAt = taskRow.updatedAt;
      const slotWaitMs =
        slotClaimedAt && firedAtDate
          ? slotClaimedAt.getTime() - firedAtDate.getTime()
          : null;
      const durationMs =
        slotClaimedAt && completedAt
          ? completedAt.getTime() - slotClaimedAt.getTime()
          : null;

      await db.insert(scheduleFiringMetrics).values({
        id: crypto.randomUUID(),
        scheduleId,
        taskId,
        firedAt: firedAtDate,
        slotClaimedAt,
        completedAt,
        slotWaitMs,
        durationMs,
        turnCount: turns,
        maxTurnsAtFiring: schedule.maxTurns,
        eventLoopLagMs: null,
        peakRssMb: null,
        chatStreamsActive: null,
        concurrentSchedules: null,
        failureReason,
      });
    }
  } catch (err) {
    console.error(`[scheduler] failed to insert firing metrics for ${taskId}:`, err);
  }
```

Remember to import `scheduleFiringMetrics` at the top of `scheduler.ts`:

```typescript
import { schedules, tasks, agentLogs, scheduleFiringMetrics, scheduleDocumentInputs, documents, workflows } from "@/lib/db/schema";
```

- [ ] **Step 11.4: Run to verify GREEN**

Run: `npx vitest run src/lib/schedules/__tests__/firing-metrics.test.ts`
Expected: PASS.

- [ ] **Step 11.5: Commit**

```bash
git add src/lib/schedules/scheduler.ts src/lib/schedules/__tests__/firing-metrics.test.ts
git commit -m "feat(schedules): insert schedule_firing_metrics rows for tuning + forensics"
```

---

## Task 12: Collision warning helper + API wiring

**Files:**
- Create: `src/lib/schedules/collision-check.ts`
- Test: `src/lib/schedules/__tests__/collision-check.test.ts`
- Modify: `src/app/api/schedules/route.ts`
- Modify: `src/app/api/schedules/[id]/route.ts`

- [ ] **Step 12.1: Write failing collision-check tests**

Create `src/lib/schedules/__tests__/collision-check.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { schedules, projects } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { checkCollision } from "../collision-check";

function seedSchedule(opts: {
  cron: string;
  avgTurns: number;
  projectId: string;
  status?: "active" | "paused";
}): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(schedules)
    .values({
      id,
      projectId: opts.projectId,
      name: `s-${id.slice(0, 4)}`,
      prompt: "test",
      cronExpression: opts.cron,
      status: opts.status ?? "active",
      type: "scheduled",
      firingCount: 0,
      suppressionCount: 0,
      heartbeatSpentToday: 0,
      failureStreak: 0,
      turnBudgetBreachStreak: 0,
      avgTurnsPerFiring: opts.avgTurns,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

function seedProject(): string {
  const id = randomUUID();
  const now = new Date();
  db.insert(projects)
    .values({ id, name: "p", status: "active", createdAt: now, updatedAt: now })
    .run();
  return id;
}

describe("checkCollision", () => {
  beforeEach(() => {
    db.delete(schedules).run();
    db.delete(projects).run();
  });

  it("returns no warnings when no overlap exists", () => {
    const pid = seedProject();
    seedSchedule({ cron: "0 3 * * *", avgTurns: 500, projectId: pid });
    expect(checkCollision("0 15 * * *", 500, pid, null)).toEqual([]);
  });

  it("detects overlap when two heavy schedules share a 5-min bucket", () => {
    const pid = seedProject();
    seedSchedule({ cron: "2 * * * *", avgTurns: 2000, projectId: pid });
    const warnings = checkCollision("0 * * * *", 2000, pid, null);
    expect(warnings.length).toBe(1);
    expect(warnings[0].type).toBe("cron_collision");
    expect(warnings[0].estimatedConcurrentSteps).toBeGreaterThanOrEqual(4000);
  });

  it("ignores paused schedules", () => {
    const pid = seedProject();
    seedSchedule({
      cron: "2 * * * *",
      avgTurns: 2000,
      projectId: pid,
      status: "paused",
    });
    expect(checkCollision("0 * * * *", 2000, pid, null)).toEqual([]);
  });

  it("excludes the excludeScheduleId (for PUT updates)", () => {
    const pid = seedProject();
    const existing = seedSchedule({
      cron: "0 * * * *",
      avgTurns: 3000,
      projectId: pid,
    });
    expect(checkCollision("0 * * * *", 3000, pid, existing)).toEqual([]);
  });

  it("does not warn when combined steps are below the threshold", () => {
    const pid = seedProject();
    seedSchedule({ cron: "2 * * * *", avgTurns: 500, projectId: pid });
    expect(checkCollision("0 * * * *", 500, pid, null)).toEqual([]);
  });
});
```

- [ ] **Step 12.2: Run to verify RED**

Run: `npx vitest run src/lib/schedules/__tests__/collision-check.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 12.3: Implement collision-check**

Create `src/lib/schedules/collision-check.ts`:

```typescript
import { db } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { expandCronMinutes } from "./interval-parser";

const BUCKET_SIZE_MIN = 5;
const COLLISION_THRESHOLD_TURNS = 3000;

export interface CronCollisionWarning {
  type: "cron_collision";
  overlappingSchedules: string[];
  overlappingMinutes: number[];
  estimatedConcurrentSteps: number;
}

/**
 * Check if a candidate cron collides with existing active schedules in the
 * same project inside a 5-minute bucket, weighted by the sum of their
 * avgTurnsPerFiring. Warns only when combined weight exceeds 3000 steps.
 *
 * Passing an excludeScheduleId skips that schedule (for PUT flows where a
 * schedule should not collide with its own prior state).
 *
 * Deterministic — runs against nominal cron expansion, not chat-pressure
 * adjusted times.
 */
export function checkCollision(
  candidateCron: string,
  candidateAvgTurns: number,
  projectId: string | null,
  excludeScheduleId: string | null,
): CronCollisionWarning[] {
  let candidateMinutes: number[];
  try {
    candidateMinutes = expandCronMinutes(candidateCron);
  } catch {
    return [];
  }

  const candidateBuckets = new Set(
    candidateMinutes.map((m) => Math.floor(m / BUCKET_SIZE_MIN)),
  );

  const conditions = [eq(schedules.status, "active")];
  if (projectId !== null) {
    conditions.push(eq(schedules.projectId, projectId));
  }
  if (excludeScheduleId !== null) {
    conditions.push(ne(schedules.id, excludeScheduleId));
  }

  const others = db
    .select({
      id: schedules.id,
      name: schedules.name,
      cronExpression: schedules.cronExpression,
      avgTurnsPerFiring: schedules.avgTurnsPerFiring,
    })
    .from(schedules)
    .where(and(...conditions))
    .all();

  const overlappingNames: string[] = [];
  const overlappingMinutesSet = new Set<number>();
  let totalOtherTurns = 0;

  for (const other of others) {
    let otherMinutes: number[];
    try {
      otherMinutes = expandCronMinutes(other.cronExpression);
    } catch {
      continue;
    }
    const otherBuckets = new Set(
      otherMinutes.map((m) => Math.floor(m / BUCKET_SIZE_MIN)),
    );
    const sharedBuckets = [...otherBuckets].filter((b) =>
      candidateBuckets.has(b),
    );
    if (sharedBuckets.length > 0) {
      overlappingNames.push(other.name);
      totalOtherTurns += other.avgTurnsPerFiring ?? 0;
      for (const b of sharedBuckets) {
        overlappingMinutesSet.add(b * BUCKET_SIZE_MIN);
      }
    }
  }

  const combinedTurns = candidateAvgTurns + totalOtherTurns;
  if (
    overlappingNames.length === 0 ||
    combinedTurns < COLLISION_THRESHOLD_TURNS
  ) {
    return [];
  }

  return [
    {
      type: "cron_collision",
      overlappingSchedules: overlappingNames,
      overlappingMinutes: [...overlappingMinutesSet].sort((a, b) => a - b),
      estimatedConcurrentSteps: combinedTurns,
    },
  ];
}
```

- [ ] **Step 12.4: Run to verify GREEN**

Run: `npx vitest run src/lib/schedules/__tests__/collision-check.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 12.5: Wire collision warnings into POST /api/schedules**

Edit `src/app/api/schedules/route.ts`. Add the import:

```typescript
import { checkCollision } from "@/lib/schedules/collision-check";
```

At the end of the POST handler, after the schedule is inserted, compute and attach warnings. Find the existing `return NextResponse.json(row)` and replace with:

```typescript
  const warnings = checkCollision(cronExpression, 0, projectId ?? null, null);
  return NextResponse.json({ schedule: row, warnings });
```

- [ ] **Step 12.6: Wire collision warnings into PUT /api/schedules/:id**

Edit `src/app/api/schedules/[id]/route.ts`. Similar change at the end of the PUT handler:

```typescript
  const warnings = checkCollision(
    cronExpression,
    schedule.avgTurnsPerFiring ?? 0,
    schedule.projectId ?? null,
    schedule.id,
  );
  return NextResponse.json({ schedule: updatedRow, warnings });
```

**Note:** these are response-shape changes. Existing consumers of these endpoints expect the schedule directly. The schedule form in Task 13 will read `res.schedule` and `res.warnings`. If preserving backwards compat is required, spread instead: `{ ...row, warnings }`.

- [ ] **Step 12.7: Run tests**

Run: `npx vitest run src/lib/schedules src/app/api/schedules`
Expected: PASS.

- [ ] **Step 12.8: Commit**

```bash
git add src/lib/schedules/collision-check.ts src/lib/schedules/__tests__/collision-check.test.ts src/app/api/schedules/route.ts src/app/api/schedules/[id]/route.ts
git commit -m "feat(schedules): pre-flight cron collision warning at save time"
```

---

## Task 13: Schedule form — rename + tooltips + calibration hint + warning banner

**Files:**
- Modify: `src/components/schedules/schedule-form.tsx`
- Modify: `src/components/schedules/schedule-create-sheet.tsx`
- Modify: `src/components/schedules/schedule-edit-sheet.tsx`

This task is UI-heavy. Steps describe form changes without full component test coverage; smoke-test manually via `npm run dev`.

- [ ] **Step 13.1: Add Max agent steps field to schedule-form.tsx**

Edit `src/components/schedules/schedule-form.tsx`. Locate the form's state block and add:

```typescript
const [maxTurns, setMaxTurns] = useState<number | null>(initial?.maxTurns ?? null);
```

Add the form field near the existing budget/tuning fields:

```tsx
<div className="space-y-2">
  <Label htmlFor="max-turns">Max agent steps per run</Label>
  <Input
    id="max-turns"
    type="number"
    min={1}
    max={10000}
    placeholder="Inherits global default"
    value={maxTurns ?? ""}
    onChange={(e) =>
      setMaxTurns(e.target.value ? parseInt(e.target.value, 10) : null)
    }
  />
  <p className="text-muted-foreground text-xs">
    One step = one agent action (message, tool call, or sub-response). Most
    schedules use 50–500 steps; heavy research runs 2,000+.
  </p>
</div>
```

Include `maxTurns` in the submit payload sent to `/api/schedules`.

- [ ] **Step 13.2: Add prompt-field tooltip**

Near the prompt textarea, add below it:

```tsx
<p className="text-muted-foreground text-xs">
  Note: writing &quot;MAX N turns&quot; in your prompt is a hint to the model,
  not a runtime limit. Use <strong>Max agent steps</strong> below to enforce
  a budget.
</p>
```

- [ ] **Step 13.3: Add inline calibration hint**

Below the prompt field, add a calibration hint that reads from the schedule list if a similar schedule exists (same `agentProfile` and non-null `avgTurnsPerFiring`). For v1, compute client-side:

```tsx
{suggestedSteps !== null && (
  <p className="text-muted-foreground text-xs">
    Schedules like this average ~{suggestedSteps} steps.
  </p>
)}
```

`suggestedSteps` is a `useMemo` over the schedule list prop (or fetched once on mount) — pick the median `avgTurnsPerFiring` among existing schedules with the same `agentProfile`.

- [ ] **Step 13.4: Render collision warning banner in sheets**

Edit `src/components/schedules/schedule-create-sheet.tsx`. After the POST call, read `res.warnings` from the response. If non-empty, render an amber banner inside `SheetContent` (remember the recurring shadcn issue: body must have `px-6`):

```tsx
{warnings.length > 0 && (
  <div className="mx-6 mb-4 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm">
    <p className="font-medium text-amber-900">
      Overlap detected with: {warnings[0].overlappingSchedules.join(", ")}
    </p>
    <p className="text-amber-800">
      Combined load: ~{warnings[0].estimatedConcurrentSteps} agent steps.
      Schedules will take turns; the last to run may be delayed.
    </p>
  </div>
)}
```

Do the same in `schedule-edit-sheet.tsx`.

Also update the POST/PUT result handlers to read `res.schedule` instead of the top-level response (response shape changed in Task 12).

- [ ] **Step 13.5: Smoke test**

Run: `npm run dev`
Navigate to `/schedules`, create two schedules with overlapping crons (e.g. both at `0 * * * *` with high avgTurns seeded manually in the DB), verify the warning banner renders. Submit with a `maxTurns` value set and verify it persists via `SELECT max_turns FROM schedules` in sqlite CLI.

- [ ] **Step 13.6: Commit**

```bash
git add src/components/schedules/schedule-form.tsx src/components/schedules/schedule-create-sheet.tsx src/components/schedules/schedule-edit-sheet.tsx
git commit -m "feat(schedules): max agent steps field + tooltips + collision warning banner"
```

---

## Task 14: Architectural decision records (TDRs)

**Files:**
- Create: `.claude/skills/architect/references/tdr-atomic-slot-claim.md`
- Create: `.claude/skills/architect/references/tdr-evidence-based-cap.md`
- Create: `.claude/skills/architect/references/tdr-failure-class-streaks.md`
- Create: `.claude/skills/architect/references/tdr-manual-honors-cap.md`
- Create: `.claude/skills/architect/references/tdr-lock-holders-leased.md`
- Create: `.claude/skills/architect/references/tdr-chat-shares-event-loop.md`

Each TDR is a short markdown file capturing the architectural principle and its motivating incident. Pattern: Title / Status / Date / Context / Decision / Consequences.

- [ ] **Step 14.1: TDR 1 — atomic slot claim**

Create `.claude/skills/architect/references/tdr-atomic-slot-claim.md` with this body:

```markdown
# TDR: Concurrency slot claim is a single SQL statement, not check-then-act

**Status:** Accepted
**Date:** 2026-04-08
**Incident:** 2026-04-08 schedule starvation (5 concurrent firings consumed ~12,600 turns, killed chat SSE)

## Context

The scheduler has two concurrent coordination points: `tickScheduler()` (the poll loop) and `drainQueue()` (the post-completion chain at `src/lib/schedules/scheduler.ts:420`). Both need to check "is the global cap full?" before firing a new task. A naive SELECT then INSERT across these two entry points races and allows the cap to be exceeded.

## Decision

The slot claim MUST be a single SQL statement. We use an atomic conditional UPDATE with a subquery inside the WHERE clause, exploiting SQLite's serialized write lock to guarantee two concurrent claim attempts cannot both succeed.

The implementation lives in `src/lib/schedules/slot-claim.ts`.

## Consequences

- Future coordination primitives must also use single-statement atomic claims. Never SELECT then UPDATE.
- The approach is SQLite-specific. If the backend moves to Postgres, revisit with SELECT ... FOR UPDATE or advisory locks.
- `changes = 0` is a normal outcome meaning "lost the race" — callers must handle it as "leave in queued, retry via drain."
```

- [ ] **Step 14.2: TDR 2 — evidence-based cap**

Create `.claude/skills/architect/references/tdr-evidence-based-cap.md`:

```markdown
# TDR: Scheduler cap is static and evidence-based

**Status:** Accepted
**Date:** 2026-04-08

## Context

The 2026-04-08 incident showed 5 concurrent schedules starved the chat SSE stream. The cap of 2 (later 3) was chosen as a guess, not a measurement. Without `schedule_firing_metrics` we have no way to validate or refine it.

## Decision

The cap starts at 2 and is raised to 3 only after one week of `schedule_firing_metrics` telemetry shows:
- Chat SSE P99 first-token latency stays below 2 seconds
- `event_loop_lag_ms` p99 stays below 50ms
- `slot_wait_ms` p95 stays below 60s under typical load

Any future change to the cap requires re-running the validation against the metrics table.

## Consequences

- `schedule_firing_metrics` is load-bearing. Never cut it from follow-up specs.
- Dynamic cap adjustment is deferred until the static cap proves insufficient. Dynamic control loops have failure modes (oscillation, thundering herd) that don't belong in a first ship.
```

- [ ] **Step 14.3: TDR 3 — failure class streaks**

Create `.claude/skills/architect/references/tdr-failure-class-streaks.md`:

```markdown
# TDR: Auto-pause streak counts per failure class

**Status:** Accepted
**Date:** 2026-04-08

## Context

The original scheduler had a single `failureStreak` that tripped auto-pause after 3 consecutive failures regardless of cause. Sharing this counter across genuinely-failing runs and misconfigured `maxTurns` values is a footgun: a user who sets `maxTurns=10` on a schedule averaging 40 would trip auto-pause in 3 firings — potentially within 3 minutes on a `* * * * *` cron — before they realized the config took effect.

## Decision

Split the streak counter per failure class:
- `failureStreak` — generic failures (SDK error, timeout, auth, etc.). Auto-pause threshold: 3.
- `turnBudgetBreachStreak` — turn-limit exceeded. Auto-pause threshold: 5, with first-breach grace: breaches in the first 2 cron intervals after a `maxTurnsSetAt` edit are logged only.

Future failure modes (e.g. context window exceeded, MCP tool failures) should each get their own counter if the appropriate auto-pause threshold differs from the generic 3.

## Consequences

- `schedules` schema grows one counter column per named failure class.
- The runtime adapter must write explicit `failure_reason` at terminal transitions so the classifier has reliable input — string-matching error text is fragile.
```

- [ ] **Step 14.4: TDR 4 — manual honors cap**

Create `.claude/skills/architect/references/tdr-manual-honors-cap.md`:

```markdown
# TDR: Manual execute honors the global cap by default

**Status:** Accepted
**Date:** 2026-04-08

## Context

Operational controls like "Run now" buttons are tempting to implement as cap-bypassing shortcuts, but a user who clicks them 5 times in 2 seconds can reproduce the exact incident profile that motivated the cap in the first place (2026-04-08: 5 concurrent Opus runs, ~12,600 turns, starved chat).

## Decision

`POST /api/schedules/:id/execute` honors `SCHEDULE_MAX_CONCURRENT` by default. When the cap is full, return `429` with an ETA for the next free slot. An explicit `?force=true` query parameter bypasses the cap, logged to `usage_ledger` as `activityType='manual_force_bypass'` for audit.

## Consequences

- Future operational endpoints (bulk re-run, workflow force-trigger) should follow the same pattern: honor cap + explicit force flag + audit log.
- Users who genuinely need rapid-fire execution have an escape hatch, but the happy path defaults to safety.
- Audit log entries can be queried to detect abusive or automated bypass patterns.
```

- [ ] **Step 14.5: TDR 5 — lock holders leased**

Create `.claude/skills/architect/references/tdr-lock-holders-leased.md`:

```markdown
# TDR: All lock holders carry lease expiries + reapers

**Status:** Accepted
**Date:** 2026-04-08

## Context

A hung SDK call can permanently wedge any lock: group locks, concurrency slots, even the existing per-schedule claim (which sets `nextFireAt = NULL` as a lock at `src/lib/schedules/scheduler.ts:240`; if `fireSchedule` throws before writing the new `nextFireAt`, the schedule is stuck until process restart).

## Decision

Every lock primitive in the scheduler pipeline must carry a lease expiry and a reaper:
1. **Concurrency slots** — `tasks.lease_expires_at` reaped at each `tickScheduler()` call. Expired leases are aborted via the execution-manager AbortController and marked failed/lease_expired.
2. **Per-schedule claim** — currently relies on `bootstrapNextFireTimes()` at startup; future work should add a time-based reaper.
3. **New locks** — any future coordination primitive must ship with a reaper from day one.

Default lease: 20 minutes. Override per-schedule via `schedules.max_run_duration_sec`.

## Consequences

- Lock holders cannot rely on "the other code path will clean this up." Every claim must be either released normally (on completion) or reaped (on lease expiry).
- The reaper is idempotent — safe to run at every tick.
- Aborting via AbortController requires the runtime adapter to honor the signal; all SDK query calls must pass through the abort controller from execution-manager.
```

- [ ] **Step 14.6: TDR 6 — chat shares event loop**

Create `.claude/skills/architect/references/tdr-chat-shares-event-loop.md`:

```markdown
# TDR: Chat and scheduled agents compete for the same Node event loop

**Status:** Accepted
**Date:** 2026-04-08

## Context

Stagent runs chat and scheduled tasks in the same Node process, on the same event loop. The 2026-04-08 incident showed this is a critical architectural constraint: when 5 schedules saturated the event loop, a user's chat SSE stream was starved and dropped mid-stream.

## Decision

This is a known and intentional constraint until a worker-thread isolation architecture is designed. Any feature that adds agent-like workloads (image pipelines, MCP servers, streaming tools) must assume chat is on the critical path and must not starve it.

Mitigations:
1. Global concurrency cap limits scheduled agents to `SCHEDULE_MAX_CONCURRENT` (default 2).
2. Chat soft pressure signal — when chat is streaming, the scheduler defers new firings by 30s (`src/lib/chat/active-streams.ts` + `scheduler.ts:applyChatPressure`).
3. Spec B hotfix guarantees chat messages never persist as empty content even under worst-case contention.

## Consequences

- Future high-throughput features must evaluate event-loop impact before shipping.
- Worker-thread isolation is tracked as an architectural follow-up. This TDR is the anchor point for that future work.
- Profiling under load should measure `event_loop_lag_ms` and alert when p99 exceeds 50ms.
```

- [ ] **Step 14.7: Commit**

```bash
git add .claude/skills/architect/references/tdr-atomic-slot-claim.md .claude/skills/architect/references/tdr-evidence-based-cap.md .claude/skills/architect/references/tdr-failure-class-streaks.md .claude/skills/architect/references/tdr-manual-honors-cap.md .claude/skills/architect/references/tdr-lock-holders-leased.md .claude/skills/architect/references/tdr-chat-shares-event-loop.md
git commit -m "docs(architect): 6 TDRs for schedule orchestration principles"
```

---

## Task 15: End-to-end integration test

**Files:**
- Create: `src/lib/schedules/__tests__/integration.test.ts`

Final integration test validating the full cap + queue + reap path composes correctly. No Opus calls — the runtime is mocked.

- [ ] **Step 15.1: Write integration test**

Create `src/lib/schedules/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import {
  tasks,
  schedules,
  projects,
  settings,
  scheduleFiringMetrics,
  agentLogs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { tickScheduler } from "../scheduler";
import { countRunningScheduledSlots } from "../slot-claim";

vi.mock("@/lib/agents/runtime", () => ({
  executeTaskWithRuntime: vi.fn(async () => {
    // Simulate a short-running task
    await new Promise((r) => setTimeout(r, 20));
  }),
}));

describe("schedule orchestration end-to-end", () => {
  beforeEach(() => {
    db.delete(scheduleFiringMetrics).run();
    db.delete(agentLogs).run();
    db.delete(tasks).run();
    db.delete(schedules).run();
    db.delete(projects).run();
    db.delete(settings).where(eq(settings.key, "schedule.maxConcurrent")).run();
    db.insert(settings)
      .values({ key: "schedule.maxConcurrent", value: "2", updatedAt: new Date() })
      .run();
  });

  it("5 schedules firing at once → exactly 2 run, 3 queue", async () => {
    const pid = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({ id: pid, name: "p", status: "active", createdAt: now, updatedAt: now })
      .run();

    const past = new Date(now.getTime() - 10_000);
    for (let i = 0; i < 5; i++) {
      db.insert(schedules)
        .values({
          id: randomUUID(),
          projectId: pid,
          name: `sched-${i}`,
          prompt: "test",
          cronExpression: "* * * * *",
          status: "active",
          type: "scheduled",
          firingCount: 0,
          suppressionCount: 0,
          heartbeatSpentToday: 0,
          failureStreak: 0,
          turnBudgetBreachStreak: 0,
          nextFireAt: past,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    await tickScheduler();

    expect(countRunningScheduledSlots()).toBe(2);
    const queued = db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "queued"))
      .all();
    expect(queued.length).toBe(3);
  });
});
```

- [ ] **Step 15.2: Run and verify PASS**

Run: `npx vitest run src/lib/schedules/__tests__/integration.test.ts`
Expected: PASS.

- [ ] **Step 15.3: Run full suite for final regression check**

Run: `npx vitest run`
Expected: PASS across all test files.

- [ ] **Step 15.4: Commit**

```bash
git add src/lib/schedules/__tests__/integration.test.ts
git commit -m "test(schedules): end-to-end cap + queue integration test"
```

---

## Final verification

After all tasks complete:

- [ ] **Full test suite**: `npx vitest run` — all green, no regressions
- [ ] **TypeScript check**: `npx tsc --noEmit` — zero errors
- [ ] **Manual smoke test**: `npm run dev`, create 3 schedules with overlapping crons, observe cap enforcement kicks in and queued schedules drain sequentially
- [ ] **Incident reproduction**: manually fire 5 schedules via `POST /api/schedules/:id/execute?force=true` in rapid succession, send a chat message, confirm the chat SSE stream stays responsive and no empty-content rows are left behind
- [ ] **Telemetry check**: query `SELECT * FROM schedule_firing_metrics` — confirm rows exist with non-null `slot_wait_ms` and `duration_ms`
- [ ] **Roadmap update**: append a "Schedule Orchestration Resilience" subsection to `features/roadmap.md` with A/B/C completed entries plus future `schedule-collision-prevention` and `schedule-forecasting` entries
- [ ] **Ship**: push the branch, open a PR, wait for CI, merge. Leave `SCHEDULE_MAX_CONCURRENT=2` for the first week of telemetry

If all items pass, the feature is ready to ship. After one week of telemetry showing chat SSE p99 < 2s and event-loop lag p99 < 50ms, raise `SCHEDULE_MAX_CONCURRENT` from 2 to 3 and continue monitoring.
