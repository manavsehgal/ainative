---
title: Chat — `#key:value` Filter Namespace
status: in-progress  # v1 (chat popover) shipped 2026-04-14; v2 list-page + skills-tab deferred
priority: P2
milestone: post-mvp
source: chat-advanced-ux.md §1 (split during grooming, 2026-04-14)
dependencies:
  - chat-command-namespace-refactor
  - chat-environment-integration
---

# Chat — `#key:value` Filter Namespace

## Description

A third trigger character (`#`) joins `/` (commands) and `@` (entities) in the chat input. Unlike those, `#` is a **filter** — it narrows the contents of an already-open popover rather than inserting a new token. Examples:

- `@task: #status:blocked` — `@task:` popover, only blocked tasks
- `@task: #priority:high` — only high-priority tasks
- `/skills #scope:project` — Skills tab, only project-scoped skills

The filter parser is shared infrastructure: list pages (`/tasks`, `/projects`, `/workflows`) should be able to consume the same `#key:value` syntax via URL query or a FilterBar input. That shared reach is what upgrades this from "chat sugar" to "Stagent-wide filter language."

## User Story

As a power user who opens `@task:` and drowns in 80 tasks, I want to type ` #status:blocked` to narrow the popover to the 4 tasks I actually want to reference — without losing my place in the `@` flow.

## Technical Approach

### Parser

New module `src/lib/filters/parse.ts`:

```typescript
export interface FilterClause { key: string; value: string }
export interface ParsedFilterInput {
  clauses: FilterClause[];   // e.g. [{ key: "status", value: "blocked" }]
  rawQuery: string;          // the non-filter text, for fuzzy search
}
export function parseFilterInput(input: string): ParsedFilterInput;
```

Pure function. No coupling to chat or lists. Keys are alphanumeric + `-`; values may be quoted (`#tag:"needs review"`). Unknown keys pass through untouched — the consumer decides what to do with them.

### Popover integration

`chat-command-popover.tsx` already partitions by tab. The popover's search input runs through `parseFilterInput`. For entity popovers (`@task:`, `@project:`), the parsed `clauses` are passed to the existing fetch (e.g. `GET /api/tasks/search?status=blocked&q=<rawQuery>`); the popover server routes gain narrow validated filter params.

### Shared reuse

List pages (`/tasks`, `/projects`, `/workflows`) expose the same syntax through an optional FilterBar textbox. URL state: `?filter=%23status%3Ablocked`. Out of scope: replacing existing typed filter controls — those stay for discoverability.

### Known keys per surface

Published map of `{ surface → allowedKeys }` so popovers can autocomplete the key half of `#key:value`. Unknown keys are ignored, not errored.

## Acceptance Criteria

- [x] `parseFilterInput(str)` unit tests cover: single clause, multiple clauses, raw-query remainder, hyphens/underscores in keys, case preservation, back-to-back clauses, special characters (17 tests, excluding quoted values — deferred to v2)
- [x] Typing `@ #type:task` inside the chat mention popover filters entities to tasks only
- [x] Typing `@ #status:completed` filters to entities with matching status (case-insensitive substring)
- [x] Combined clauses (`@ #type:task #status:completed`) apply AND semantics
- [x] Mention-trigger regex extended to allow space + `#` continuation without closing the popover
- [x] Unknown keys pass through without errors (skipped per `matchesClauses` contract)
- [x] No regression in existing popover text search — `rawQuery` (filter-stripped) is what cmdk sees for fuzzy match
- [ ] Typing `#scope:project` inside `/skills` filters the Skills tab (deferred — v2)
- [ ] Backspace/delete correctly clears partial filter clauses (works by regex structure; no explicit UX handling)
- [ ] `/tasks?filter=%23status%3Ablocked` list page applies the same filter (deferred — v2)

## v1 Shipped Scope (2026-04-14)

- Parser: `src/lib/filters/parse.ts` with `parseFilterInput()` and `matchesClauses()` helpers
- Chat popover integration: `@<mention> #<key>:<value>` chaining works; `#status:`, `#type:` known keys
- Regex extension in `use-chat-autocomplete.ts` to keep popover open through space+`#`
- 17 parser unit tests + browser-verified end-to-end

## v2 Deferred Scope

- Quoted values (`#tag:"needs review"`) — v1 value terminates at whitespace or `#`
- List-page consumption (`/tasks`, `/projects`, `/workflows` URL state)
- Skills-tab filtering (`/skills #scope:project`)
- More filter keys (`#priority` requires extending entities/search response shape)
- NOT/OR logic

## Scope Boundaries

**Included:**
- Shared parser module
- Popover integration for `@task:`, `@project:`, `@workflow:`, `/skills`, `/profiles`
- List page (`/tasks`) consumer as proof of shared reuse

**Excluded:**
- NOT/OR logic (v1 is AND-only)
- Saved filter combinations (see `chat-pinned-saved-searches`)
- Filter-aware keyboard shortcuts
- Full list-page rollout (only `/tasks` as reference consumer)

## References

- Split from: [chat-advanced-ux](chat-advanced-ux.md) §1
- Existing code: `src/components/chat/chat-command-popover.tsx`, `src/hooks/use-chat-autocomplete.ts`
- Consumers: `src/app/tasks/page.tsx` (FilterBar)
