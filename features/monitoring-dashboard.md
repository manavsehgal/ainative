---
title: Agent Monitoring Dashboard
status: completed
priority: P1
milestone: mvp
source: ideas/mvp-vision.md
dependencies: [database-schema, app-shell, agent-integration]
---

# Agent Monitoring Dashboard

## Description

Real-time visibility into agent activity at `/monitor`. Shows active agent count, current task assignments, streaming logs from running agents, and a recent activity timeline. This is the transparency layer — following the "Building Effective Agents" principle of showing planning steps to the user.

The dashboard streams agent reasoning and tool calls in real time using Server-Sent Events (SSE) backed by the agent_logs table. Users can see exactly what an agent is doing without waiting for task completion.

## User Story

As a user, I want to see real-time activity from my running agents so that I can understand what they're doing, catch issues early, and build trust in agent execution.

## Technical Approach

- **View**: `/monitor` route with two sections: overview panel and log stream
- **Overview panel**: Active agent count, tasks by status (running/queued/completed today), resource summary
- **Log stream**: Real-time feed of agent events from `agent_logs` table, auto-scrolling
- **Log filtering**: Filter by task, agent, event type (started, output, error, completed)
- **Task drill-down**: Click a log entry to jump to the associated task

### Streaming Architecture

- `GET /api/logs/stream` — SSE endpoint that streams new agent_logs entries
- Agent SDK's `includePartialMessages` feeds partial outputs into agent_logs
- Frontend uses `EventSource` to subscribe to the SSE stream
- Events include: tool calls (what tool, what args), agent reasoning (partial text), errors, completions

### Components

- `MonitorOverview` — summary cards (active agents, tasks today, success rate)
- `LogStream` — auto-scrolling log feed with colored event types
- `LogEntry` — single log line: timestamp, task name, event type, payload preview
- `LogFilter` — filter controls for task, agent type, event type

### Data Sources

- `agent_logs` table for historical and streaming logs
- `tasks` table for aggregate counts and status

### UX Considerations

- Flag for `/frontend-designer` review: log stream readability, information density, color coding for event types, and auto-scroll behavior need design input

## Acceptance Criteria

- [ ] Monitor page shows overview with active agent count and task status summary
- [ ] Log stream displays agent events in real-time (auto-scrolling)
- [ ] Each log entry shows timestamp, associated task, event type, and payload preview
- [ ] Users can filter logs by task and event type
- [ ] Clicking a log entry navigates to the associated task
- [ ] SSE endpoint streams new log entries as they're created
- [ ] Log stream gracefully handles connection drops (auto-reconnect)
- [ ] Overview counts update in real-time

## Scope Boundaries

**Included:**
- Monitor view at `/monitor`
- Overview panel with aggregate metrics
- Real-time log stream via SSE
- Log filtering by task and event type
- API route for SSE streaming

**Excluded:**
- Agent log creation (that's in `agent-integration`)
- Resource usage metrics (CPU, memory — not available from Agent SDK)
- Log persistence or export
- Historical analytics or charts

## References

- Source: `ideas/mvp-vision.md` — Monitoring Dashboard section
- Source: `ideas/mvp-vision.md` — Building Effective Agents Principles (Transparency)
- Related features: `agent-integration` (writes logs), `task-board` (links from logs to tasks)
