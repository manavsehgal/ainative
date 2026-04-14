---
title: Chat — Pinned Entries & Saved Searches
status: planned
priority: P3
milestone: post-mvp
source: chat-advanced-ux.md §2 (split during grooming, 2026-04-14)
dependencies:
  - chat-filter-namespace
  - chat-command-namespace-refactor
---

# Chat — Pinned Entries & Saved Searches

## Description

Power users repeatedly reach for the same entities (a specific project, an active workflow) and the same filter combinations (`#status:blocked #priority:high`). This feature adds lightweight per-user persistence for both:

- **Pinned entries** — right-click or `⌘P` on any popover result → surfaces in a "Pinned" section at the top next time that popover opens
- **Saved searches** — from a filter combination, "Save this search" → appears in a "Saved" section of the relevant popover and in the `⌘K` palette

Storage is pure settings JSON. No new tables. No server-side indexing. Keyed by popover surface so pins in `@task:` don't clutter `@project:`.

## User Story

As a user who pastes the same three workflow references into chat every morning, I want to pin them once and see them at the top of `@workflow:` forever — so I stop typing "daily summ" five times a day.

## Technical Approach

### Settings schema

Extend `settings.chat` JSON blob in `src/lib/db/schema.ts`:

```typescript
interface ChatSettings {
  pinnedEntries?: Record<PopoverSurface, Array<{ id: string; type: string; pinnedAt: string }>>;
  savedSearches?: Array<{
    id: string;            // ulid
    surface: PopoverSurface;
    label: string;         // user-provided or auto-generated from filters
    filterInput: string;   // raw "#status:blocked #priority:high" string
    createdAt: string;
  }>;
}
type PopoverSurface = "task" | "project" | "workflow" | "document" | "skill" | "profile";
```

One JSON read on app boot, in-memory in a `useSettings()` hook. Mutations POST to `/api/settings/chat` which does read-modify-write.

### UX

**Pinning**: right-click any popover item → context menu with "Pin" / "Unpin". Keyboard: `⌘P` with item focused. Pinned items render with a pin icon (lucide `Pin`) and appear in a `Pinned` cmdk group above other groups.

**Saving a search**: when filter clauses are present in the popover input, a subtle "Save this view" affordance appears in the popover footer. Click → inline rename input → saved. Saved searches appear as selectable entries in a `Saved` cmdk group; selecting one applies the filter string to the current popover.

**Palette surfacing**: `⌘K` shows all saved searches under a `Saved searches` group with labels + surface hints. Selecting navigates to the appropriate list page with the filter applied (not into the chat popover — that preserves the distinction between chat composition and navigation).

### Migration

`addColumnIfMissing` is unnecessary — `settings.chat` is already a JSON blob. Safe default `{}`.

## Acceptance Criteria

- [ ] Right-click / `⌘P` on popover item pins it; appears at top on next open
- [ ] Unpinning removes the entry and persists
- [ ] `Save this view` button appears only when filter clauses are present
- [ ] Saved searches appear in the `Saved` group of the relevant popover and in `⌘K`
- [ ] Per-surface keying: pinning a task doesn't appear in project popover
- [ ] Concurrent pin/unpin doesn't lose state (read-modify-write is serialized)
- [ ] Settings migration is a no-op on DBs without `chat.pinnedEntries` / `chat.savedSearches`

## Scope Boundaries

**Included:**
- Per-user pinning for all 6 popover surfaces
- Per-user saved searches with inline rename
- `⌘K` palette surfacing of saved searches

**Excluded:**
- Team-shared saved searches (single-user local product)
- Reordering pinned entries (chronological is fine)
- Saved-search hotkeys (`⌘1`, `⌘2`, …)
- Server-side filter index or cache (parse is fast enough)

## References

- Split from: [chat-advanced-ux](chat-advanced-ux.md) §2
- Depends on: [chat-filter-namespace](chat-filter-namespace.md) — saved searches store filter strings
- Existing code: `src/lib/db/schema.ts` (settings), `src/components/shared/command-palette.tsx`
