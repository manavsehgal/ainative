---
title: "Monitoring"
category: "feature-reference"
section: "monitoring"
route: "/monitor"
tags: [monitoring, agent-logs, activity, real-time, execution]
features: ["monitoring-dashboard"]
screengrabCount: 1
lastUpdated: "2026-03-21"
---

# Monitoring

Real-time agent activity monitoring for all running tasks in your workspace. The monitoring dashboard provides a live view of agent logs with timestamps, task associations, and status indicators, giving you full visibility into what your agents are doing at any moment.

## Screenshots

![Monitoring dashboard showing agent activity logs](../screengrabs/monitor-list.png)
*The monitoring dashboard displays a chronological feed of agent activity with status indicators and task associations.*

## Key Features

### Real-Time Activity Feed
The monitoring dashboard streams agent log entries as they happen. Each log entry includes a timestamp, the associated task name, the agent profile performing the work, and a status indicator showing whether the operation succeeded, failed, or is still in progress.

### Task Association Tracking
Every log entry is linked to its parent task, making it easy to trace agent activity back to the work item that triggered it. Click any task reference to jump directly to the task detail view.

### Status Indicators
Visual status badges distinguish between different activity states: running operations appear with an active indicator, completed work shows a success badge, and errors are highlighted with a destructive badge for immediate visibility.

### Execution Progress Monitoring
Track the progress of long-running agent executions across all active tasks. The dashboard aggregates activity from every running agent, providing a single pane of glass for workspace-wide oversight.

### Error Detection
Failed operations and agent errors surface prominently in the activity feed. Error entries include the error message and context, enabling quick diagnosis without needing to dig into individual task logs.

## How To

### Monitor Active Agents
1. Navigate to `/monitor` from the sidebar under the **Manage** group.
2. The activity feed loads automatically with the most recent log entries.
3. New entries appear at the top of the feed in real time as agents execute tasks.

### Investigate an Error
1. Look for log entries with a destructive (red) status badge in the activity feed.
2. Read the error message displayed in the log entry detail.
3. Click the associated task name to navigate to the full task detail view.
4. Review the complete execution log for additional context.

### Filter by Task
1. Open the monitoring dashboard at `/monitor`.
2. Use the task association links to identify activity related to a specific task.
3. Click through to the task detail page for the complete execution history of that task.

## Related
- [Dashboard & Kanban](./dashboard-kanban.md)
- [Cost & Usage](./cost-usage.md)
- [Inbox & Notifications](./inbox-notifications.md)
