---
title: Kanban Task Board
status: completed
priority: P1
milestone: mvp
source: ideas/mvp-vision.md
dependencies: [database-schema, app-shell, project-management]
---

# Kanban Task Board

## Description

The primary interface of ainative. A kanban board where tasks move through columns representing agent execution states: Planned → Queued → Running → Completed / Failed. Each task card shows the assigned agent, progress indicators, and quick actions (cancel, retry).

This maps directly to the universal workflow primitive: Work Unit → State Machine → Transitions → Ownership → Observability. The board is the user's main way of seeing what their AI agents are doing.

The kanban board is the `/dashboard` view — the default landing page of the application.

## User Story

As a user, I want to see all my tasks on a kanban board organized by execution state, so that I can track what my AI agents are working on, what's queued, and what's completed.

## Technical Approach

- **Board layout**: Column-based layout with Planned, Queued, Running, Completed, Failed columns
- **Task cards**: Show title, assigned agent badge, priority indicator, timestamp, and quick action buttons
- **Drag and drop**: Users can manually move tasks between Planned and Queued (other transitions are agent-driven)
- **Task creation**: Inline "Add task" button at the bottom of the Planned column, opens a create dialog
- **Task detail**: Click a card to expand a side panel or dialog showing full description, agent assignment, logs preview
- **Filtering**: Filter by project, agent, priority
- **Real-time updates**: When agents are running, card status updates automatically (polling or SSE)

### API Routes

- `GET /api/tasks` — list tasks with optional filters (projectId, status, agent)
- `POST /api/tasks` — create a new task
- `PATCH /api/tasks/[id]` — update task fields (status, assignment, priority)
- `DELETE /api/tasks/[id]` — delete a task

### Components

- `KanbanBoard` — renders columns and manages drag state
- `KanbanColumn` — single column with header (count badge) and card list
- `TaskCard` — compact card with title, agent badge, priority, actions
- `TaskCreateDialog` — form with title, description, project selection, priority
- `TaskDetailPanel` — expanded view with full details and action buttons

### State Machine Transitions

| From | To | Triggered By |
|------|----|-------------|
| planned | queued | User clicks "Queue" or drags to Queued column |
| queued | running | Agent picks up the task |
| running | completed | Agent finishes successfully |
| running | failed | Agent encounters an error |
| any | cancelled | User clicks "Cancel" |
| failed | queued | User clicks "Retry" |

### UX Considerations

- Flag for `/frontend-designer` review: kanban drag-and-drop interaction, card information density, responsive column layout, and status color coding need design input

## Acceptance Criteria

- [ ] Dashboard shows a kanban board with 5 columns (Planned, Queued, Running, Completed, Failed)
- [ ] Users can create tasks with title, description, project, and priority
- [ ] Task cards display title, assigned agent, priority, and creation time
- [ ] Users can drag tasks from Planned to Queued
- [ ] Task detail panel shows full information when a card is clicked
- [ ] Users can cancel a task from any state
- [ ] Users can retry a failed task (moves to Queued)
- [ ] Board filters by project and status
- [ ] Column headers show task count badges
- [ ] API routes handle all CRUD operations with proper validation

## Scope Boundaries

**Included:**
- Kanban board with 5 columns
- Task CRUD operations
- Manual drag between Planned and Queued
- Task detail panel
- Filtering by project
- Status transitions (user-initiated only — agent-initiated transitions are in `agent-integration`)

**Excluded:**
- Agent execution (see `agent-integration` — this feature only manages the board UI)
- AI-guided task creation (see `task-definition-ai`)
- Workflow-level task orchestration (see `workflow-engine`)
- Real-time agent streaming into cards (see `monitoring-dashboard`)

## References

- Source: `ideas/mvp-vision.md` — Kanban Board (Primary View) section
- Source: `ideas/task-workflows.md` — Kanban pattern, state machine model
- Related features: `agent-integration` (triggers status transitions), `project-management` (tasks belong to projects)
