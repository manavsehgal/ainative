---
title: Chat — Pinned Entries & Saved Searches
status: in-progress  # v1 pinning shipped 2026-04-14; saved searches deferred to v2
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

- [x] Hover-reveal Pin button on popover entity items (context menu + ⌘P deferred to v2)
- [x] Click Pin → item appears in a "Pinned" group at the top of the popover on next open
- [x] Unpin button in the Pinned group removes the entry and persists via PUT
- [x] Settings migration is a no-op — new `chat.pinnedEntries` key is self-initializing via `getSetting` returning null → `[]`
- [x] Pinned items hidden from their regular type group so they don't render twice
- [x] Pin records denormalize `label`, `description`, `status` so they render standalone even when outside `entities/search`'s top-N window
- [ ] `Save this view` button appears only when filter clauses are present (deferred — v2)
- [ ] Saved searches appear in the `Saved` group of the relevant popover and in `⌘K` (deferred — v2)
- [ ] Right-click / `⌘P` on popover item pins it (deferred — hover-button is v1 UX)

## v1 Shipped Scope (2026-04-14)

- New `/api/settings/chat/pins` route (GET + PUT) with Zod validation
- New `usePinnedEntries()` hook — fetch-once + optimistic mutations
- Pin/Unpin buttons on entity rows (hover reveal) + "Pinned" cmdk group
- Denormalized pin record (id, type, label, description, status, pinnedAt)
- Dedup-by-id on PUT (last-write-wins) in the route handler

## v2 Deferred Scope

- Saved searches (whole feature — depends on picking UX for "Save this view")
- Right-click context menu + ⌘P keyboard shortcut
- `⌘K` palette surfacing of saved searches
- Reordering pins
- Stale-label refresh (pins pointing to renamed entities stay stale until un-pin/re-pin)

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
