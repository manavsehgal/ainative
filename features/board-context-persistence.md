# Board Context Persistence

- **Status**: completed
- **Priority**: P2
- **Milestone**: post-mvp
- **Dependencies**: [task-board](task-board.md), [kanban-board-operations](kanban-board-operations.md)

## Summary

Persist board filter/sort state across page refreshes and pass project context through navigation flows. Three capabilities:

1. **Persist project filter across sessions** — Selected project saved to `localStorage` key `stagent-project-filter`, restored on mount via `usePersistedState` hook.

2. **Prefill project on New Task** — Active project filter passed as `?project=<id>` URL param when navigating to `/tasks/new`. `TaskCreatePanel` reads it and pre-selects the project.

3. **Sort order dropdown** — Persisted sort control next to status filter with options: Priority (default), Newest first, Oldest first, Title A-Z. Sorting applies within each kanban column.

## Implementation

- Generic `usePersistedState` hook (`src/hooks/use-persisted-state.ts`) wraps `useState` + `localStorage` with SSR-safe `useEffect` hydration
- `kanban-board.tsx` uses the hook for project filter and sort order
- New Task link includes `?project=` search param when a specific project is selected
- `page.tsx` reads `searchParams.project` (async in Next.js 15+) and passes as `defaultProjectId` prop
- `TaskCreatePanel` accepts optional `defaultProjectId` to set initial project selection

## Verification

1. Select a project → refresh → same project still selected
2. Select a project → click New Task → project field pre-filled
3. Select "All projects" → click New Task → project field shows "None"
4. Change sort order → tasks reorder within each column
5. Change sort order → refresh → same sort order persists
6. Incognito → defaults to "All projects" + "Priority" sort
