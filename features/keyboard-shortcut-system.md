---
title: Keyboard Shortcut System
status: completed
priority: P2
milestone: post-mvp
source: retrospective — code exists without spec (2026-03-31)
dependencies: [app-shell, command-palette-enhancement]
---

# Keyboard Shortcut System

## Description

A singleton shortcut registry that manages global and surface-scoped keyboard bindings across the entire application. Supports modifier keys (Meta/Ctrl/Alt/Shift), sequence keys (e.g., "g d" = press g then d within 500ms), and a subscription/listener pattern for dynamic UI updates like the keyboard cheat sheet.

This is the underlying infrastructure that powers the command palette (Cmd+K), navigation shortcuts (g d = go to dashboard), and surface-specific actions (j/k for list navigation). Without this system, keyboard shortcuts would be scattered ad-hoc across components with no central registry, no conflict detection, and no cheat sheet.

## User Story

As a power user, I want consistent keyboard shortcuts across all surfaces so that I can navigate and operate ainative without touching the mouse.

## Technical Approach

- **Singleton registry** (`src/lib/keyboard/shortcut-registry.ts`):
  - `ShortcutRegistry` singleton with `register()`, `unregister()`, `getShortcuts()`, `subscribe()`
  - Each `ShortcutEntry` has: id, keys, description, scope, category, handler
  - Scope system: `"global"` (always active) or named surface (active when surface is mounted)
  - Sequence buffer with 500ms timeout for multi-key combos
  - Cached snapshot array for efficient React rendering
  - Listener notification on any registration change
- **Integration pattern**: Components call `register()` in useEffect, returning the cleanup unregister function
- **Cheat sheet**: `getShortcuts()` returns all registered shortcuts grouped by category for the ? help overlay

### Key Files

- `src/lib/keyboard/shortcut-registry.ts` — Singleton registry with sequence support

## Acceptance Criteria

- [x] Global shortcuts active regardless of focused surface
- [x] Surface-scoped shortcuts active only when matching surface is mounted
- [x] Modifier key support: Meta (⌘), Ctrl, Alt, Shift
- [x] Sequence key support with 500ms timeout (e.g., "g d" for go-to-dashboard)
- [x] Subscribe/notify pattern for reactive UI updates
- [x] Cleanup function returned from register() for effect teardown
- [x] Cached snapshot for efficient cheat sheet rendering

## Scope Boundaries

**Included:**
- Central shortcut registration and dispatch
- Scope-based activation (global vs surface)
- Sequence key handling with timeout
- Subscription pattern for UI reactivity

**Excluded:**
- Command palette UI (covered by `command-palette-enhancement`)
- Accessibility keyboard navigation (covered by `accessibility`)
- Specific shortcut bindings per page (implemented in respective feature components)

## References

- Related features: `command-palette-enhancement` (Cmd+K palette), `accessibility` (keyboard navigation), `app-shell` (global keybindings)
- Source: Retrospective spec — code implemented during operational surface foundation work
