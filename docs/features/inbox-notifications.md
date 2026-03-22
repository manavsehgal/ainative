---
title: "Inbox & Notifications"
category: "feature-reference"
section: "inbox-notifications"
route: "/inbox"
tags: [inbox, notifications, permissions, approval, human-in-the-loop, toast]
features: ["inbox-notifications", "ambient-approval-toast", "content-handling"]
screengrabCount: 2
lastUpdated: "2026-03-21"
---

# Inbox & Notifications

The Inbox is your notification center for all agent activity that needs awareness or action. Notifications range from informational (task completed, agent message) to actionable (permission required). Rich content rendering and progressive disclosure keep the inbox scannable without hiding important details.

## Screenshots

![Inbox list view](../screengrabs/inbox-list.png)
*Inbox showing notifications grouped by category with unread badges*

![Inbox expanded notification](../screengrabs/inbox-expanded.png)
*Expanded notification revealing additional context via Show More*

## Key Features

### Notification Categories
Notifications are categorized by type: task completed, agent message, and permission required. Each category has a distinct visual indicator so you can scan the inbox quickly and focus on what matters.

### Unread Badges
Unread notifications display a badge count in both the inbox and the sidebar navigation item. Notifications are marked as read when you expand them or take action.

### Progressive Disclosure
Long notifications start collapsed with a summary. Click "Show More" to expand the full content. This keeps the inbox compact while ensuring no detail is lost.

### Rich Content Rendering
Notification bodies render Markdown content using ReactMarkdown with GitHub Flavored Markdown (GFM) support. Agent messages can include code blocks, tables, lists, and links — all rendered inline.

### Human-in-the-Loop Approvals
When an agent requests permission to use a tool, a "Permission Required" notification appears with Approve and Deny buttons. This is the core human-in-the-loop mechanism — you stay in control of what agents can do.

### Ambient Approval Toasts
For quick permission grants, ambient toasts appear at the edge of the screen. You can approve or deny without navigating to the inbox, keeping your workflow uninterrupted.

## How To

### Review Notifications
1. Navigate to `/inbox` or click the Inbox item in the sidebar.
2. Scan the notification list — unread items are visually distinct.
3. Click a notification to expand its details.
4. Click "Show More" for long notifications to see the full content.

### Approve or Deny a Permission Request
1. Look for notifications with the "Permission Required" category.
2. Expand the notification to see what tool the agent wants to use and why.
3. Click "Approve" to grant the permission, or "Deny" to reject it.
4. The agent resumes or halts based on your decision.

### Handle Ambient Toasts
1. When a toast appears at the screen edge, review the permission request summary.
2. Click "Approve" or "Deny" directly on the toast.
3. The toast dismisses automatically after action or timeout.

## Related
- [Home Workspace](./home-workspace.md)
- [Dashboard Kanban](./dashboard-kanban.md)
- [Tool Permissions](./tool-permissions.md)
- [Settings](./settings.md)
