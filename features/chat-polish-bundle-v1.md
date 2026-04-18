---
title: Chat Polish Bundle v1 — Filter Hint, Saved-Search CRUD, Empty-Group Suppression
status: completed
priority: P3
milestone: post-mvp
source: chat-advanced-ux umbrella dogfood log (Phase 3 close-out, 2026-04-14)
dependencies:
  - chat-filter-namespace
  - chat-pinned-saved-searches
  - saved-search-polish-v1
---

# Chat Polish Bundle v1

## Description

Three small UX improvements on already-shipped chat surfaces, bundled into one PR because each diff is tiny and all three live in the same file neighborhood (`chat-command-popover.tsx`, `command-palette.tsx`, `use-saved-searches.ts`, `filter-input.tsx`).

These items were surfaced during Phase 3 close-out of the retired `chat-advanced-ux` umbrella. `chat-conversation-branches` remains intentionally deferred — this bundle addresses real dogfood friction before we invest in the largest unshipped surface.

## User Stories

1. **Filter hint** — As a first-time user of `@task:` or `/documents`, I discover `#status:blocked` syntax without reading docs or getting help.
2. **Saved-search CRUD** — As a user with a mis-typed saved search, I can rename or delete it without editing JSON or losing my data to a confirm dialog I clicked past.
3. **Empty-group suppression** — As a user who just typed `#type:pdf` in `@`-mention, I see only surfaces that actually have PDF results, not empty "Workflows" and "Profiles" headers.

## Technical Approach

### 1. Filter hint (`src/components/shared/filter-hint.tsx` — new)

A small inline component, consumed by both `chat-command-popover.tsx` and `filter-input.tsx`.

```tsx
<FilterHint
  inputValue={query}
  storageKey="ainative.filter-hint.dismissed"
/>
```

**Visibility rule:** shown when input is empty OR does not yet contain a `#` character, AND the dismissal flag is not set. Once the user successfully types any `#key:value` clause (parser returns `clauses.length > 0` in the current session), set the localStorage flag so the hint disappears permanently.

**Copy:** `Tip: use #key:value to filter (e.g. #status:blocked)` — rendered as a muted row, not a dismissable toast.

**Why auto-suppress on first successful use instead of a dismiss button:** avoids visual noise, reaches zero-config state for returning users, matches the "discoverable, not interruptive" goal. A dismiss `×` can be added later if telemetry shows the hint is ignored but never used.

### 2. Saved-search CRUD

#### Hook additions (`src/hooks/use-saved-searches.ts`)

Add a `rename` method. The existing API is a full-list PUT — no new route needed.

```typescript
interface UseSavedSearchesReturn {
  // existing: searches, loading, save, remove, forSurface, refetch
  rename: (id: string, label: string) => void;
}
```

Implementation mirrors `remove`: optimistic state update via `setSearches`, followed by `persist(next)` with the full mutated list. Validation (non-empty, ≤100 chars, unique per surface) happens at the call site in `SavedSearchesManager` — the hook stays thin.

#### Inline delete in `⌘K` palette (`src/components/shared/command-palette.tsx`)

