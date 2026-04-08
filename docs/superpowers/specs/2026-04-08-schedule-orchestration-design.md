# Spec A — Schedule Orchestration

**Status:** Approved
**Created:** 2026-04-08
**Scope mode:** HOLD (maximum rigor)
**Related:** [Chat SSE Resilience Hotfix (Spec B)](./2026-04-08-chat-sse-resilience-hotfix-design.md), [Swarm Visibility (Spec C)](./2026-04-08-swarm-visibility-design.md)

## Context

On 2026-04-08 at 12:20:49 UTC, five scheduled agents fired simultaneously and consumed ~12,600 combined turns on Claude Opus 4.6 via the claude-code runtime. The concurrent load saturated the single Node.js event loop that hosts both scheduled tasks and interactive chat. A user's chat message sent at 12:21:55 dropped its SSE stream and persisted with `content: ""`.

The root cause is twofold: (1) schedules fire independently with no concurrency control beyond a title-pattern sibling guard, and (2) in-prompt instructions like "MAX 18 turns" are model hints, not runtime-enforced limits. This spec introduces a global concurrency cap, per-schedule turn budgets, lease-based timeouts, a minimal collision warning, and time-series metrics for evidence-based tuning.

**Key codebase discoveries that shape this design:**

1. **"Turn" = one SDK assistant message.** `src/lib/agents/claude-agent.ts:181` increments `turnCount` on `message.type === "assistant"`. No runtime enforcement today.
2. **Active execution tracking already exists.** `src/lib/agents/execution-manager.ts:14-62` maintains a `Map<taskId, RunningExecution>` with `getAllExecutions()`.
3. **Scheduler already atomically claims schedules** at `src/lib/schedules/scheduler.ts:238-252` via conditional UPDATE, and serializes drain via `drainQueue()` at line 51. The existing `.then(drainQueue)` chain at line 420 runs concurrent with the tick loop — any new coordination primitive must be correct under that interleaving.
4. **Turn budget header infrastructure exists.** `buildTurnBudgetHeader()` at claude-agent.ts:103 reads a global `MAX_TURNS` setting.
5. **Failure detection + auto-pause already shipped.** `detectFailureReason()` at scheduler.ts:122 parses error text; auto-pause after 3-streak exists.

## Goals

1. **Prevent concurrent schedule overload from starving chat.** No more than `SCHEDULE_MAX_CONCURRENT` scheduled agents run simultaneously.
2. **Enforce per-schedule turn budgets at runtime**, not via prompt hints.
3. **Prevent permanent lock holder hangs.** Every slot and lock carries a lease; a reaper cleans expired leases.
4. **Give users pre-flight awareness of cron overlaps** without forcing them to auto-stagger.
5. **Collect enough telemetry to tune the concurrency cap from evidence**, not intuition.

## Non-goals (NOT in scope)

These are deferred to follow-up specs to keep the initial ship focused and de-risked:

- **`concurrencyGroup` column and group locks** — future spec "Schedule Concurrency Groups". The incident was a global-cap problem, not a group problem.
- **Auto-stagger endpoint, 48h forecast report, collision-forecast notifications** — future spec "Schedule Predictability & Forecasting".
- **Turn drift detection, efficiency scoring (`useful_actions / total_turns`)** — future spec "Schedule Observability".
- **`turnBudgetAction: 'optimize'` meta-agent prompt rewriter** — future spec "Agent Self-Optimization".
- **Hard chat priority / `pauseSchedulesDuringChat` setting** — only if the AR1b soft pressure signal (below) proves insufficient.
- **Dynamic adaptive cap** based on measured P99 chat latency — architect explicitly recommended against until static cap proves insufficient.
- **`usage_ledger.turn_count` column** — derivable from `schedule_firing_metrics` and `agent_logs`.

## Design

### A.1 Concurrency limiter

**Cap:** `SCHEDULE_MAX_CONCURRENT` env var, default **2** for initial ship. Raise to 3 after one week of telemetry validates chat SSE P99 under load.

