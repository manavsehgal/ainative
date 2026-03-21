---
title: UI Density Refinement
status: completed
priority: P2
milestone: post-mvp
source: ideas/ux-improvements.md
dependencies:
  - operational-surface-foundation
  - app-shell
  - homepage-dashboard
  - inbox-notifications
  - project-management
---

# UI Density Refinement

## Description

The operational surface foundation improves readability, but the browser pass surfaced a second layer of issues that are more compositional than token-level. The sidebar still feels somewhat detached from the main content background, the inbox action row is tighter than the content beneath it, and the projects page composition leaves too much unsupported negative space.

This feature is the focused follow-up tranche for those issues. It should preserve the improved solid-surface system while refining page balance, action density, and visual hierarchy on the screens that operators hit most often.

## User Story

As a Stagent operator, I want the main workspace chrome and page-level layouts to feel balanced and intentional so that high-frequency screens are easy to scan and don't feel visually unfinished.

## Technical Approach

- Rework sidebar surface/background treatment so the shell feels cohesive with the content canvas without losing navigation contrast
- Tighten inbox filter and action-row spacing, sizing, and visual affordance to match the stronger card treatment below
- Improve projects page composition with stronger vertical structure so sparse project counts do not leave the page visually empty
- Re-run Chrome browser evaluation on the affected routes after implementation and capture the before/after delta in the changelog

## Acceptance Criteria

- [x] The sidebar no longer feels visually detached from the main page background on the home screen
- [x] Inbox controls feel balanced with the notification cards and remain easy to scan at desktop widths
- [x] Projects page composition holds up with small project counts and avoids a large unfinished-looking empty field
- [x] The updated layouts are re-evaluated in Chrome on home, inbox, and projects after implementation
- [x] Follow-up changelog notes capture what improved and any remaining gaps

## Scope Boundaries

**Included:**
- Sidebar/background cohesion adjustments
- Inbox toolbar density and control affordance improvements
- Projects page composition and empty-space management
- Route-level browser validation after changes

**Excluded:**
- Large-screen information architecture changes
- Net-new pages or workflows
- Full mobile redesign
- Broader typography or branding overhaul

## References

- Source: `ideas/ux-improvements.md` — deferred UX backlog
- Related features: `operational-surface-foundation`, `app-shell`, `homepage-dashboard`, `project-management`
