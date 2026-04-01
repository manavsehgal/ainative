---
title: "Dashboard Kanban"
category: "feature-reference"
section: "dashboard-kanban"
route: "/dashboard"
tags: [tasks, kanban, board, table, filter, create, ai-assist, drag-and-drop, bulk-operations, heartbeat]
features: ["task-board", "kanban-board-operations", "micro-visualizations", "task-definition-ai", "detail-view-redesign", "ui-density-refinement", "heartbeat-scheduler"]
screengrabCount: 5
lastUpdated: "2026-03-31"
---

# Dashboard Kanban

The Dashboard is your primary task management surface. It presents all tasks as a Kanban board with drag-and-drop columns, or as a sortable table -- whichever fits your workflow. A powerful filter bar, AI-assisted task creation, bulk operations, and inline editing let you manage agent work without switching context.

## Screenshots

![Dashboard board view](../screengrabs/dashboard-list.png)
*Kanban board with columns for Planned, Queued, Running, Completed, and Failed tasks*

![Dashboard table view](../screengrabs/dashboard-table.png)
*Table view with sortable columns for title, status, priority, project, and timestamps*

![Task detail sheet](../screengrabs/dashboard-card-detail.png)
*Task detail sheet showing task properties, description, and execution history*

![Task edit dialog](../screengrabs/dashboard-card-edit.png)
*Task edit dialog for updating task details from the kanban board*

![Bulk select mode](../screengrabs/dashboard-bulk-select.png)
*Kanban board in select mode with checked cards and bulk action toolbar*

## Key Features

### Kanban Board
Tasks are organized into five columns -- Planned, Queued, Running, Completed, and Failed. Each column shows a count of its tasks. Cards display the task title, priority badge, agent profile, and quick-action buttons for editing and deleting. Heartbeat-generated tasks show a heartbeat badge to distinguish them from manually created work.

### Drag-and-Drop Reordering
Drag task cards between columns to change their status, or within a column to reorder priority. The board updates the database in real time as you drop cards.

### Board and Table Toggle
Switch between the visual Kanban board and a dense table view using the toggle in the toolbar. The table view provides sortable columns for title, status, priority, project, and timestamps -- ideal for bulk review.

### Filter Bar
Combobox filters for project, status, and priority let you narrow the board or table to exactly the tasks you care about. Filters persist across view toggles.

### AI-Assisted Task Creation
The task creation form includes fields for title, description, project, priority, runtime, and agent profile. The AI Assist button analyzes your title and description, then enhances them with structured context, acceptance criteria, and suggested parameters.

### Task Detail View
Click any task card to open a detail panel with the full description, execution logs, status history, and action buttons. Edit the task inline or trigger execution directly from the detail view.

### Bulk Select Mode
Enter select mode to check multiple task cards across any column. A toolbar appears with bulk actions: queue selected tasks for execution, move them to a different status, or delete tasks that are no longer needed. This is essential when autonomous workflows or heartbeat schedules generate many tasks overnight.

### Heartbeat Badges
Tasks created by heartbeat schedules display a heartbeat badge on their kanban card. This visual indicator distinguishes proactively generated work from tasks you created manually, making it easy to audit what your scheduled agents produced.

## How To

### Create a New Task
1. Click the "New Task" button in the dashboard toolbar, or navigate to `/tasks/new`.
2. Enter a title and description for the task.
3. Optionally select a project, priority level, runtime, and agent profile.
4. Click the "AI Assist" button to enhance your description with structured context.
5. Click "Create Task" to add it to the Planned column.

### Move a Task Between Statuses
1. In the board view, click and hold a task card.
2. Drag it to the target column (e.g., from Planned to Queued).
3. Release to drop -- the status updates immediately.

### Filter Tasks
1. Use the filter bar at the top of the dashboard.
2. Select a project, status, or priority from the combobox dropdowns.
3. The board or table updates instantly to show matching tasks.
4. Clear filters by clicking the reset button.

### Bulk-Manage Tasks
1. Click the "Select" button in the toolbar to enter bulk select mode.
2. Check the boxes on multiple task cards.
3. Use the bulk action toolbar to queue, move, or delete selected tasks.
4. Confirm the action and exit select mode.

## Related
- [Home Workspace](./home-workspace.md)
- [Projects](./projects.md)
- [Workflows](./workflows.md)
- [Profiles](./profiles.md)
- [Schedules](./schedules.md)
