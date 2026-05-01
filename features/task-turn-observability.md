---
title: Task Turn Count Observability
status: planned
priority: P2
milestone: post-mvp
source: .archive/handoff/feature-task-turn-observability.md
dependencies: [agent-integration, scheduled-prompt-loops]
---

# Task Turn Count Observability

## Description

Surface per-task turn and token metrics on `get_task` and `list_tasks`, and commit to a written definition of what the existing turn-count metric actually measures. Today, turn counts are aggregated on the `schedules` table (`lastTurnCount`, `avgTurnsPerFiring`) but individual `tasks` rows have no persisted metrics — the scheduler computes them on demand via `COUNT(*) FROM agentLogs WHERE taskId = ?`. That works for schedule aggregates but leaves one-off test tasks and manual task runs with no visible metric at all.

The second half of the problem is interpretive, not technical. Observed turn counts in production range from 700 to 2,900+:

| Schedule | Avg Turns | Last Turns |
|---|---|---|
| Prediction Markets Monitor | 2,530 | 20 |
| Price Monitor | 2,462 | 2,926 |
| Daily Briefing | 1,759 | 2,012 |
| News Sentinel | 1,686 | 2,227 |

These numbers are far higher than any plausible "reasoning round" count — an agent making 2,900 tool-call rounds would be prohibitively slow and expensive. The metric is almost certainly counting something else (assistant messages in the stream, agentLogs rows of all types, or a composite). Without written definition, both users and AI assistants misread the numbers and reach wrong diagnoses (e.g., "the agent is hitting a 48-turn limit" when it's actually completing successfully with 2,227 of whatever unit).

## User Story

As an operator tuning a schedule's prompt, I want to fire a one-off test task and immediately see how many turns and tokens it consumed, with a clear and written understanding of what those numbers represent — so I can validate my prompt optimization and compare apples-to-apples against the schedule's historical average.

## Technical Approach

### 1. Establish the metric definition first

Before adding any columns, a short investigation subtask: trace `turnCount++` at `src/lib/agents/claude-agent.ts:225` and the scheduler's `COUNT(*) FROM agentLogs` at `src/lib/schedules/scheduler.ts:191-195`. Determine exactly what is being counted. Write one precise paragraph into the References section of this spec defining the metric (e.g., "Number of stream frames where the agent produced an assistant message"). If the definition reveals the current name is misleading, rename or split the field — do not persist a misnamed metric.

### 2. Data model

- Add `turnCount: integer("turn_count")` and `tokenCount: integer("token_count")` to the `tasks` table in `src/lib/db/schema.ts` (near line 57 where `maxTurns` lives). Both nullable — `null` means "not yet populated or pre-existing row."
- Add matching idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` updates in `src/lib/db/bootstrap.ts`. Per `MEMORY.md` → "DB bootstrap": schema.ts and bootstrap.ts must stay in sync or deployed DBs get "no such table/column" errors.
- No migration file is strictly required for this to work locally, but if the project's migration convention applies, add one under `src/lib/db/migrations/`.

### 3. Capture at task completion

- In `src/lib/agents/claude-agent.ts` near the result-frame handler (~lines 225, 300-309), persist the final `turnCount` and the token total onto the task row at completion. The token total is available in the SDK result frame's usage metadata.
- The scheduler-side aggregation at `src/lib/schedules/scheduler.ts:191-236` should continue to work unchanged, but ideally it now reads from `tasks.turnCount` directly for completed tasks instead of recomputing via `COUNT(*)`. Keep the `COUNT(*)` path as a fallback for rows with `turnCount IS NULL` (pre-existing rows).

### 4. Surface on MCP tool responses

- Extend `get_task` and `list_tasks` output in `src/lib/chat/tools/task-tools.ts:215-236` to include `turnCount` and `tokenCount` for completed tasks. Add a short field comment that references the written definition from step 1.

### 5. Consistency with schedule aggregates

- Ensure `lastTurnCount` and `avgTurnsPerFiring` on schedules are computed from the same field that tasks now expose, so chat responses describing a schedule and chat responses describing one of its fired tasks don't contradict each other.

## Acceptance Criteria

- [ ] The metric definition is written into this spec's References section (and mirrored to `AGENTS.md` or `MEMORY.md` where runtime metrics are discussed) before any columns are added.
- [ ] `tasks` table has `turnCount` and `tokenCount` columns, reflected in both `src/lib/db/schema.ts` and `src/lib/db/bootstrap.ts`.
- [ ] `get_task` and `list_tasks` responses include both fields for completed tasks.
- [ ] One-off manual tasks (not schedule-fired) also capture and expose these metrics.
- [ ] Schedule aggregates `lastTurnCount` / `avgTurnsPerFiring` are consistent with the individual task `turnCount` for the same firing — a chat response describing both should never contradict itself.
- [ ] `src/lib/data/clear.ts` is verified to still work correctly (no new FK-dependent tables introduced — just columns — but the safety-net test per `MEMORY.md` must stay green).
- [ ] Existing `claude-agent` and `scheduler` tests still pass.
- [ ] A new test asserts that a completed task has `turnCount > 0` and `tokenCount > 0`.

## Scope Boundaries

**Included:**
- Schema columns on `tasks` (`turnCount`, `tokenCount`) in schema.ts + bootstrap.ts
- Capture at task completion in `claude-agent.ts`
- MCP tool response field additions on `get_task` / `list_tasks`
- Written metric definition in spec References + AGENTS.md / MEMORY.md
- Consistency check between schedule aggregates and task metrics

**Excluded:**
- A full cost-and-usage dashboard (already covered by `cost-and-usage-dashboard.md`)
- Historical backfill of pre-existing tasks (new rows only — historical rows keep `turnCount: null` and fall back to the scheduler's `COUNT(*)` path)
- Per-turn timing breakdowns
- Cross-runtime metric normalization (this spec is scoped to the `claude-code` runtime — other runtimes can be extended in a follow-up if needed)

## References

- Source: `.archive/handoff/feature-task-turn-observability.md`
- `src/lib/db/schema.ts:57` — existing `maxTurns` column on `tasks` (new columns land nearby)
- `src/lib/agents/claude-agent.ts:225` — existing `turnCount++` counter in stream processing
- `src/lib/agents/claude-agent.ts:300-309` — result-frame handler (target for persist-on-completion)
- `src/lib/schedules/scheduler.ts:191-195` — existing `COUNT(*) FROM agentLogs` aggregation path
- `src/lib/schedules/scheduler.ts:235-236` — existing write of `lastTurnCount` / `avgTurnsPerFiring` to schedule row
- `src/lib/chat/tools/task-tools.ts:215-236` — existing `get_task` / `list_tasks` response shape
- Related features: `cost-and-usage-dashboard.md`, `workflow-intelligence-observability.md`, `scheduled-prompt-loops.md`
- **Metric definition (to be filled in by step 1 subtask):** _precise one-paragraph definition of what `turnCount` counts_