**Primitive:** atomic single-SQL conditional UPDATE. Check-then-act is forbidden — the tick loop and `drainQueue()` run concurrently via the `.then()` chain at scheduler.ts:420, and a `SELECT count(*) ... then fire` sequence will allow two callers to both see `activeCount < cap` and both fire.

Correct claim:

```sql
UPDATE tasks
   SET status = 'running',
       slot_claimed_at = :now,
       lease_expires_at = :now + :leaseSec
 WHERE id = :taskId
   AND status = 'queued'
   AND (SELECT COUNT(*)
          FROM tasks
         WHERE status = 'running'
           AND source_type = 'scheduled') < :cap;
```

`changes = 1` → proceed to `executeTaskWithRuntime()`. `changes = 0` → leave the task in `queued` state; `drainQueue()` will retry it after the next completion.

The primitive lives in a new helper `src/lib/schedules/slot-claim.ts` and is called by:
- `fireSchedule()` in scheduler.ts at line 412 (replace direct `executeTaskWithRuntime` call with `claimSlotThenExecute`)
- `drainQueue()` in scheduler.ts at line 74 (same)
- `POST /api/schedules/:id/execute` route handler (honors cap by default — see A.1.1)

### A.1.1 Manual execute

`POST /api/schedules/:id/execute` honors the cap by default. Behavior:

- **Slot available:** claim and run normally.
- **Cap full:** return `429 Too Many Requests` with body `{ error: 'capacity_full', slotEtaSec: N }` where `N` is the minimum `lease_expires_at - now()` across running slots.
- **Explicit bypass:** `?force=true` query parameter bypasses the cap, writes an audit-log entry to `usage_ledger` with `activityType = 'manual_force_bypass'`, and triggers a confirmation modal in the UI (handled client-side).

This closes the footgun where a user clicking "Run now" five times in 2 seconds could spawn five concurrent Opus runs.

### A.1.2 Chat soft pressure signal (AR1b)

An in-memory `activeChatStreams: Set<string>` lives in a new `src/lib/chat/active-streams.ts`. The chat engine at `src/lib/chat/engine.ts` adds to the set at stream start and removes at stream end (in the finally block — safe because Spec B already guarantees finally runs).

`tickScheduler()` calls `applyChatPressure()` before processing due schedules: if `activeChatStreams.size > 0`, any schedule whose `nextFireAt` is due gets its `nextFireAt` pushed forward by `SCHEDULE_CHAT_PRESSURE_DELAY_SEC` (default 30s) and skipped this tick. In-flight scheduled runs are not affected.

This is a soft signal, not a hard block — chat never starves schedules indefinitely because the delay is per-tick and one-shot.

### A.2 Lease + timeout + reaper

Every claimed slot carries a lease. The reaper runs at each `tickScheduler()` pass (60s cadence) and reaps expired leases.

**Schema additions to `tasks`:**
- `slot_claimed_at TIMESTAMP` — set atomically with the slot claim
- `lease_expires_at TIMESTAMP` — `slot_claimed_at + max_run_duration_sec`
- `failure_reason TEXT` — written explicitly by runtime adapter at terminal transitions

**Schema additions to `schedules`:**
- `max_run_duration_sec INTEGER DEFAULT NULL` — NULL inherits global default (1200s = 20 min)

**Reaper query:**

```sql
SELECT id FROM tasks
 WHERE status = 'running'
   AND source_type = 'scheduled'
   AND lease_expires_at < :now;
```

For each expired task: call `abortController.abort()` via the `RunningExecution` map at `execution-manager.ts:5`, then `UPDATE tasks SET status='failed', failure_reason='lease_expired', completed_at=:now`. The slot is freed automatically by the status change (the claim SQL counts `status='running'` rows).

**Runtime adapter change:** thread `AbortSignal` from `RunningExecution.abortController` into the SDK `query()` options in the scheduled runtime adapter. Chat already does this at `src/lib/chat/engine.ts:300`; mirror the pattern.

### A.3 Turn budget

**Schema addition to `schedules`:**

