---
title: Task Hierarchy Clarity
status: completed
priority: P1
milestone: post-mvp
source: kitchen-sink-03-23.md
dependencies:
  - workflow-engine
  - task-board
  - project-management
---

# Task Hierarchy Clarity

## Description

Tasks in Stagent have a nullable `workflowId` foreign key — they can exist independently (standalone tasks) or as children of a workflow. Currently, the project detail page queries all tasks by `projectId` without distinguishing between these two categories. Workflow-created tasks (which get `projectId` set in `engine.ts:745`) appear alongside standalone tasks, creating visual ambiguity and potential double-counting in status summaries.

Users see the same task listed in the project detail view and the workflow detail view without any visual distinction. There's no clear indication of which tasks are workflow-bound vs standalone, and status counts can be misleading when a multi-step workflow inflates the "in progress" count.

This feature introduces clear visual separation between standalone and workflow-bound tasks in the project detail view, with cross-linking and deduplicated status counts.

## User Stories

As a project owner, I want to see standalone tasks separately from workflow-generated tasks, so I can quickly assess what needs manual attention vs what's being handled by automated workflows.

As a user viewing a project, I want status counts that reflect actual work items, not inflated by multi-step workflow subtasks that I don't manage individually.

## Technical Approach

### Recommended: Option C — Keep Separate but Link Clearly

Minimal disruption to current page structure. Both project detail and workflow detail retain their pages, but with clear visual hierarchy and cross-linking.

### 1. Project Detail Task Sectioning

Modify the task query in `src/app/projects/[id]/page.tsx` to left-join workflows for grouping:

```sql
SELECT tasks.*, workflows.name AS workflowName
FROM tasks
LEFT JOIN workflows ON tasks.workflowId = workflows.id
WHERE tasks.projectId = ?
ORDER BY tasks.workflowId NULLS FIRST, tasks.priority, tasks.createdAt
```

Render two sections in project detail:

**Section A: "Standalone Tasks"** — tasks where `workflowId IS NULL`
- Standard task list with full controls (edit, execute, delete)
- This is the user's primary task management surface

**Section B: "Workflow Tasks"** — tasks grouped by workflow
- Collapsible groups, each headed by workflow name + status badge
- Each group shows child tasks with reduced controls (view only — managed by workflow)
- Group header links to workflow detail page
- Collapsed by default if workflow is completed

### 2. Workflow Badge on Tasks

When a task appears in any list with a non-null `workflowId`:
- Show a small "Workflow: [name]" chip/badge next to the task title
- Chip is clickable — navigates to the workflow detail page
- Use existing `StatusChip` component with a neutral variant

### 3. Deduplicated Status Counts

The project status summary (task count breakdown by status) should:
- Default to counting standalone tasks only in the headline metrics
- Show workflow task counts separately: "12 standalone tasks · 8 workflow tasks across 3 workflows"
- Optional toggle to include/exclude workflow tasks from the count
- Prevents a 20-step workflow from making it look like the project has 20 "in progress" items

### 4. Cross-Linking

- **Project → Workflow**: Workflow group headers in project detail link to workflow detail page
- **Workflow → Project**: Workflow detail page shows project name with link back
- **Task → Workflow**: Task detail sheet shows "Part of workflow: [name]" when `workflowId` is set, with link
- **Task → Project**: Already exists via project breadcrumb

### Data Model

No schema changes needed. The nullable `workflowId` FK on `tasks` already supports the standalone/workflow-bound distinction:

```
tasks.workflowId IS NULL     → standalone task
tasks.workflowId IS NOT NULL → workflow-bound task
```

Index `idx_tasks_workflow_id` already exists for efficient grouping.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/projects/[id]/page.tsx` | Task query with workflow join + sectioned rendering |
| `src/components/projects/project-detail.tsx` | Two-section layout (standalone vs workflow tasks) |
| `src/components/tasks/task-card.tsx` | Add workflow badge when `workflowId` is set |
| `src/components/tasks/task-detail-sheet.tsx` | Show "Part of workflow" link in detail view |
| `src/lib/db/schema.ts` | Reference — `workflowId` nullable FK, existing index |
| `src/lib/workflows/engine.ts` | Reference — `executeChildTask()` at line 743 sets `projectId` on workflow tasks |
| `src/app/workflows/[id]/page.tsx` | Add project back-link |

## Acceptance Criteria

- [ ] Project detail shows "Standalone Tasks" section (workflowId IS NULL) separately from "Workflow Tasks"
- [ ] Workflow tasks grouped by workflow name with collapsible headers
- [ ] Workflow group header shows workflow name, status badge, and link to workflow detail
- [ ] Completed workflow groups collapsed by default
- [ ] Tasks with workflowId show a "Workflow: [name]" badge that links to workflow detail
- [ ] Project status counts separate standalone vs workflow tasks
- [ ] No task appears duplicated in any single view
- [ ] Task detail sheet shows "Part of workflow: [name]" with link when applicable
- [ ] Workflow detail page shows project name with back-link
- [ ] Query uses existing `idx_tasks_workflow_id` index for efficient grouping

## Scope Boundaries

**Included:**
- Visual sectioning of standalone vs workflow-bound tasks
- Workflow name badges on tasks
- Collapsible workflow groups in project detail
- Deduplicated status counts
- Cross-linking between project, workflow, and task views

**Excluded:**
- Resume/retry controls (already implemented in loop-status-view, swarm-dashboard, workflow-status-view)
- Task reassignment between workflows
- Moving standalone tasks into a workflow
- Workflow nesting (workflows containing workflows)
- Cascade delete behavior changes (FK constraints unchanged)
- Drag-and-drop task reordering within sections

## References

- Source: `kitchen-sink-03-23.md` — Issue #3 (Workflow Resume/Retry Visibility & Task Hierarchy Clarity)
- Architecture: Option C selected from kitchen-sink brainstorm (Keep Separate but Link Clearly)
- Related: `workflow-engine` — child task creation pattern in `executeChildTask()`
- Related: `workflow-ux-overhaul` — complementary workflow UI improvements (output readability, dashboard visibility)
- Related: `task-board` — task listing and filtering patterns
- Flag for `/frontend-designer` review: task sectioning layout and collapsible group UX
