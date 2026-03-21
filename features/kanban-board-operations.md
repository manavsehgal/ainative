---
title: Kanban Board Operations
status: completed
priority: P2
milestone: post-mvp
source: features/task-board.md
dependencies: [task-board, task-definition-ai]
---

# Kanban Board Operations

## Description

Adds an operations layer on top of the MVP kanban board: inline editing and deletion of task cards, column-level selection mode with bulk actions, and card exit animations. These capabilities make the board a productive daily-driver surface rather than just a status display.

## User Story

As a user managing many tasks, I want to edit, delete, and bulk-operate on tasks directly from the kanban board so that I don't have to open individual detail panels for routine changes.

## Acceptance Criteria

- [x] Inline delete with 2-step confirmation (trash → confirm/cancel, 3s auto-revert)
- [x] Task edit dialog for planned/queued tasks (title, description, priority, runtime, profile)
- [x] Profile-runtime compatibility validation in edit dialog
- [x] Column-level selection mode with toggle, select all/none
- [x] Bulk delete with confirmation modal
- [x] Bulk status change (planned→queued, queued→running)
- [x] Ghost card exit animation (500ms opacity+scale+height collapse via sessionStorage)
- [x] Priority-colored strip toolbar on task cards
- [x] Drag disabled during selection mode
- [x] Toast feedback for all operations (success/error/partial failure)
- [x] Optimistic UI with rollback on API failure

## Scope Boundaries

**Included:**
- Inline card operations (edit, delete)
- Column-level selection and bulk actions
- Card exit animations
- Priority strip toolbar

**Excluded:**
- Board layout changes (see `task-board`)
- New column types or custom statuses
- Drag-and-drop improvements (see `task-board`)

## References

- Source: [task-board](task-board.md) — MVP kanban layout this feature extends
- Related: [task-definition-ai](task-definition-ai.md) — AI assist panel enhanced in the same commit
- Related: [provider-runtime-abstraction](provider-runtime-abstraction.md) — timeout guards added in the same commit
