---
title: Heartbeat Scheduler
status: completed
priority: P0
milestone: post-mvp
source: ideas/vision/ainative-OpenClaw-Companion-Research-Report.md
dependencies: [scheduled-prompt-loops]
---

# Heartbeat Scheduler

## Description

Add a proactive intelligence mode to ainative's scheduler where agents periodically evaluate a checklist and decide whether action is needed — suppressing no-op runs and only executing when the checklist warrants it. This transforms agents from reactive (wait for user commands) to proactive (monitor and act on business signals).

The existing `scheduled-prompt-loops` feature provides clock-driven scheduling: fire at time X, execute prompt Y. The heartbeat scheduler adds intelligence-driven scheduling: fire at time X, evaluate checklist Z, act only if something needs attention. The key difference is agent autonomy in determining whether to act, which enables the "agents that run your business" positioning.

Inspired by OpenClaw's heartbeat system (30-minute default, HEARTBEAT.md checklist, HEARTBEAT_OK suppression) but implemented within ainative's governed architecture — cost controls, approval gates, and visibility on the Kanban board.

## User Story

As a solo founder, I want my AI agents to proactively check my business signals (customer inquiries, revenue metrics, content calendar, support queue) and only notify me when something needs attention, so that I don't have to manually trigger every agent action.

## Technical Approach

### Schema Changes

Extend the existing `schedules` table in `src/lib/db/schema.ts`:

```
schedules table additions:
  type TEXT DEFAULT 'scheduled'       -- 'scheduled' (existing) | 'heartbeat' (new)
  heartbeatChecklist TEXT             -- JSON array of checklist items the agent evaluates
  activeHoursStart INTEGER           -- Hour of day (0-23) when heartbeats are active
  activeHoursEnd INTEGER             -- Hour of day (0-23) when heartbeats stop
  activeTimezone TEXT DEFAULT 'UTC'  -- Timezone for active hours windowing
  suppressionCount INTEGER DEFAULT 0 -- Number of consecutive suppressed (no-action) runs
  lastActionAt INTEGER              -- Timestamp of last run that produced action (not suppressed)
```

Add bootstrap DDL to `src/lib/db/bootstrap.ts` for the new columns (ALTER TABLE IF NOT EXISTS pattern).

### Heartbeat Checklist Format

Each checklist item is a natural-language instruction the agent evaluates:

```json
[
  {"id": "inbox", "instruction": "Check if there are unread customer inquiries older than 2 hours", "priority": "high"},
  {"id": "revenue", "instruction": "Check if daily revenue is below the 7-day average by more than 20%", "priority": "medium"},
  {"id": "content", "instruction": "Check if any scheduled content is overdue for publication", "priority": "low"}
]
```

The agent receives the checklist as part of its system prompt and returns a structured response:

```json
{
  "action_needed": true|false,
  "items": [
    {"id": "inbox", "status": "action_needed", "summary": "3 unread inquiries from 4+ hours ago"},
    {"id": "revenue", "status": "ok", "summary": "Revenue tracking normally"},
    {"id": "content", "status": "action_needed", "summary": "Blog post 'AI for SMBs' overdue by 1 day"}
  ]
}
```

### Heartbeat Engine

Extend the existing scheduler engine in `src/lib/schedules/scheduler.ts`:

1. **Poll loop modification**: The existing 60-second poll loop checks `nextFireAt`. For heartbeat-type schedules, add active-hours check before firing.
2. **Active hours windowing**: If current time is outside `activeHoursStart`-`activeHoursEnd` in `activeTimezone`, skip the heartbeat (do not fire). Calculate next fire time as the start of the next active window.
3. **Heartbeat execution flow**:
   - Build system prompt with heartbeat checklist items
   - Execute agent with the assigned profile (uses existing `executeTask` flow)
   - Parse structured response for `action_needed` flag
   - If `action_needed: false` → increment `suppressionCount`, log suppression, skip task creation
   - If `action_needed: true` → reset `suppressionCount`, update `lastActionAt`, create child task with the agent's recommended actions
