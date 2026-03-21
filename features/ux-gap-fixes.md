---
title: UX Gap Fixes
priority: P1
status: completed
dependencies:
  - task-board
  - inbox-notifications
  - monitoring-dashboard
  - project-management
---

# UX Gap Fixes

## Overview

Combined spec for 4 UX gaps identified during the Sprint 4 spec-vs-implementation audit.

## Gap 1: Task Board Status Filter

**Problem**: Kanban board has a project filter but no way to filter by task status.

**Solution**: Add a status filter dropdown alongside the existing project filter.

**Key files**: `src/components/tasks/kanban-board.tsx`

**Acceptance criteria**:
- [ ] Status filter dropdown with options: All, Planned, Queued, Running, Completed, Failed, Cancelled
- [ ] Filtering hides columns with no matching tasks (or dims them)
- [ ] Filter state resets when navigating away and back
- [ ] Works in combination with existing project filter

## Gap 2: Notification Dismiss Action

**Problem**: Notifications can be marked read but not dismissed/deleted.

**Solution**: Add a dismiss (delete) button to notification items and a "Dismiss all read" bulk action.

**Key files**: `src/components/notifications/notification-item.tsx`, `src/components/notifications/inbox-list.tsx`, `src/app/api/notifications/[id]/route.ts`

**Acceptance criteria**:
- [ ] Individual dismiss button (X or trash icon) on each notification
- [ ] Dismiss sends DELETE to `/api/notifications/[id]`
- [ ] "Dismiss all read" bulk action in inbox header
- [ ] Confirmation before bulk dismiss
- [ ] Dismissed notifications are permanently removed from DB

## Gap 3: Monitor Auto-Refresh

**Problem**: Monitor overview metric cards require manual refresh button click.

**Solution**: Add a polling interval that auto-refreshes the overview metrics.

**Key files**: `src/components/monitoring/monitor-overview-wrapper.tsx`, `src/components/monitoring/monitor-overview.tsx`

**Acceptance criteria**:
- [ ] Overview metrics auto-refresh every 30 seconds
- [ ] Visual indicator showing last refresh time or countdown
- [ ] Manual refresh button still works
- [ ] Auto-refresh pauses when tab is not visible (Page Visibility API)

## Gap 4: Project Detail View

**Problem**: No project-specific page showing tasks filtered by that project.

**Solution**: Add a `/projects/[id]` page that shows project details and its tasks.

**Key files**: `src/app/projects/[id]/page.tsx` (new), `src/components/projects/project-detail.tsx` (new)

**Acceptance criteria**:
- [ ] `/projects/[id]` route renders project name, description, status
- [ ] Shows all tasks belonging to this project in a list/table
- [ ] Task status breakdown (count per status)
- [ ] Edit project button (opens existing edit dialog)
- [ ] Back link to `/projects`
- [ ] 404 handling for invalid project IDs

## Gap 5: Non-Functional Cmd+K Shortcut (Design Review I2)

**Problem**: Sidebar footer rendered `⌘K` keyboard shortcut hint with no backing implementation.

**Solution**: Removed the non-functional hint. Post-MVP: implement via `cmdk` (already installed) as a command palette.

**Status**: Hint removed. Command palette implementation deferred to post-MVP.

**Acceptance criteria**:
- [x] Non-functional `⌘K` hint removed from sidebar footer

## Gap 6: Workflow Step Editor Scalability (Design Review I3)

**Problem**: Workflow create dialog uses `max-w-2xl max-h-[80vh]` with 2-row textareas per step. Becomes cramped with 5+ steps.

**Solution**: Post-MVP — full-page editor at `/workflows/new` with vertical step builder and drag-to-reorder.

**Status**: Deferred to post-MVP.

## Gap 7: Keyboard Shortcuts (Design Review M3)

**Problem**: No keyboard shortcuts exist beyond the now-removed Cmd+K hint.

**Solution**: Post-MVP — implement common shortcuts (N for new task, / for search, J/K for navigation) via `cmdk` integration.

**Status**: Deferred to post-MVP.

## Gap 8: Drag-and-Drop Reordering (Design Review M10)

**Problem**: No drag-and-drop for task priority reordering or workflow step reordering.

**Solution**: Post-MVP — add dnd-kit integration for step reordering in workflow editor and task priority reordering.

**Status**: Deferred to post-MVP.
