---
title: Inbox & Notifications
status: completed
priority: P1
milestone: mvp
source: ideas/mvp-vision.md
dependencies: [database-schema, app-shell, agent-integration]
---

# Inbox & Notifications

## Description

The agent-to-human communication hub, styled like an email inbox. This is where users see permission requests, task completions, failures, and agent messages. It provides the human-in-the-loop interface that makes ainative a supervisor tool rather than a fire-and-forget launcher.

The inbox surfaces four types of notifications from the Agent SDK integration: permission requests (from `canUseTool`), task completions (with output summaries), task failures (with error context and retry options), and agent messages/questions (from `AskUserQuestion`).

The familiar email inbox UX pattern reduces friction — users already know how to scan, triage, and respond to inbox items.

## User Story

As a user, I want to see all agent communications in a familiar inbox so that I can quickly review permission requests, approve or deny them, and track task completions and failures.

## Technical Approach

- **View**: `/inbox` route with a list view (email-style) showing notifications sorted by time
- **Notification types**:
  - `permission_required` — agent needs approval for a tool call (actionable: Allow/Deny buttons)
  - `task_completed` — agent finished a task (informational: view result)
  - `task_failed` — agent encountered an error (actionable: Retry button)
  - `agent_message` — agent has a question or status update (actionable: text response)
- **Read/unread**: Notifications have a `read` boolean, unread count shown in sidebar badge
- **Actions**: Each notification type has specific action buttons inline
- **Real-time**: New notifications appear without page refresh (polling or SSE)

### API Routes

- `GET /api/notifications` — list notifications with filters (unread, type)
- `PATCH /api/notifications/[id]` — mark as read/unread
- `PATCH /api/notifications/mark-all-read` — bulk mark as read
- `DELETE /api/notifications/[id]` — dismiss a notification

### Components

- `InboxList` — scrollable list of notification items, sorted by newest first
- `NotificationItem` — renders differently per type (permission vs. completion vs. failure vs. message)
- `PermissionAction` — Allow/Deny buttons that call `POST /api/tasks/[id]/respond`
- `FailureAction` — Retry button that re-queues the task
- `MessageResponse` — text input for responding to agent questions
- `UnreadBadge` — count badge in the sidebar navigation

### UX Considerations

- Flag for `/frontend-designer` review: notification item layout, action button placement, empty state, and notification grouping need design input

## Acceptance Criteria

- [ ] Inbox page shows all notifications sorted by newest first
- [ ] Permission request notifications have Allow and Deny action buttons
- [ ] Clicking Allow/Deny sends the response to the agent and updates the notification
- [ ] Task completion notifications show a summary and link to the task result
- [ ] Task failure notifications show error context and a Retry button
- [ ] Agent message notifications allow text responses
- [ ] Unread notification count appears as a badge on the Inbox nav link
- [ ] Users can mark notifications as read (individually and bulk)
- [ ] New notifications appear without manual page refresh

## Scope Boundaries

**Included:**
- Inbox list view at `/inbox`
- Four notification types with type-specific rendering and actions
- Read/unread state management
- Unread count badge in sidebar
- Action buttons (Allow/Deny, Retry, Respond)
- API routes for notification management

**Excluded:**
- Creating notifications (that's in `agent-integration` — this feature only displays them)
- Email or push notification delivery (browser-only for MVP)
- Notification preferences or filtering rules
- Grouping notifications by task or project

## References

- Source: `ideas/mvp-vision.md` — Inbox / Notifications section
- Source: `ideas/mvp-vision.md` — Human-in-the-Loop (Native) section
- Related features: `agent-integration` (creates notifications), `task-board` (links from notifications to tasks)