4. **Cost controls**: Heartbeat runs go through the same cost metering and budget guardrails as regular runs. Add a `heartbeatBudgetPerDay` field on the schedule that caps total heartbeat spend per 24-hour period. If budget exhausted, pause heartbeats until next day.
5. **Governance integration**: Heartbeat-triggered actions flow through the same `canUseTool` gate and risk tiers as user-triggered runs. High-risk actions from heartbeats require inbox approval before execution.

### Heartbeat Task Cards

Surface heartbeat activity on the Kanban board:
- Heartbeat-triggered tasks get a "heartbeat" badge (distinct from manually-created or scheduled tasks)
- Suppressed heartbeats appear in the monitoring dashboard as "Heartbeat OK" entries (low-noise)
- The schedule detail view shows heartbeat history: action count, suppression count, last action time

### API Surface

Extend existing schedule API routes:
- `POST /api/schedules` — Accept `type: "heartbeat"` with heartbeat-specific fields
- `GET /api/schedules/[id]` — Return heartbeat metadata (checklist, active hours, suppression stats)
- `PATCH /api/schedules/[id]` — Update heartbeat checklist, active hours, budget
- `GET /api/schedules/[id]/heartbeat-history` — NEW: Return recent heartbeat evaluations (action/suppressed)

### UI Changes

Extend the existing schedule creation form (`src/components/schedules/`):
- Add "Heartbeat" option alongside "Interval" and "One-shot" in the schedule type selector
- When heartbeat selected: show checklist editor (add/remove/reorder items), active hours picker (time range + timezone), daily budget input
- Schedule detail view: heartbeat history timeline showing action vs. suppression pattern

### Notification Delivery

Heartbeat results that require attention are delivered to:
1. ainative's notification inbox (existing) — always
2. Multi-channel delivery targets (Slack, Telegram) — when `multi-channel-delivery` feature ships

## Acceptance Criteria

- [ ] `type: "heartbeat"` schedules can be created via API and UI
- [ ] Heartbeat checklist editor allows adding, removing, and reordering checklist items
- [ ] Active hours windowing correctly skips heartbeats outside configured hours
- [ ] Suppression logic: heartbeats with `action_needed: false` do NOT create child tasks
- [ ] Action heartbeats: `action_needed: true` creates a child task with the agent's recommended actions
- [ ] `suppressionCount` increments on each no-action heartbeat, resets on action
- [ ] `heartbeatBudgetPerDay` caps daily heartbeat spend; pauses heartbeats when exhausted
- [ ] Heartbeat-triggered tasks display "heartbeat" badge on Kanban board
- [ ] Monitoring dashboard shows heartbeat OK entries for suppressed runs
- [ ] Schedule detail view displays heartbeat history (action/suppression timeline)
- [ ] Heartbeat actions go through canUseTool governance (high-risk actions require approval)
- [ ] Existing scheduled-prompt-loops functionality is not affected (type: "scheduled" works as before)

## Scope Boundaries

**Included:**
- Heartbeat schedule type with checklist, active hours, suppression logic
- Schema changes to schedules table
- Heartbeat engine in scheduler.ts
- Heartbeat-specific API endpoints
- UI for creating and viewing heartbeat schedules
- Cost controls (daily budget cap)
- Kanban board heartbeat badges

**Excluded:**
- Natural-language checklist parsing (separate feature: `natural-language-scheduling`)
- HEARTBEAT.md file support (separate feature: `natural-language-scheduling`)
- Multi-channel delivery of heartbeat results (separate feature: `multi-channel-delivery`)
- Heartbeat-to-heartbeat agent coordination (separate feature: `agent-async-handoffs`)
- Custom heartbeat evaluation models (always uses the profile's assigned runtime/model)

## References

- Source: `ideas/vision/ainative-OpenClaw-Companion-Research-Report.md` — Section 3.2 (Heartbeat Scheduler for Proactive Agent Execution)
- Existing scheduler: `src/lib/schedules/scheduler.ts` (poll loop, fire logic)
- Existing scheduler UI: `src/components/schedules/` (4 components)
- Schedule DB table: `src/lib/db/schema.ts` (schedules definition)
- Scheduler startup: `src/instrumentation.ts` (Next.js register hook)
- Related features: natural-language-scheduling (layers NLP parsing on top), multi-channel-delivery (delivers heartbeat results), agent-async-handoffs (enables heartbeat-driven agents to coordinate)
