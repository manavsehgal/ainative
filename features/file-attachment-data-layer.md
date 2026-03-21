---
title: File Attachment Data Layer
status: completed
priority: P1
milestone: post-mvp
source: features/content-handling.md
dependencies:
  - content-handling
---

# File Attachment Data Layer

## Description

Fix the broken file-to-task linking pipeline. Currently, files upload to `~/.stagent/uploads/` successfully but are never associated with tasks — `fileIds` sent by the client are silently stripped by Zod validation. This feature adds a `documents` table, wires file IDs through task creation, and displays attachments in the task detail view.

No new npm dependencies required.

## User Story

As a user, I want my uploaded files to actually be linked to the tasks I create, so that I can see which files are attached to each task and manage them properly.

## Technical Approach

### Data Layer

- **New `documents` table**: id, taskId, projectId, filename, originalName, mimeType, size, storagePath, direction (input/output), category, status, createdAt, updatedAt
- **Bootstrap DDL** in `src/lib/db/index.ts` for self-healing startup
- **Migration** `0004_add_documents.sql` for existing databases
- **`DocumentRow` type** exported from schema

### Validation Fix

- `createTaskSchema` in `src/lib/validators/task.ts` gains optional `fileIds: z.array(z.string())`
- `POST /api/tasks` associates uploaded files with the newly created task by updating document records

### API

- `GET /api/uploads/[id]` — serves files (already partially exists)
- `DELETE /api/uploads/[id]` — removes file from filesystem + DB record

### UI

- Task detail panel shows attached documents with file type icons
- New `TaskAttachments` component for listing/managing attachments

### Maintenance

- Orphan cleanup utility for unlinked uploads older than 24 hours

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | Add documents table definition |
| `src/lib/db/index.ts` | Add bootstrap DDL |
| `src/lib/db/migrations/0004_add_documents.sql` | Migration for existing DBs |
| `src/lib/validators/task.ts` | Add fileIds to createTaskSchema |
| `src/app/api/tasks/route.ts` | Wire fileIds to document associations |
| `src/components/tasks/task-detail-panel.tsx` | Show attachments section |
| `src/components/tasks/task-attachments.tsx` | New attachment list component |

## Acceptance Criteria

- [ ] New `documents` table with columns: id, taskId, projectId, filename, originalName, mimeType, size, storagePath, direction, category, status, createdAt, updatedAt
- [ ] Bootstrap DDL in `src/lib/db/index.ts` creates documents table on startup
- [ ] Migration `0004_add_documents.sql` exists and is correct
- [ ] `DocumentRow` type exported from `src/lib/db/schema.ts`
- [ ] `createTaskSchema` accepts optional `fileIds: z.array(z.string())`
- [ ] `POST /api/tasks` associates documents with task after creation
- [ ] `GET /api/uploads/[id]` serves uploaded files
- [ ] `DELETE /api/uploads/[id]` removes file + DB record
- [ ] Task detail view shows attached documents with file type icons
- [ ] Orphan cleanup for unlinked uploads older than 24 hours

## Scope Boundaries

**Included:**
- Documents table and schema types
- File-to-task linking on task creation
- File serving and deletion APIs
- Attachment display in task detail
- Orphan file cleanup

**Excluded:**
- Document preprocessing or text extraction (see document-preprocessing)
- Document browser UI (see document-manager)
- Agent access to documents (see agent-document-context)
- Output file tracking (see document-output-generation)
