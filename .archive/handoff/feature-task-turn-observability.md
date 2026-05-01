---
title: "Feature: Task Execution Turn Count Observability"
audience: ainative-base
status: proposed
source_branch: wealth-mgr
handoff_reason: Turn count metrics are only visible on schedule aggregate stats, not on individual tasks. The metric's unit of measurement is also undocumented, making it impossible to diagnose performance issues or validate prompt optimizations.
---

# Feature: Task Execution Turn Count Observability

## Summary

Two related observability gaps make it difficult to diagnose and optimize agent task performance:

### Problem 1: Individual task turn counts not exposed

Schedule records expose aggregate metrics (`lastTurnCount`, `avgTurnsPerFiring`), but individual task records returned by `get_task` and `list_tasks` do not include the turn count for that specific execution. When testing prompt optimizations (e.g., firing a one-off task to validate changes), there's no way to see how many turns it consumed.

### Problem 2: Turn count unit is undocumented

Observed turn counts across schedules range from 700 to 2,900+:

| Schedule | Avg Turns | Last Turns |
|---|---|---|
| Prediction Markets Monitor | 2,530 | 20 |
| Price Monitor | 2,462 | 2,926 |
| Daily Briefing | 1,759 | 2,012 |
| News Sentinel | 1,686 | 2,227 |

These numbers are far too high for tool-call rounds (an agent making 2,900 tool calls would be extremely expensive and slow). The metric likely measures something else — tokens, sub-operations, internal claude-code steps, or a composite. Without documentation, users and AI assistants misinterpret the numbers, leading to incorrect diagnoses (e.g., "the agent is hitting a 48-turn limit" when it's actually completing successfully with 2,227 of whatever unit).

## Proposed Fix

### For Problem 1:
- Add `turnCount` (or equivalent metric) to task records
- Expose it in `get_task` and `list_tasks` responses
- Populate it when task execution completes

### For Problem 2:
- Document what the turn count metric measures (unit, what increments it)
- If it's a composite metric, consider breaking it into sub-metrics:
  - `toolCallCount` — number of tool invocations
  - `tokenCount` — total tokens consumed
  - `turnCount` — number of agent reasoning + action cycles
- Surface the metric name/unit in API responses or documentation so the number is self-describing

## Affected Areas

- Task data model (add turn metric fields)
- Task execution runtime (capture and persist metrics on completion)
- MCP tool schemas for `get_task` / `list_tasks` (include new fields in response)
- Schedule firing logic (if turn metrics flow from task → schedule aggregates, ensure consistency)
- API documentation

## Acceptance Criteria

- [ ] `get_task` response includes turn/token metrics for completed tasks
- [ ] `list_tasks` response includes turn/token metrics
- [ ] Metric unit is documented (in API response field name or docs)
- [ ] Schedule aggregate metrics (`avgTurnsPerFiring`, `lastTurnCount`) are consistent with individual task metrics
- [ ] One-off test tasks (not schedule-fired) also capture and expose metrics
