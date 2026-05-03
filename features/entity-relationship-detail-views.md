---
title: Bidirectional Entity Relationship Views
status: completed
shipped-date: 2026-05-03
priority: P2
milestone: post-mvp
source: conversation/2026-04-02-entity-relationships
dependencies:
  - workflow-run-history
  - detail-view-redesign
---

> Verified shipped 2026-05-03 via Tier 2 Ship Verification. All ACs PASS. Document detail uses `document-chip-bar.tsx:134-143` for source-workflow + run-N badges and `document-detail-view.tsx:70,160-163` for version history; tasks have Related Tasks via `task-detail-view.tsx:103-110` + `/api/tasks/[id]/siblings`; projects show Recent Documents at `app/projects/[id]/page.tsx:43-60,170-186`; workflow detail has project link badge at `workflows/shared/workflow-header.tsx:13,66-68`. Implementation uses existing chip-bar + section-heading patterns rather than a dedicated `RelationshipSection` component (initial grep missed it for that reason).

# Bidirectional Entity Relationship Views

## Description

Detail views currently show hierarchical parent links (task → workflow, document → task) but lack reverse and lateral relationship navigation. A user viewing a document cannot see which workflow produced it without mentally tracing task → workflow. A user viewing a task cannot see sibling tasks from the same workflow run. A user viewing a project sees workflows and tasks but no document count or recent documents.

This feature adds relationship sections to all four primary detail views (document, task, project, workflow) using inline sections with the existing `SectionHeading` component pattern. Each relationship is a clickable link enabling bidirectional navigation across the entity graph.

## User Stories

**Document Reviewer (Emily):** As a user reviewing an output document, I want to see which workflow and run produced it, and browse other versions of the same document, so I can understand its lineage and compare results.

**Workflow Monitor (Marcus):** As a user watching a workflow execute, I want to see the project it belongs to and navigate there with one click, so I can check other workflows in the same project.

**Task Inspector (Alex):** As a user debugging a failed task in a multi-step workflow, I want to see sibling tasks from the same run, so I can check which steps succeeded and which failed.

**Project Manager (Priya):** As a user reviewing project health, I want to see document counts and recent documents alongside workflows and tasks, so I have a complete picture of project output.

## Technical Approach

### Document Detail — Workflow Source + Version History

**Extend `DocumentWithRelations` type:**

