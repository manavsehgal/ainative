---
title: "Bug: Sidebar App Menus Always Expanded — Missing Accordion Behavior"
audience: stagent-base
status: proposed
source_branch: local
handoff_reason: Sidebar app menus are always expanded and do not follow the accordion pattern (one expands, others collapse) used by Stagent's native sidebar menus.
---

# Bug: Sidebar App Menus Always Expanded — Missing Accordion Behavior

## Summary

App sidebar menus (e.g., Wealth, Growth, My Health Dashboard) are **always fully expanded**, showing all their sub-links at all times. They do not follow the **accordion behavior** used by Stagent's native sidebar menus, where expanding one section collapses the others. This wastes vertical space and makes the sidebar harder to navigate as more apps are installed.

## Reproduction

1. Open Stagent with multiple apps installed (e.g., Wealth, Growth)
2. Observe the sidebar: both app menus are fully expanded, showing all sub-links (tables, schedules, etc.)
3. Click on another app's header
4. **Expected:** Clicked app expands, previously expanded app collapses (accordion pattern)
5. **Actual:** All app menus remain expanded. No collapse behavior.

## Expected Behavior

App sidebar menus should follow the same accordion pattern as Stagent's native sidebar sections:

- **Click to expand** an app menu → reveals its sub-links (tables, schedules, docs, etc.)
- **Other app menus collapse** automatically when a new one is expanded
- **Only one app menu open at a time** (or optionally allow the user to pin/multi-expand, but default should be accordion)

## Impact

- As more apps are installed, the sidebar becomes increasingly cluttered
- Users have to scroll through all expanded app menus to find what they need
- Inconsistent UX between native Stagent sidebar sections (which do accordion) and app sections (which don't)
- Gets worse with every additional app installed — this is a scalability issue for the sidebar
