---
title: Workflow Run History & Document Lineage
status: completed
priority: P1
milestone: post-mvp
source: conversation/2026-04-02-entity-relationships
dependencies:
  - workflow-engine
  - workflow-editing
  - document-output-generation
---

# Workflow Run History & Document Lineage

## Description

When workflows are edited and re-run, old tasks and output documents persist but nothing links them to a specific execution cycle. The `workflows` table has no run counter. Users see output documents with incrementing version numbers but cannot trace them back to a particular workflow run. The output scanner already versions documents by filename, but the version is per-task, not per-workflow-run.

This feature adds a `runNumber` column to workflows (incremented atomically on each execution) and a `workflowRunNumber` column to tasks (stamped from the workflow at creation time). Together, these enable grouping tasks by run, tracing document lineage through runs, and disambiguating versions in the document picker.

Old documents are preserved — "current" vs "superseded" is derived by query (highest version for a given `originalName` + `projectId`), not by archiving or deletion.

## User Stories

**Workflow Iterator (Emily):** As a user who runs a research workflow, tweaks prompts, and re-runs it, I want to see which run produced which output documents so I can compare results across iterations.

**Power User (Marcus):** As a user running 10+ workflows weekly, I want the document picker to show run numbers and dates when multiple versions exist, so I pick the right version for my next workflow.

**Reviewer (Alex):** As a project reviewer, I want to see a workflow's run history with task counts and completion status, so I can understand the iteration history without clicking into individual tasks.

## Technical Approach

### Schema Changes

**File: `src/lib/db/schema.ts`**

Add to `workflows` table:
```typescript
runNumber: integer("run_number").default(0).notNull(),
```

Add to `tasks` table:
```typescript
workflowRunNumber: integer("workflow_run_number"),
```

**File: `src/lib/db/migrations/XXXX_add_workflow_run_number.sql`** (new)

```sql
ALTER TABLE workflows ADD COLUMN run_number INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE tasks ADD COLUMN workflow_run_number INTEGER;
```

**File: `src/lib/db/index.ts`** — Add columns to bootstrap CREATE TABLE statements.

### Engine Changes

**Execute route** (`src/app/api/workflows/[id]/execute/route.ts`):
- After the re-run reset block and before the atomic claim, increment `runNumber`
- In the `update` that sets `status: "active"`, also set `runNumber: workflow.runNumber + 1`
- The `WHERE status = 'draft'` guard prevents double-increment on concurrent requests

**Workflow engine** (`src/lib/workflows/engine.ts` — `executeChildTask()`):
- When inserting the task row, stamp `workflowRunNumber: workflow.runNumber`
- Value comes from the workflow row already fetched in `executeChildTask`

**Status API** (`src/app/api/workflows/[id]/status/route.ts`):
- Include `runNumber` in response payload
- Add `runHistory` summary: tasks grouped by `workflowRunNumber` with counts and completion status

Run history query:
```typescript
const runHistory = await db
  .select({
    runNumber: tasks.workflowRunNumber,
    taskCount: count(tasks.id),
    completedCount: sql<number>`SUM(CASE WHEN ${tasks.status} = 'completed' THEN 1 ELSE 0 END)`,
    failedCount: sql<number>`SUM(CASE WHEN ${tasks.status} = 'failed' THEN 1 ELSE 0 END)`,
  })
  .from(tasks)
  .where(eq(tasks.workflowId, workflowId))
  .groupBy(tasks.workflowRunNumber)
  .orderBy(desc(tasks.workflowRunNumber));
```

### UI Changes

**Workflow status view** (`src/components/workflows/workflow-status-view.tsx`):
- "Run #N" badge next to status badge when `runNumber > 0`
- "Run History" collapsible section when `runNumber > 1`, showing previous runs with task counts and completion indicators

**Document picker** (`src/components/shared/document-picker-sheet.tsx`):
- When displaying output documents from workflows with multiple runs, group by "Run #N — [date]"
- For documents with same `originalName`, show version badge and "(latest)" indicator for highest version

### Data Integrity

- Existing workflows get `runNumber = 0` (never run). Next execution sets it to 1.
- Existing tasks get `workflowRunNumber = NULL` — they predate run tracking.
- No data migration needed beyond DDL. Backward compatible.
- Document `version` column continues to work as-is — this feature adds context, not changes.

## Key Files

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Add `runNumber` to workflows, `workflowRunNumber` to tasks |
| `src/lib/db/migrations/XXXX_add_workflow_run_number.sql` | New migration |
| `src/lib/db/index.ts` | Bootstrap: add columns to CREATE TABLE |
| `src/app/api/workflows/[id]/execute/route.ts` | Increment `runNumber` atomically |
| `src/lib/workflows/engine.ts` | Stamp `workflowRunNumber` on child tasks |
| `src/app/api/workflows/[id]/status/route.ts` | Return `runNumber` + `runHistory` |
| `src/components/workflows/workflow-status-view.tsx` | Run # badge + run history section |
| `src/components/shared/document-picker-sheet.tsx` | Run number disambiguation |

### Reusable Patterns

| Pattern | Source | Reuse |
|---------|--------|-------|
| Atomic status claim | `execute/route.ts` (line 58) | Same WHERE guard for runNumber increment |
| Task stamping | `engine.ts` executeChildTask | Add one field to existing insert |
| Collapsible section | `workflow-status-view.tsx` step cards | Same expand/collapse pattern |
| Badge chip | `StatusChip` / `Badge` | Existing badge variant for "Run #N" |

## Acceptance Criteria

- [ ] `runNumber` increments atomically on each workflow execution
- [ ] Tasks created during execution get stamped with current `workflowRunNumber`
- [ ] Re-running a completed/failed workflow increments `runNumber` (doesn't reset to 1)
- [ ] Editing a workflow does NOT change `runNumber` (only execute does)
- [ ] Existing workflows get `runNumber = 0` (backward compatible)
- [ ] Existing tasks get `workflowRunNumber = NULL` (backward compatible)
- [ ] Workflow status view shows "Run #N" badge when runNumber > 0
- [ ] Run history section shows previous runs with task counts when runNumber > 1
- [ ] Document picker shows run number for output documents when multiple runs exist
- [ ] Status API includes `runNumber` and `runHistory` in response
- [ ] Bootstrap creates columns on fresh DB
- [ ] Migration adds columns to existing DB

## Scope Boundaries

**Included:**
- `runNumber` column on workflows table
- `workflowRunNumber` column on tasks table
- Atomic increment on execution
- Run history summary in status API and UI
- Document picker run number disambiguation

**Excluded:**
- Separate `workflow_runs` table (column on workflow is sufficient)
- Run number in document filenames (would break output scanner dedup)
- Archiving/deleting old documents on re-run (keep all, derive "current")
- Document diff between runs (separate feature)
- Schedule → workflow FK (different relationship model)
- Full workflow definition versioning / audit trail (deferred)

## References

- Source: conversation/2026-04-02-entity-relationships — architect + product-manager + frontend-designer consultation
- Related features:
  - `workflow-editing` — edit-in-place resets to draft, this adds run tracking on top
  - `document-output-generation` — output scanning that creates versioned documents
  - `workflow-document-pool` — document picker that benefits from run disambiguation
  - `entity-relationship-detail-views` — consumes run data for document lineage display
