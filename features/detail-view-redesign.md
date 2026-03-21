---
title: Detail View Redesign
status: completed
priority: P2
milestone: post-mvp
source: conversation/2026-03-18-detail-views
dependencies:
  - task-board
  - document-manager
  - workflow-engine
  - ui-density-refinement
---

# Detail View Redesign

## Description

Unified UI consistency pass across the three primary detail surfaces — task detail, document detail, and workflow kanban cards. Introduces a shared `prose-reader-surface` CSS class and `PROSE_READER` constants for consistent content rendering, then applies a bento grid layout to task detail, chip bar + content renderer to document detail, and status-colored strips to workflow kanban cards. The result is a cohesive reading experience across all detail views.

## User Story

As a user reviewing task outputs, document content, or workflow progress, I want each detail view to feel like part of the same product — with consistent typography, card layouts, and interaction patterns — so I can move between views without cognitive switching cost.

## Technical Approach

### Shared Foundation

| File | Action | Purpose |
|------|--------|---------|
| `src/app/globals.css` | Modify | Add `prose-reader-surface` class with consistent typography, line-height, and spacing |
| `src/lib/constants/prose-reader.ts` | Create | `PROSE_READER` constants for max-width, padding, and font-size tokens |

### Task Detail — Bento Grid

| File | Action | Purpose |
|------|--------|---------|
| `src/components/tasks/task-detail-view.tsx` | Modify | Replace linear layout with bento grid (metadata cards + output reader) |
| `src/components/tasks/task-chip-bar.tsx` | Create | Horizontal chip bar for status, priority, complexity, profile, dates |
| `src/components/tasks/task-usage-metrics.tsx` | Create | Compact usage display (tokens, cost, duration) in bento cell |

### Document Detail — Chip Bar + Reader

| File | Action | Purpose |
|------|--------|---------|
| `src/components/documents/document-detail-view.tsx` | Modify | Add chip bar, content renderer with image zoom, smart extracted text display |

### Workflow Cards — Status Strips

| File | Action | Purpose |
|------|--------|---------|
| `src/components/workflows/workflow-kanban-card.tsx` | Modify | Add status-colored left strip, tighter card layout |
| `src/components/workflows/workflow-status-view.tsx` | Modify | Consistent card styling across kanban columns |

### Notification UX (bundled)

| File | Action | Purpose |
|------|--------|---------|
| `src/components/notifications/` | Modify | Click-through navigation, expand/collapse, destructive delete-read styling |

## Acceptance Criteria

- [x] Task detail uses bento grid layout with metadata cards and prose reader surface
- [x] Task detail shows chip bar with status, priority, complexity, profile, and date chips
- [x] Task detail displays usage metrics (tokens, cost, duration) in a dedicated bento cell
- [x] Document detail uses chip bar for metadata display
- [x] Document detail renders content with image zoom capability
- [x] Document detail shows smart extracted text with prose-reader-surface styling
- [x] Workflow kanban cards display status-colored left strip matching workflow state
- [x] `prose-reader-surface` class applies consistent typography across all detail views
- [x] Notification items support click-through navigation to source entities
- [x] Notification expand/collapse and destructive delete-read styling applied
- [x] Workflow cascade delete cleans up child tasks FK-safely
- [x] Batch context proposal approve/reject works without individual notification IDs

## Scope Boundaries

### In Scope

- Bento grid task detail layout
- Chip bar pattern for task and document metadata
- Prose reader surface shared class
- Status-colored workflow kanban strips
- Notification UX improvements
- Workflow cascade delete
- Batch context proposal fix

### Out of Scope

- Workflow detail page redesign (covered by `workflow-ux-overhaul`)
- New data fields or API changes (layout-only)
- Mobile responsive breakpoints (desktop-first)
- Print stylesheet

## References

- **Commits**: `f1410e9` (task bento grid), `822ebee` (prose-reader-surface), `8ea0d4a` (document detail + cascade delete), `72b40c2` (workflow kanban + notification UX)
- **Depends on**: [task-board](task-board.md), [document-manager](document-manager.md), [workflow-engine](workflow-engine.md), [ui-density-refinement](ui-density-refinement.md)