- Trailing `Trash2` icon on each saved-search `CommandItem`, visible on row hover/focus only (opacity transition, `opacity-0 group-hover/item:opacity-100 focus-within:opacity-100`).
- Click → optimistic `remove(id)` + toast with Undo action (5s window). Undo calls `save(originalRecord)` — because we still hold the record in closure before removing it.
- Keyboard: `⌘⌫` on a focused row also deletes (intercept in the `CommandItem`'s `onKeyDown`).
- Accessibility: `aria-label="Delete saved search: {label}"` on the icon button.

#### Manager dialog (`src/components/shared/saved-searches-manager.tsx` — new)

- Opened via a `Manage saved searches` action inside the `⌘K` Saved group (own `CommandItem`, not a footer — footer links in cmdk are awkward). Only renders when at least one saved search exists.
- `Dialog` with a simple list: each row shows `label`, `surface` badge, and a collapsed `filterInput` preview.
- Per row: `Rename` inline input (double-click label OR click `Pencil` icon reveals a text input with blur-to-save, Esc-to-cancel), and a `Delete` button (no undo here — user is in a deliberate management context, so use a native confirm or inline "Are you sure?" toggle).
- Validation: `trim()`, reject empty, reject >100 chars, reject duplicates within the same `surface` (case-insensitive) — surface all as inline error text below the input.

**Why separate rename affordance from inline delete:** delete is one-click and reversible via undo, which fits inline. Rename needs a text input + validation + error messaging — awkward to shoehorn into a `cmdk` row.

### 3. Empty-group suppression (`src/components/chat/chat-command-popover.tsx`)

In the tab render loop:

- Compute `visibleItemCount` per group after the filter pipeline (`parsed.clauses` + `matchesClauses` applied).
- Skip rendering `<CommandGroup>` when `visibleItemCount === 0`.
- Track total visible count across all groups. If total is 0, render a single `CommandEmpty` echoing the active filter: `No matches for {activeFilterSummary}` (e.g. `No matches for #type:pdf`).

The summary string is built from `parsed.clauses.map(c => '#' + c.key + ':' + c.value).join(' ')` — falls back to generic `No matches` when no clauses present.

## Acceptance Criteria

### Filter hint
- [ ] Hint renders below `filter-input.tsx` when input is empty or contains no `#`
- [ ] Hint renders in `chat-command-popover.tsx` same conditions
- [ ] Typing a valid `#key:value` that parses to ≥1 clause sets `localStorage["ainative.filter-hint.dismissed"] = "1"` and hides the hint for subsequent mounts
- [ ] Clearing localStorage restores the hint (regression check for dismissal key correctness)

### Saved-search CRUD
- [ ] `useSavedSearches().rename(id, "New label")` updates state optimistically and persists via full-list PUT
- [ ] Inline `Trash2` icon appears on hover/focus in `⌘K` Saved group; click removes the row and shows a toast with Undo
- [ ] Clicking Undo within 5s restores the row with its original id, surface, label, filterInput, createdAt
- [ ] `⌘⌫` on a focused saved-search row also triggers delete-with-undo
- [ ] `Manage saved searches` `CommandItem` appears in the Saved group only when ≥1 saved search exists
- [ ] Manager dialog lists all saved searches grouped or labeled by surface
- [ ] Inline rename: empty label rejected with inline error; >100 chars rejected; duplicate label within same surface rejected (case-insensitive)
- [ ] Escape cancels rename without persisting; blur commits
- [ ] Delete in manager requires explicit confirm (inline "Are you sure?" toggle, no undo) — distinct from inline palette delete

### Empty-group suppression
- [ ] Typing `#type:pdf` in `@`-mention popover hides Workflows, Profiles, Projects groups when they have 0 matches
- [ ] When ALL groups are empty, a single `CommandEmpty` shows `No matches for #type:pdf`
- [ ] When some groups are non-empty, the empty groups are simply not rendered (no placeholder text)
- [ ] Existing behavior preserved when no `#` filter is active (all groups render even if empty — they collapse under cmdk's own empty-state handling)

### Cross-cutting
- [ ] Browser smoke: save view → open `⌘K` → rename in manager → label updates in palette → delete inline → Undo restores → type `#type:nothing` → all groups hide and `CommandEmpty` shows
- [ ] No regression in existing `saved-search-polish-v1` behavior (refetch on palette open still fires)
- [ ] `tsc --noEmit` clean; `vitest run` green for touched modules

## Scope Boundaries

**Included:**
- FilterHint component + wiring into two call sites
- `rename` hook method
- Inline delete-with-undo in `⌘K` palette
- Manager dialog for rename + deliberate delete
- Empty-group suppression in `chat-command-popover.tsx` with filter-aware empty state

**Excluded (deferred to v2 or later specs):**
- Reordering saved searches
- Per-surface scope editing (changing a saved search's `surface` after creation)
- Filter-hint telemetry or copy A/B
- `chat-conversation-branches` (umbrella still defers)
- Any changes to the `PUT /api/settings/chat/saved-searches` route — full-list replacement stays
- Shared toast Undo primitive — if one doesn't exist already, use Sonner (already a dep) directly; don't refactor

## Testing Strategy

- **Unit:** `rename` hook method (optimistic update + `persist` call with correct next-list), `FilterHint` visibility logic with mocked `parseFilterInput`
- **Component:** `SavedSearchesManager` validation paths (empty / too long / duplicate), inline delete undo round-trip
- **API:** no changes — existing PUT route tests cover the shape already
- **Browser smoke:** full end-to-end described in Acceptance Criteria → Cross-cutting

## References

- Parent umbrella (retired): [chat-advanced-ux](chat-advanced-ux.md)
- Sibling shipped specs: [chat-filter-namespace](chat-filter-namespace.md), [chat-pinned-saved-searches](chat-pinned-saved-searches.md), [saved-search-polish-v1](saved-search-polish-v1.md)
- Affected files:
  - `src/components/shared/filter-input.tsx`
  - `src/components/shared/filter-hint.tsx` (new)
  - `src/components/shared/saved-searches-manager.tsx` (new)
  - `src/components/shared/command-palette.tsx`
  - `src/components/chat/chat-command-popover.tsx`
  - `src/hooks/use-saved-searches.ts`
- Deferred sibling: [chat-conversation-branches](chat-conversation-branches.md)

## Verification — 2026-04-14

Browser smoke verified end-to-end on Playwright:
- FilterHint visible on `/documents`; auto-dismisses after typing `#type:pdf`; persists across reload
- `⌘K` palette renders Saved-searches group with inline trash button + "Manage saved searches…" row when ≥1 saved search exists
- `SavedSearchesManager` dialog opens; rename via inline input + Tab-blur persists to API (`PUT /api/settings/chat/saved-searches`)
- Deliberate two-click delete (Delete → Confirm delete) removes the row from API
- Zero console errors throughout
- Full unit suite green (1009 tests)
- 7 implementation tasks shipped on `main`: 76a64fa, f3c18a2, 54be881, 5bacedd, 5a43d38, 6159346, d84c20f, 9e80ca8, 9bc5166, 0e68b3e

Status: shipped.
