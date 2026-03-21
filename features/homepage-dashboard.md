---
title: Homepage Dashboard
priority: P1
status: completed
dependencies:
  - database-schema
  - app-shell
  - project-management
  - task-board
  - agent-integration
  - inbox-notifications
  - monitoring-dashboard
---

# Homepage Dashboard

## Overview

Replace the current `/` redirect-to-dashboard with a proper landing page that surfaces key metrics, priority tasks, recent activity, and quick actions in a single view.

## Wireframe

See `wireframes/homepage-wireframe.html` for the full low-fidelity layout.

## Zones

### Zone A — Contextual Greeting
- Time-based salutation ("Good morning/afternoon/evening")
- One-line summary: running tasks, awaiting review, failed tasks (live DB counts)

### Zone B — Stats Row (4 cards)
- **Tasks Running** — count of `status = 'running'`, delta vs yesterday
- **Completed Today** — count since midnight, all-time total
- **Awaiting Review** — unread notifications with `type = 'permission_required'` or `type = 'agent_message'`
- **Active Projects** — count of `status = 'active'` projects

Each card is clickable → navigates to the relevant page (Monitor, Dashboard, Inbox, Projects).

### Zone C — Two-Column Layout
- **Left: Priority Queue** — Top 5 tasks needing attention (failed + awaiting human-loop + running), sorted by priority. Each row: status icon, title, project name, status badge, priority indicator. "View all tasks" link → `/dashboard`.
- **Right: Live Activity Feed** — Last 6 agent_logs entries, newest first. Timestamp + event type + truncated message. "Open monitor" link → `/monitor`.

### Zone D — Quick Actions (4 cards)
- New Task → opens TaskCreateDialog
- New Project → opens ProjectCreateDialog
- Open Inbox → navigates to `/inbox`
- Open Monitor → navigates to `/monitor`

### Zone E — Recent Projects (3 cards)
- 3 most-recently-updated active projects
- Each card: project name, progress bar (completed tasks / total tasks), task count
- "View all" link → `/projects`

## Key Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Server component — queries DB, renders homepage |
| `src/components/dashboard/stats-cards.tsx` | Zone B — 4 stat cards (client component for click navigation) |
| `src/components/dashboard/priority-queue.tsx` | Zone C left — priority task list |
| `src/components/dashboard/activity-feed.tsx` | Zone C right — recent agent logs |
| `src/components/dashboard/quick-actions.tsx` | Zone D — 4 action cards |
| `src/components/dashboard/recent-projects.tsx` | Zone E — 3 project cards with progress |
| `src/components/dashboard/greeting.tsx` | Zone A — time-based greeting |

## Acceptance Criteria

- [ ] `/` renders the homepage (no redirect to `/dashboard`)
- [ ] Greeting changes based on time of day (morning/afternoon/evening)
- [ ] Summary line shows live counts from database
- [ ] 4 stat cards show correct counts from DB
- [ ] Stat cards navigate to correct pages on click
- [ ] Priority queue shows up to 5 tasks needing attention
- [ ] Activity feed shows last 6 agent log entries
- [ ] Quick action cards trigger correct dialogs/navigation
- [ ] Recent projects show 3 most-recently-updated with progress bars
- [ ] "Home" appears as active nav item in sidebar
- [ ] Page is a Server Component (no unnecessary client-side fetching)
- [x] RecentProjects shows empty state CTA instead of returning null (I9)
- [x] Status badge colors use shared `status-colors.ts` constants (M1)
