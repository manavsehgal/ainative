---
title: Operational Surface Foundation
status: completed
priority: P2
milestone: post-mvp
source: ideas/design-system-fixes.md
dependencies:
  - app-shell
  - homepage-dashboard
  - task-board
  - inbox-notifications
  - monitoring-dashboard
  - project-management
---

# Operational Surface Foundation

## Description

Stagent's initial visual system leaned heavily on glassmorphism and backdrop blur across dense operational screens. That created an atmospheric look, but it made board views, notification lists, settings forms, and dashboard cards feel softer and less stable than an operator console should.

This feature introduces a solid-surface layer for high-density UI while preserving the broader brand gradients. It also hardens theme startup so the app resolves light or dark mode before paint, reducing flash and making the shell feel more deliberate and technically reliable.

## User Story

As a Stagent operator, I want dashboard cards, task cards, inbox items, and settings panels to feel crisp and stable so that I can scan and act quickly without visual blur or theme flicker getting in the way.

## Technical Approach

- Add solid surface design tokens for primary, muted, and control surfaces in `src/app/globals.css`
- Introduce reusable utility classes for dense operational UI (`surface-card`, `surface-card-muted`, `surface-control`, `surface-scroll`)
- Bootstrap theme state in `src/app/layout.tsx` before hydration with critical CSS and an inline init script
- Update the theme toggle to synchronize the DOM class, `data-theme`, `color-scheme`, local storage, and cookie state
- Move dense UI components from blur-heavy card treatments onto the new surface utilities across dashboard, monitor, kanban, inbox, projects, and settings
- Widen settings content to reduce cramped form layout

## Acceptance Criteria

- [x] The root layout sets theme state before paint to reduce light/dark flash
- [x] Theme preference persists consistently across local storage, cookie, and DOM state
- [x] Dense operational views use solid-surface utilities instead of relying on default glass cards
- [x] Dashboard, monitor, kanban, inbox, projects, and settings all render with improved surface contrast
- [x] Settings content width is increased to support cleaner form scanning
- [x] Browser evaluation in Chrome confirms the updated surface system on home, inbox, projects, and settings

## Scope Boundaries

**Included:**
- Theme bootstrapping and no-flash startup behavior
- Surface token and utility creation
- Dense screen card/control updates across the existing UI
- Minor settings layout width adjustment

**Excluded:**
- Reworking the overall page art direction or gradient identity
- Mobile-specific layout redesign
- Sidebar composition refinements beyond the theme/bootstrap foundation
- New information architecture or navigation changes

## References

- Source: `ideas/design-system-fixes.md` — design-system technical debt backlog
- Source: `ideas/ux-improvements.md` — post-MVP UX refinement backlog
- Related features: `app-shell`, `homepage-dashboard`, `ux-gap-fixes`, `micro-visualizations`
