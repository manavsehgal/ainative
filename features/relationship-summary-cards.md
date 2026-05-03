---
title: Relationship Summary in Cards & Lists
status: completed
shipped-date: 2026-05-03
priority: P2
milestone: post-mvp
source: conversation/2026-04-02-entity-relationships
dependencies:
  - entity-relationship-detail-views
---

> Verified shipped 2026-05-03. Workflow cards + document table/grid + SQL subqueries shipped earlier. The 2 remaining gaps surfaced during Ship Verification — task-card `docCount` enrichment in `src/app/tasks/page.tsx` and `project-card.tsx` rendering doc count alongside task count — were closed in the same session.

# Relationship Summary in Cards & Lists

## Description

Card and list views across the app show minimal relationship information. Workflow cards don't show document or task counts. Task cards don't show document counts. Document table/grid views don't show the source workflow name. Project cards don't show document counts. Users must click into detail views to discover relationship context that would help them scan and triage from list views.

This feature adds compact relationship counts and labels to cards and list items. The principle: **cards show counts, detail views show lists**. Counts of 0 are hidden to avoid clutter. All data comes from extended existing API queries (JOINs and subqueries), not separate endpoints.

## User Stories

**Scanner (Emily):** As a user scanning the workflow list, I want to see how many documents each workflow produced and how many tasks it created, so I can quickly identify which workflows generated the most output.

**Triager (Marcus):** As a user triaging tasks on the kanban board, I want to see document count badges on task cards, so I can identify tasks with rich output without clicking into each one.

**Researcher (Alex):** As a user browsing the document manager, I want to see which workflow produced each document in the table view, so I can filter and sort by workflow source.

## Technical Approach

### Design Principles

- Cards show relationship **counts** (1-2 indicators max), not lists
- Use existing `Badge` (outline variant) with `FileText`/`ListTodo` icons for counts
- Muted styling so counts don't compete with primary content (status, title)
- Counts of 0 are hidden (no "0 documents" noise)
- All counts from efficient JOINs/subqueries — no N+1 queries

### Workflow Cards — Document + Task Count

**Kanban card** (`src/components/workflows/workflow-kanban-card.tsx`):
- Add output document count in the status strip area (after pattern label)
- `FileText` icon + count, muted text, 11px size
- Hidden when count is 0

**List card** (`src/components/workflows/workflow-list.tsx`):
- Add task count + document count after pattern/step count line
- Format: "· N tasks · N docs" using middot separators
- Hidden when counts are 0

**Data source** — extend workflow listing API (`src/app/api/workflows/route.ts`):
```typescript
// Add to the existing query
const workflowsWithCounts = await db
  .select({
    ...getTableColumns(workflows),
    taskCount: sql<number>`(SELECT COUNT(*) FROM tasks WHERE workflow_id = ${workflows.id})`,
    outputDocCount: sql<number>`(SELECT COUNT(*) FROM documents WHERE task_id IN (SELECT id FROM tasks WHERE workflow_id = ${workflows.id}) AND direction = 'output')`,
  })
  .from(workflows)
  // existing WHERE/ORDER BY...
```

### Task Cards — Document Count

**Task card** (`src/components/tasks/task-card.tsx`):
- Add document count badge in the metadata row (near agent/profile badges)
- Outline badge: `FileText` icon + count
- Hidden when count is 0

**Data source** — extend task listing queries:
```typescript
// Subquery for document count
docCount: sql<number>`(SELECT COUNT(*) FROM documents WHERE task_id = ${tasks.id})`,
```

Update `TaskItem` interface to include `docCount?: number`.

### Document Table/Grid — Workflow Name

**Table** (`src/components/documents/document-table.tsx`):
- Add "Workflow" column, visible at `lg:` breakpoint
- Show workflow name (from extended `DocumentWithRelations` type, added in entity-relationship-detail-views feature)
- Display "—" for uploaded documents or documents without workflow association
- Truncated to ~140px max-width

**Grid** (`src/components/documents/document-grid.tsx`):
- Add workflow name label below the direction/version row
- 10px muted text, truncated
- Hidden when no workflow association

**Data source** — the document API join from `entity-relationship-detail-views` provides `workflowName`. No additional queries needed.

### Project Cards — Document Count

**Project card** (`src/components/projects/project-card.tsx` or equivalent):
- Add document count alongside existing task count
- `FileText` icon + "N docs" in the metadata footer
- Hidden when count is 0

**Data source** — extend project listing query:
```typescript
docCount: sql<number>`(SELECT COUNT(*) FROM documents WHERE project_id = ${projects.id})`,
```

## Key Files

| File | Change |
|------|--------|
| `src/components/workflows/workflow-kanban-card.tsx` | Add document count badge |
| `src/components/workflows/workflow-list.tsx` | Add task + doc count text |
| `src/components/tasks/task-card.tsx` | Add document count badge |
| `src/components/documents/document-table.tsx` | Add workflow name column |
| `src/components/documents/document-grid.tsx` | Add workflow name label |
| `src/components/projects/project-card.tsx` | Add document count |
| `src/app/api/workflows/route.ts` | Extend query with task/doc count subqueries |
| `src/app/api/tasks/` (listing endpoints) | Extend query with doc count subquery |
| `src/app/projects/[id]/page.tsx` | Extend query with doc count subquery |

### Reusable Components

| Component | Path | Reuse |
|---------|------|-------|
| `Badge` (outline) | shadcn/ui | Count badges on cards |
| `FileText` icon | lucide-react | Document count indicator |
| `ListTodo` icon | lucide-react | Task count indicator |
| Middot separator pattern | `workflow-list.tsx` existing | Consistent inline separators |

## Acceptance Criteria

- [x] Workflow kanban cards show output document count badge (when > 0)
- [x] Workflow list cards show task count and document count in metadata line
- [x] Task cards show document count badge in metadata row (when > 0) — closed 2026-05-03 by adding `docCount` SQL subquery to `src/app/tasks/page.tsx` BoardContent query; `task-card.tsx` already supported the prop
- [x] Document table shows "Workflow" column at lg: breakpoint with workflow name
- [x] Document table shows "—" for documents without workflow association
- [x] Document grid shows workflow name label below direction/version row
- [x] Project cards show document count alongside task count (when > 0) — closed 2026-05-03 by adding `docCount` to project listing query (`src/app/projects/page.tsx` + `src/app/api/projects/route.ts`), extending `Project` type in `project-list.tsx`, and rendering with `FileText` icon in `project-card.tsx`
- [x] All counts hidden when value is 0 (no zero-count badges)
- [x] Count queries use subqueries or JOINs — no N+1 queries
- [x] Card layout remains compact — counts don't push content or cause wrapping
- [x] Workflow name in document table truncated at ~140px with ellipsis

## Scope Boundaries

**Included:**
- Document count badges on workflow, task, and project cards
- Task count on workflow list cards
- Workflow name column in document table
- Workflow name label in document grid
- Subquery-based count enrichment in listing APIs

**Excluded:**
- Relationship lists on cards (counts only — lists are for detail views)
- Schedule/cron indicators on cards (no schedule FK on workflows)
- Agent profile counts or breakdowns on project cards
- Inline expandable relationship previews (too complex for card context)
- Real-time count updates via SSE (static on page load is sufficient)

## References

- Source: conversation/2026-04-02-entity-relationships — frontend-designer consultation
- Related features:
  - `entity-relationship-detail-views` — provides the extended data types (DocumentWithRelations with workflowName) this feature consumes
  - `detail-view-redesign` — established card styling patterns (bento grid, chip bar, status strips)
  - `workflow-run-history` — provides run tracking data that enriches document context
