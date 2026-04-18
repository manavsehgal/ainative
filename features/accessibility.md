---
title: Accessibility
priority: P2
status: completed
milestone: post-mvp
dependencies:
  - app-shell
  - task-board
  - workflow-engine
  - content-handling
---

# Accessibility

## Overview

Ensure ainative meets WCAG 2.1 AA standards across all interactive components. This spec tracks accessibility gaps identified during the MVP design review.

## A1: ARIA Live Regions for Dynamic Content (Completed)

**Problem**: Polling-driven components replace content without screen reader announcements. Zero `aria-live` regions existed.

**Fixed in Design Review**:
- `workflow-status-view.tsx` step list — `aria-live="polite"`
- `inbox-list.tsx` notification list — `aria-live="polite"`

**Completed in this slice**:
- [x] `monitor-overview.tsx` — monitor metrics now announce refresh-driven updates via a polite live region
- [x] `priority-queue.tsx` — homepage priority tasks now announce list updates politely
- [x] `activity-feed.tsx` — homepage activity feed now announces new activity politely
- [x] `kanban-board.tsx` — hidden board announcement region now describes filter changes and drag/drop outcomes

## A2: Icon-Only Button Accessible Names (Fixed)

**Problem**: Icon-only buttons lacked `aria-label` attributes.

**Fixed in Design Review**:
- [x] Copy/download/expand buttons in `content-preview.tsx`
- [x] Remove file button in `file-upload.tsx`
- [x] Remove step button in `workflow-create-dialog.tsx`
- [x] Refresh button in `inbox-list.tsx` (already had aria-label)

## A3: Keyboard-Accessible Drag-Drop Zone (Fixed)

**Problem**: File upload drop zone used `div` with `onClick` and `onDrop` but no keyboard support.

**Fixed in Design Review**:
- [x] Added `role="button"`, `tabIndex={0}`, `aria-label`
- [x] Added `onKeyDown` handler for Enter and Space keys
- [x] Added `focus-visible` ring styling

## A4: Focus Management in Sheet/Dialog Transitions

**Problem**: Programmatic close paths in Sheet and Dialog may not restore focus to the trigger element.

**Current product note**: The original `task-detail-panel.tsx` and `task-create-dialog.tsx` close paths no longer exist because task create/detail now use dedicated routes. Verification for this feature therefore covers the current programmatic dialog close surfaces that remain in the shipped UI.

- [x] `project-create-dialog.tsx` — focus returns to the `New Project` trigger after successful submit
- [x] `project-edit-dialog.tsx` — focus returns to the invoking project card/button after save
- [x] `document-upload-dialog.tsx` — focus returns to the Upload trigger after close
- [x] Targeted Vitest coverage added for the verified programmatic close flows

## Acceptance Criteria

- [x] All polling-driven content regions have `aria-live="polite"`
- [x] All icon-only buttons have descriptive `aria-label` attributes
- [x] File upload drop zone is keyboard accessible with role, tabIndex, and key handlers
- [x] Focus management verified for all current programmatic close paths
- [x] Accessibility regression tests and browser verification passed for core flows (task create, inbox updates, workflow status, dashboard, and monitor)