Add fields to the document data type (wherever it's defined, likely inferred or in a types file):
```typescript
workflowId?: string | null;
workflowName?: string | null;
workflowRunNumber?: number | null;
```

**API: Join through tasks → workflows** (`src/app/api/documents/route.ts` and `src/app/api/documents/[id]/route.ts`):
- LEFT JOIN tasks on `documents.taskId = tasks.id`
- LEFT JOIN workflows on `tasks.workflowId = workflows.id`
- Select `workflows.id` as `workflowId`, `workflows.name` as `workflowName`, `tasks.workflowRunNumber`

**Workflow source badge** (`src/components/documents/document-chip-bar.tsx`):
- Add a row showing `GitBranch` icon + workflow name as clickable badge linking to `/workflows/{workflowId}`
- If `workflowRunNumber` exists, append "Run #N" chip
- Only shown when `workflowId` is non-null (i.e., document was produced by a workflow task)

**Version history section** (`src/components/documents/document-detail-view.tsx`):
- New section below chip bar, only shown for output documents
- Heading: "Version History"

**New API endpoint: `GET /api/documents/[id]/versions`** (new route):
```typescript
// Find all documents with same originalName + projectId + direction=output
const versions = await db
  .select({
    id: documents.id,
    version: documents.version,
    size: documents.size,
    createdAt: documents.createdAt,
  })
  .from(documents)
  .where(and(
    eq(documents.originalName, doc.originalName),
    eq(documents.projectId, doc.projectId),
    eq(documents.direction, "output")
  ))
  .orderBy(desc(documents.version));
```

Display: compact list — each row shows version number, file size, relative timestamp, and "(current)" badge for highest version. Each row is clickable, navigating to that version's detail view.

### Task Detail — Sibling Tasks

**New section** in `src/components/tasks/task-detail-view.tsx`:
- Section heading: "Related Tasks" (or "Workflow Steps")
- Only shown when task has `workflowId` AND `workflowRunNumber`
- Lists sibling tasks from the same workflow run, excluding the current task

**New API endpoint: `GET /api/tasks/[id]/siblings`** (new route):
```typescript
const siblings = await db
  .select({
    id: tasks.id,
    title: tasks.title,
    status: tasks.status,
  })
  .from(tasks)
  .where(and(
    eq(tasks.workflowId, task.workflowId),
    eq(tasks.workflowRunNumber, task.workflowRunNumber),
    ne(tasks.id, taskId)
  ))
  .orderBy(tasks.createdAt);
```

Display: compact vertical list with status dot (color from `status-colors.ts`), title (clickable → task detail), and step sequence implied by order.

### Project Detail — Document Count + Recent Documents

**Document count** in `src/app/projects/[id]/page.tsx`:
- Add to existing server component queries:
```typescript
const [{ count: docCount }] = await db
  .select({ count: count(documents.id) })
  .from(documents)
  .where(eq(documents.projectId, id));
```
- Append "· N documents" to the existing summary line (after task/workflow counts)

**Recent documents section** — new card below environment summary:
```typescript
const recentDocs = await db
  .select({
    id: documents.id,
    originalName: documents.originalName,
    direction: documents.direction,
    version: documents.version,
    size: documents.size,
    createdAt: documents.createdAt,
  })
  .from(documents)
  .where(eq(documents.projectId, id))
  .orderBy(desc(documents.createdAt))
  .limit(5);
```

Display: compact list with file icon, document name (clickable → document detail), direction badge (input/output), version badge (output only), relative timestamp. Footer: "View all documents →" link to `/documents?projectId={id}`.

### Workflow Detail — Project Link + Run Badge

**Project link badge** in `src/components/workflows/workflow-status-view.tsx`:
- Add `FolderKanban` badge in header area linking to `/projects/{projectId}`
- Matches existing pattern from task-chip-bar.tsx
- Only shown when `projectId` is non-null

**Run # badge** — already specified in `workflow-run-history` feature. This feature consumes it.

## Key Files

| File | Change |
|------|--------|
| `src/app/api/documents/route.ts` | Join tasks → workflows for workflowId/Name |
| `src/app/api/documents/[id]/route.ts` | Same join for single document fetch |
| `src/app/api/documents/[id]/versions/route.ts` | NEW: version history endpoint |
| `src/app/api/tasks/[id]/siblings/route.ts` | NEW: sibling tasks endpoint |
| `src/components/documents/document-chip-bar.tsx` | Workflow source badge |
| `src/components/documents/document-detail-view.tsx` | Version history section |
| `src/components/tasks/task-detail-view.tsx` | Sibling tasks section |
| `src/app/projects/[id]/page.tsx` | Document count + recent docs |
| `src/components/workflows/workflow-status-view.tsx` | Project link badge |

### Reusable Components

| Component | Path | Reuse |
|---------|------|-------|
| `SectionHeading` | `src/components/shared/section-heading.tsx` | Section headers for all new sections |
| `Badge` | shadcn/ui | Clickable entity link badges |
| `StatusChip` | `src/components/shared/status-chip.tsx` | Status dots on sibling tasks |
| `GitBranch` / `FolderKanban` icons | lucide-react | Relationship type indicators |
| `formatRelativeTime` | existing utility | Relative timestamps on version history |

## Acceptance Criteria

- [x] Document detail shows source workflow badge with clickable link to workflow
- [x] Document detail shows "Run #N" chip when workflow run number is available
- [x] Document detail shows version history section for output documents
- [x] Version history sorted newest-first with "(current)" indicator on highest version
- [x] Version history rows are clickable, navigating to that version's detail
- [x] Version history section hidden for input documents and uploaded documents
- [x] Task detail shows "Related Tasks" section with sibling tasks from same workflow run
- [x] Sibling tasks show status dots and clickable titles
- [x] Sibling tasks section hidden when task is standalone (no workflowId/workflowRunNumber)
- [x] Project detail shows document count in summary line
- [x] Project detail shows 5 most recent documents with file icon, name, direction, version
- [x] Project detail "View all documents" links to filtered documents page
- [x] Workflow detail shows project link badge when projectId exists
- [x] All relationship links navigate correctly to target entity detail views
- [x] New API endpoints return correct data with proper error handling

## Scope Boundaries

**Included:**
- Workflow source badge on document detail (via task → workflow join)
- Version history section on document detail (same originalName + projectId)
- Sibling tasks section on task detail (same workflowId + workflowRunNumber)
- Document count + recent documents on project detail
- Project link badge on workflow detail
- Two new API endpoints (versions, siblings)

**Excluded:**
- Schedule → workflow relationship display (schedules don't FK to workflows, defer)
- Parent/child task relationships (no FK exists between tasks)
- Document lineage graph visualization (deferred to workflow-document-pool Phase 5)
- Cross-project entity navigation
- Full entity timeline/activity feed
- Notification relationship links (already handled in detail-view-redesign)

## References

- Source: conversation/2026-04-02-entity-relationships — frontend-designer consultation
- Related features:
  - `workflow-run-history` — provides runNumber/workflowRunNumber data this feature displays
  - `detail-view-redesign` — established the bento grid / chip bar / prose reader patterns this extends
  - `relationship-summary-cards` — companion feature for card-level summaries
  - `workflow-document-pool` — benefits from improved document lineage navigation
