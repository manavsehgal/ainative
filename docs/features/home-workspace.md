---
title: "Home Workspace"
category: "feature-reference"
section: "home-workspace"
route: "/"
tags: [dashboard, home, workspace, navigation, sidebar, trust-tier]
features: ["homepage-dashboard", "app-shell"]
screengrabCount: 2
lastUpdated: "2026-03-21"
---

# Home Workspace

The Home Workspace is your command center when you open Stagent. It provides a real-time overview of agent activity, business tasks, and items that need your attention — so you can triage your AI-powered operations at a glance. The persistent sidebar organizes all areas into three logical groups for quick navigation.

## Screenshots

![Home workspace list view](../screengrabs/home-list.png)
*Home workspace showing greeting, stat cards, needs attention section, and recent activity*

![Home workspace below the fold](../screengrabs/home-below-fold.png)
*Scrolled view showing additional recent activity and workspace context*

## Key Features

### At-a-Glance Stat Cards
Five stat cards at the top of the home page give you an instant pulse on your workspace: tasks currently running, tasks completed today, tasks awaiting your review, active projects, and active workflows. Each card updates in real time as agents execute work.

### Needs Attention Section
Items requiring human action — such as permission requests, failed tasks, or stalled workflows — surface here automatically. This ensures nothing slips through the cracks when agents need your input.

### Recent Activity Feed
A chronological feed of the latest events across your workspace: task completions, agent messages, workflow transitions, and document uploads. Gives you context on what happened while you were away.

### Sidebar Navigation
The sidebar organizes Stagent into three groups:
- **Work** — Dashboard, Inbox, Projects, Workflows, Documents
- **Manage** — Monitor, Profiles, Schedules, Cost & Usage
- **Configure** — Playbook, Settings

### Trust Tier Badge
A badge in the sidebar footer displays your current trust tier (e.g., Supervised, Semi-Autonomous, Autonomous). This controls the default permission level for agent tool usage across the workspace.

## How To

### Check What Needs Your Attention
1. Open Stagent — the home workspace loads by default at `/`.
2. Scan the stat cards for any tasks awaiting review.
3. Scroll to the "Needs Attention" section for actionable items.
4. Click any item to navigate directly to the relevant detail view.

### Navigate to a Workspace Area
1. Use the sidebar on the left to find the area you need.
2. Work items (Dashboard, Inbox, Projects, Workflows, Documents) are in the top group.
3. Management tools (Monitor, Profiles, Schedules, Cost & Usage) are in the middle group.
4. Configuration (Playbook, Settings) is at the bottom.

### Check Your Trust Tier
1. Look at the sidebar footer for the trust tier badge.
2. Click the badge to see a popover with details about your current permission level.
3. To change the trust tier, navigate to Settings.

## Related
- [Dashboard Kanban](./dashboard-kanban.md)
- [Inbox Notifications](./inbox-notifications.md)
- [Settings](./settings.md)