```sql
ALTER TABLE schedules ADD COLUMN max_turns INTEGER DEFAULT NULL
  CHECK (max_turns IS NULL OR (max_turns BETWEEN 1 AND 10000));
ALTER TABLE schedules ADD COLUMN max_turns_set_at TIMESTAMP;
ALTER TABLE schedules ADD COLUMN turn_budget_breach_streak INTEGER DEFAULT 0;
```

NULL `max_turns` inherits from the global `MAX_TURNS` setting already read by `buildTurnBudgetHeader()`.

**Enforcement:** pass `maxTurns` to SDK `query()` options in the scheduled runtime adapter. The SDK hard-stops at the limit (same mechanism chat uses at engine.ts:299).

**On breach — footgun-mitigated flow:**

1. **First-breach grace:** if `tasks.completed_at < schedules.max_turns_set_at + 2 × cron_interval`, the breach is logged only — it does not increment `turn_budget_breach_streak`. Protects users from tripping auto-pause on the very first firing after a config edit.
2. **Drift warning at streak ≥ 2:** send a notification: "Schedule X used {lastTurnCount}/{maxTurns} agent steps. Consider raising the budget or reducing the prompt scope."
3. **Auto-pause at streak ≥ 5** (higher than generic failure's 3): "Schedule X paused — 5 consecutive runs exceeded the {N}-step budget. Budget may be too low; typical runs use {avgTurnsPerFiring} steps."

The separate `turn_budget_breach_streak` counter is critical: conflating budget breaches with generic failures would let a user trip auto-pause in 3 minutes by setting `maxTurns=10` on a schedule that averages 40.

**Explicit `failure_reason` writes:** the runtime adapter writes `failure_reason` directly at terminal transitions (`turn_limit_exceeded`, `lease_expired`, `sdk_error`, `aborted`, etc.). `detectFailureReason()` at scheduler.ts:122 remains as a fallback for legacy or unknown cases but is no longer the primary classifier. String-matching is fragile.

### A.4 UI: rename + tooltips + calibration hint (PM recommendation)

- **Schedule form field rename:** "Max turns per firing" → **"Max agent steps per run"**. Keep `maxTurns` in code/API.
- **Tooltip on field:** "One step = one agent action (message, tool call, or sub-response). Most schedules use 50–500 steps; heavy research runs 2,000+."
- **Tooltip on prompt field:** "Note: writing 'MAX N turns' in your prompt is a hint to the model, not a runtime limit. Use Max agent steps below to enforce a budget."
- **Inline calibration hint:** when a user types a prompt, show "Schedules like this average ~{N} steps" derived from `avgTurnsPerFiring` across schedules with similar characteristics. Cheap — data already exists.

### A.5 Collision warning (PR1b — minimal, restored to scope)

**Trigger:** `POST /api/schedules` and `PUT /api/schedules/:id`.

**Check:** expand the incoming `cronExpression` over the next 24h using the existing cron parser at `src/lib/schedules/interval-parser.ts`. Bucket fire times by 5-minute windows. Compare against all other active schedules in the same project. If any 5-min bucket has ≥2 schedules whose combined `avgTurnsPerFiring > 3000`, return a warning.

**Response shape:** `200 OK` with the saved schedule plus:

```json
{
  "warnings": [{
    "type": "cron_collision",
    "overlappingSchedules": ["Price Monitor", "News Sentinel"],
    "nextCollisionAt": "2026-04-09T12:20:00Z",
    "estimatedConcurrentSteps": 6878
  }]
}
```

**UI:** the create/edit sheet renders a dismissible amber banner inside `SheetContent` (with `px-6 pb-6` per the recurring shadcn Sheet padding issue logged in MEMORY.md). Copy: "This schedule overlaps with Price Monitor and News Sentinel at {time}. They'll take turns; the last to run may be delayed ~2–4 min." One action: "[Save anyway]".

**Non-blocking:** the warning does not prevent save. It informs.

**Deferred:** auto-stagger endpoint, 48h forecast, collision-forecast notifications.

### A.6 Time-series metrics (AR3b)

New table `schedule_firing_metrics` for evidence-based cap tuning and post-hoc incident forensics. EMA on a single row erases the signal we need.

```sql
CREATE TABLE schedule_firing_metrics (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedules(id),
  task_id TEXT REFERENCES tasks(id),
  fired_at TIMESTAMP NOT NULL,
  slot_claimed_at TIMESTAMP,
  completed_at TIMESTAMP,
  slot_wait_ms INTEGER,          -- fired_at → slot_claimed_at
  duration_ms INTEGER,            -- slot_claimed_at → completed_at
  turn_count INTEGER,
  max_turns_at_firing INTEGER,
  event_loop_lag_ms REAL,         -- perf_hooks.monitorEventLoopDelay p99 during run
  peak_rss_mb INTEGER,
  chat_streams_active INTEGER,    -- count at slot claim
  concurrent_schedules INTEGER,   -- count at slot claim
  failure_reason TEXT
);
CREATE INDEX idx_sfm_schedule_time ON schedule_firing_metrics(schedule_id, fired_at DESC);
```

Insert a row in `recordFiringMetrics()` at scheduler.ts:419, on every completion (success or failure).

**Critical:** add matching bootstrap `CREATE TABLE IF NOT EXISTS` in `src/lib/db/index.ts` (per CLAUDE.md's recurring-issue note about bootstrap vs migrations). Also add `db.delete()` call in `src/lib/data/clear.ts` in FK-safe order (delete from `schedule_firing_metrics` before `schedules`).

### A.7 Data model — consolidated

```sql
-- schedules table
ALTER TABLE schedules ADD COLUMN max_turns INTEGER DEFAULT NULL
  CHECK (max_turns IS NULL OR (max_turns BETWEEN 1 AND 10000));
ALTER TABLE schedules ADD COLUMN max_turns_set_at TIMESTAMP;
ALTER TABLE schedules ADD COLUMN max_run_duration_sec INTEGER DEFAULT NULL;
ALTER TABLE schedules ADD COLUMN turn_budget_breach_streak INTEGER DEFAULT 0;

-- tasks table
ALTER TABLE tasks ADD COLUMN slot_claimed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN lease_expires_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN failure_reason TEXT;
CREATE INDEX idx_tasks_slot_running
  ON tasks(status, source_type, lease_expires_at)
  WHERE status = 'running';

-- schedule_firing_metrics (new)
-- [see A.6]
```

**Settings (existing key-value table, no schema change):**
- `schedule.maxConcurrent` default: `2`
- `schedule.maxRunDurationSec` default: `1200`
- `schedule.chatPressureDelaySec` default: `30`

### A.8 API surface

| Method | Path | Change |
|---|---|---|
| POST | `/api/schedules` | Response includes `warnings: [...]` from collision check |
| PUT | `/api/schedules/:id` | Same |
| POST | `/api/schedules/:id/execute` | Honors global cap by default; `?force=true` bypasses with audit log; returns `429 {error, slotEtaSec}` when full |
| GET | `/api/schedules/:id/metrics` | Returns recent `schedule_firing_metrics` rows for tuning/debug |

No new endpoints for orchestration proper. `/api/swarm-status` is defined in Spec C.

## Data flow — scheduler tick + slot claim

```
                     tickScheduler() (every 60s)
                             |
                             v
              ┌──────────────────────────────┐
              │ reapExpiredLeases()          │ ── abort via RunningExecution
              │   UPDATE tasks SET status=   │    + mark lease_expired
              │     'failed' WHERE status=   │
              │     'running' AND            │
              │     lease_expires_at < now() │
              └──────────────┬───────────────┘
                             |
                             v
              ┌──────────────────────────────┐
              │ findDueSchedules()           │
              │   SELECT ... WHERE           │
              │   next_fire_at <= now()      │
              └──────────────┬───────────────┘
                             |
                             v
              ┌──────────────────────────────┐
              │ applyChatPressure() [AR1b]   │
              │   if activeChatStreams > 0:  │
              │     push nextFireAt +30s,    │
              │     skip this tick           │
              └──────────────┬───────────────┘
                             |
                             v
              ┌──────────────────────────────┐
              │ for each due schedule:       │
              │   insertQueuedTask()         │
              │   atomicSlotClaim() ◄──────┐│
              │     UPDATE tasks SET       ││
              │       status='running',    ││ (single SQL, guarantees cap)
              │       slot_claimed_at=now(),││
              │       lease_expires_at=... ││
              │     WHERE id=? AND         ││
              │       status='queued' AND  ││
              │       (SELECT COUNT(*)     ││
              │        FROM tasks WHERE    ││
              │        status='running'    ││
              │        AND source_type=    ││
              │        'scheduled') < :cap ││
              │   if changes=0:            ││
              │     leave in queued,       ││
              │     drain will retry       ││
              │   if changes=1:            ││
              │     executeTaskWithRuntime ││
              │     .then(recordMetrics)   ││
              │     .then(drainQueue) ─────┘│
              └──────────────────────────────┘
```

## Error & Rescue Registry

| Error | Trigger | Impact | Rescue |
|---|---|---|---|
| Two ticks race on slot claim | `drainQueue()` concurrent with `tickScheduler()` | Cap breached (3 running when cap=2) | Atomic single-SQL claim (A.1); `changes=0` means lost the race — leave in queued |
| SDK hangs mid-run | Upstream Opus stall, network partition | Slot held forever, cap permanently reduced | Lease expiry + reaper aborts via AbortController after `max_run_duration_sec` |
| Reaper fails to fire | `tickScheduler` crashes or paused | Expired leases accumulate | Reaper is idempotent; runs at next tick. If tickScheduler itself is down, `bootstrapNextFireTimes` at startup repairs state |
| User sets `maxTurns=10` on schedule averaging 40 | Config footgun | Auto-pause in 3 firings (under naive design) | First-breach grace + separate `turn_budget_breach_streak` counter with threshold 5 + drift warning at streak 2 |
| `detectFailureReason` misclassifies | SDK error message format changes | Wrong streak incremented | Runtime adapter writes explicit `failure_reason` at terminal transitions; string-match is fallback only |
| Manual execute spammed | User double-clicks Run now 5× | Could exceed cap under naive design | Manual honors cap by default; `429 + slotEtaSec`; explicit `?force=true` for deliberate bypass with audit log |
| Chat pressure delay causes schedule to miss a cron interval | User has `* * * * *` cron, chat is streaming for 45s | Minute skipped | 30s delay is one-shot per tick; next tick re-evaluates. Document in UI help text |
| `schedule_firing_metrics` table unbounded growth | High-frequency schedules over months | Disk bloat | Periodic cleanup: `DELETE WHERE fired_at < now() - 30 days`. Deferred to follow-up if general maintenance sweep doesn't exist yet |
| Clock skew between scheduler and DB | Container restart, NTP drift | `lease_expires_at` mismatches | Use SQLite `CURRENT_TIMESTAMP` consistently; avoid mixing JS `Date.now()` |
| Collision check false positive under chat pressure | A delayed schedule shifts into a bucket that was previously clear | Confusing warning | Collision check runs against *nominal* cron expansion, not chat-pressure-adjusted times. Warning remains deterministic |
| Cap env var typo | User sets `SCHEDULE_MAX_CONCURRENT=abc` | Silent fallback to default | Parse with `parseInt`, log warning on NaN, use default; add settings-page validation UI |
| Lease expiry fires during a legitimate long run | Schedule takes 25 min, default lease 20 min | Run aborted falsely | Per-schedule `max_run_duration_sec` override; drift warning at 80% of lease |

## Telemetry / 48h post-ship watchlist

1. `COUNT(*) FROM chat_messages WHERE content='' AND status IN ('streaming','pending')` — must be 0 (Spec B success signal)
2. `schedule_firing_metrics.slot_wait_ms` — p50/p95 per schedule. If p95 > 300s, cap too tight
3. `schedules.failure_streak >= 3` count — auto-pause rate vs baseline
4. `schedules.turn_budget_breach_streak > 0` count — tracks `maxTurns` misconfig rate
5. `schedule_firing_metrics.failure_reason = 'lease_expired'` count — indicates timeouts too tight or SDK hangs
6. Chat SSE completion rate (`status='complete'` / total) — must stay at or above pre-incident baseline
7. `schedule_firing_metrics.event_loop_lag_ms` p99 — validates/falsifies cap=2; if always <50ms, raise to 3
8. Collision-warning acceptance rate (how often users save despite warning)
9. Manual `?force=true` bypass frequency — should be near-zero; alert if >5/week

## TDRs to capture

Create in `.claude/skills/architect/references/`:

1. **TDR: Concurrency slot claim is a single SQL statement, not check-then-act.** References the 2026-04-08 incident.
2. **TDR: Scheduler cap is static and evidence-based.** Changes require re-running the load test.
3. **TDR: Auto-pause streak counts per failure class.** Forces future failure modes to reason about whether they feed the generic streak or a dedicated one.
4. **TDR: Manual execute honors the global cap by default.** Operational controls prefer safety over convenience.
5. **TDR: All lock holders carry lease expiries + reapers.** Generalize beyond concurrency slots.
6. **TDR: Chat and scheduled agents compete for the same Node event loop.** Architectural constraint; future features must not starve chat.

## Tests

1. **Race-condition test:** spawn 10 concurrent `fireSchedule` calls against cap=3; assert exactly 3 slots claimed, no breach.
2. **Lease reaper test:** set tiny lease, trigger run, wait, assert reaper marks `failed`/`lease_expired` and frees slot.
3. **Turn budget enforcement test:** `maxTurns=5`, prompt that needs 50 turns, assert SDK hard-stops and `turn_budget_breach_streak` increments.
4. **First-breach grace test:** set new `maxTurns`, first firing breaches, assert streak stays at 0.
5. **Manual execute cap test:** fill cap, POST execute, assert 429 + `slotEtaSec`. POST with `?force=true`, assert 200 + audit log entry.
6. **Chat pressure test:** start fake chat stream, trigger scheduler tick, assert due schedules get `next_fire_at` pushed forward 30s.
7. **Collision warning test:** create overlapping cron, assert `warnings` array populated.
8. **Load test (validation of cap):** 5 schedules × 500-turn dummy prompts, measure chat SSE P99 first-token with cap=2. Assert P99 < 2s.
9. **Incident reproduction:** fire 5 real schedules → queue of 3, 2 wait → chat message sent → chat SSE stays responsive → no `content=''` row.

## Files touched

### Modify
- `src/lib/schedules/scheduler.ts` — tick loop, drain queue, reaper, firing metrics recording, chat pressure application
- `src/lib/agents/execution-manager.ts` — abortController surface (already exists, just wire)
- `src/lib/agents/claude-agent.ts` — runtime adapter turn budget + failure reason writes
- `src/lib/db/schema.ts` — new columns + table
- `src/lib/db/index.ts` — bootstrap CREATE TABLE IF NOT EXISTS for `schedule_firing_metrics`
- `src/lib/data/clear.ts` — add delete for new table (FK-ordered)
- `src/lib/schedules/interval-parser.ts` — reuse for collision check
- `src/app/api/schedules/route.ts` + `[id]/route.ts` — collision warning response shape
- `src/app/api/schedules/[id]/execute/route.ts` — cap check + force bypass
- `src/components/schedules/schedule-form.tsx` — new "Max agent steps" field + rename + tooltip + calibration hint

### New
- `src/lib/schedules/slot-claim.ts` — atomic primitive
- `src/lib/chat/active-streams.ts` — in-memory set for chat pressure signal
- `src/lib/schedules/collision-check.ts` — 24h cron expansion + bucket compare
- `.claude/skills/architect/references/tdr-*.md` — 6 new TDRs

## Ship plan

- **Feature flag:** `SCHEDULE_MAX_CONCURRENT` env var, default 2. Override raises post-telemetry.
- **Parallel with Spec B** — zero shared code; Spec B is a separate commit/PR.
- **After 1 week of telemetry:** raise cap from 2 → 3 if metrics healthy.
- **Update `features/roadmap.md`** post-ship with a "Schedule Orchestration Resilience" subsection including A/B/C completed entries plus future `schedule-collision-prevention` and `schedule-forecasting` entries.
