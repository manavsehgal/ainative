---
title: Saved Search Polish v1 — Clean filterInput + Cross-Component Revalidation
status: planned
priority: P2
milestone: post-mvp
source: output/screengrabs/dogfood-log-2026-04-14.md §§2-3
dependencies:
  - chat-pinned-saved-searches
---

# Saved Search Polish v1

## Description

Two small polish items from dogfood observations on the already-shipped `chat-pinned-saved-searches` v2. Bundled because both are one-file fixes that address real friction surfaced during real use.

## Technical Approach

### Bug #1 — `SaveViewFooter` captures mention prefix in `filterInput`

When a user types `@task: #priority:high` and saves the view, the persisted `filterInput` is stored as `task: #priority:high`. The `@` is stripped by the outer regex but the `task: ` prefix leaks into storage.

**Symptom:** the palette's "Saved searches" row shows cruft like `task: #priority:high` in the filter column, and re-applying the search to a list page passes `?filter=task: %23priority:high` (functional but ugly).

**Root cause:** `chat-command-popover.tsx` passes `filterInput: query` to `<SaveViewFooter>`, where `query` is the raw popover input including the mention trigger prefix.

**Fix:** rebuild `filterInput` from `parsed.clauses` + `parsed.rawQuery` inside the SaveViewFooter call site, discarding anything that preceded the first `#`:

```tsx
const cleanFilterInput = [
  ...parsed.clauses.map((c) => `#${c.key}:${c.value}`),
  ...(parsed.rawQuery ? [parsed.rawQuery] : []),
].join(" ");
```

Pass `cleanFilterInput` instead of `query`. Regression test: assert the persisted `filterInput` contains no `:` not immediately preceded by `#`.

### Bug #2 — `useSavedSearches` state doesn't revalidate across hook instances

The chat popover and the `⌘K` command palette each call `useSavedSearches()` independently. Saving a search in the popover (optimistic update) updates THAT hook's state, but the palette's hook fetched once on mount and stays stale until page reload.

**Fix (cheapest):** in `src/components/shared/command-palette.tsx`, add a `refetch()` method to `useSavedSearches` and call it from `CommandDialog`'s `onOpenChange` handler when transitioning closed → open.

Expose refetch from the hook:

```typescript
interface UseSavedSearchesReturn {
  searches: SavedSearch[];
  loading: boolean;
  save: (entry: Omit<SavedSearch, "id" | "createdAt">) => SavedSearch;
  remove: (id: string) => void;
  forSurface: (surface: SavedSearchSurface) => SavedSearch[];
  refetch: () => Promise<void>;                         // new
}
```

## Acceptance Criteria

- [ ] Saving `@task: #priority:high` produces a persisted record with `filterInput = "#priority:high"` (no `task: ` prefix)
- [ ] Saving `@task: foo #priority:high` produces `filterInput = "#priority:high foo"` (or `"foo #priority:high"` — clause order preserved; free text preserved)
- [ ] Regression test asserts no mention-trigger cruft in `filterInput`
- [ ] Saving in the chat popover, then opening `⌘K` without reload → new saved search appears in palette's Saved group
- [ ] Existing palette-open flow is no slower than before (single refetch, not on every keystroke)
- [ ] Hook backwards-compatible: existing consumers that didn't call refetch still work

## Scope Boundaries

**Included:**
- `filterInput` sanitization at the popover call site
- `refetch` exposure on the hook + invocation from palette on open
- Regression tests for both

**Excluded:**
- Per-saved-search rename/delete CRUD (future v2)
- Cross-tab revalidation (future)
- Migration of existing saved searches with cruft (users can re-save; cruft is cosmetic)

## References

- Observation source: `output/screengrabs/dogfood-log-2026-04-14.md` proposals #2 + #3
- Shipped feature: `chat-pinned-saved-searches.md` (v2 completed)
- Affected files: `src/components/chat/chat-command-popover.tsx`, `src/components/shared/command-palette.tsx`, `src/hooks/use-saved-searches.ts`
