---
title: Command Palette Enhancement
status: completed
priority: P2
milestone: post-mvp
source: conversation
dependencies:
  - app-shell
---

# Command Palette Enhancement

## Summary

Expand the ⌘K command palette from 7 commands to 20+ commands covering all app routes, entity creation, utility actions, and recent items. Restore the ⌘K hint button in the sidebar footer.

## Acceptance Criteria

1. ⌘K opens palette with four groups: Recent, Navigation, Create, Utility
2. ⌘K hint button visible in sidebar footer, clicking it opens palette
3. All 10 sidebar routes represented in Navigation group with matching icons
4. Create group includes: New Task, New Project, New Workflow, New Profile
5. Utility group includes: Toggle Theme, Mark All Notifications Read
6. Recent group shows up to 5 projects and 5 tasks from DB
7. Recent items load async (palette usable immediately with static commands)
8. Fuzzy search filters across all groups (e.g., "work" matches Workflows)
9. Mark All Read action clears unread notifications
10. Toggle Theme switches light/dark mode

## Technical Approach

- **API endpoint**: `GET /api/command-palette/recent` returns 5 recent projects + 5 recent tasks
- **Lazy fetch**: Recent items fetched when palette opens, with AbortController cleanup on close
- **Sidebar hint**: `<button>` dispatching synthetic KeyboardEvent (avoids shared context)
- **cmdk keywords**: Invisible search aliases for better discoverability

## Key Files

- `src/components/shared/command-palette.tsx` — Expanded palette component
- `src/components/shared/app-sidebar.tsx` — ⌘K hint button in footer
- `src/app/api/command-palette/recent/route.ts` — Recent items endpoint
