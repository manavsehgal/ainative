---
title: "Dashboard Kanban"
category: "feature-reference"
section: "dashboard-kanban"
route: "/dashboard"
tags: [tasks, kanban, board, table, filter, create, ai-assist, drag-and-drop]
features: ["task-board", "kanban-board-operations", "micro-visualizations", "task-definition-ai", "detail-view-redesign", "ui-density-refinement"]
screengrabCount: 6
lastUpdated: "2026-03-21"
---

# Dashboard Kanban

The Dashboard is your primary task management surface. It presents all tasks as a Kanban board with drag-and-drop columns, or as a sortable table — whichever fits your workflow. A powerful filter bar, AI-assisted task creation, and inline editing let you manage agent work without switching context.

## Screenshots

![Dashboard board view](../screengrabs/dashboard-list.png)
*Kanban board with columns for Planned, Queued, Running, Completed, and Failed tasks*

![Dashboard table view](../screengrabs/dashboard-table.png)
*Table view with sortable columns for title, status, priority, project, and timestamps*

![Dashboard filtered view](../screengrabs/dashboard-filtered.png)
*Filter bar narrowing tasks by project, status, or priority*

![Task detail view](../screengrabs/dashboard-detail.png)
*Task detail panel showing full description, status history, and agent logs*

![Create task form empty](../screengrabs/dashboard-create-form-empty.png)
*Empty task creation form at /tasks/new with all available fields*

![Create task form filled](../screengrabs/dashboard-create-form-filled.png)
*Filled task creation form with AI Assist enhanced description*

## Key Features

### Kanban Board
Tasks are organized into five columns — Planned, Queued, Running, Completed, and Failed. Each column shows a count of its tasks. Cards display the task title, priority badge, and quick-action buttons for editing and deleting.

### Drag-and-Drop Reordering
Drag task cards between columns to change their status, or within a column to reorder priority. The board updates the database in real time as you drop cards.

### Board and Table Toggle
Switch between the visual Kanban board and a dense table view using the toggle in the toolbar. The table view provides sortable columns for title, status, priority, project, and timestamps — ideal for bulk review.

### Filter Bar
Combobox filters for project, status, and priority let you narrow the board or table to exactly the tasks you care about. Filters persist across view toggles.

### AI-Assisted Task Creation
The task creation form at `/tasks/new` includes fields for title, description, project, priority, runtime, and agent profile. The AI Assist button analyzes your title and description, then enhances them with structured context, acceptance criteria, and suggested parameters.

### Task Detail View
Click any task card to open a detail panel with the full description, execution logs, status history, and action buttons. Edit the task inline or trigger execution directly from the detail view.

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
3. Release to drop — the status updates immediately.

### Filter Tasks
1. Use the filter bar at the top of the dashboard.
2. Select a project, status, or priority from the combobox dropdowns.
3. The board or table updates instantly to show matching tasks.
4. Clear filters by clicking the reset button.

### Edit a Task
1. Click the edit icon on any task card, or open the task detail view.
2. Modify the title, description, priority, or other fields.
3. Save changes — the card updates across all views.

## Related
- [Home Workspace](./home-workspace.md)
- [Projects](./projects.md)
- [Workflows](./workflows.md)
- [Profiles](./profiles.md)
