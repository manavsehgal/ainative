---
title: Agent Document API Access
status: pending
priority: P2
layer: Platform
dependencies:
  - document-preprocessing
  - file-attachment-data-layer
  - tool-permission-persistence
source: ideas/ai-native-book-strategy.md
---

# Agent Document API Access

## Description

Agents currently have read-only access to documents (`list_documents`, `get_document`), creating a gap in the autonomy loop: agents can generate task outputs but cannot persist them as documents without user UI interaction. This feature extends Stagent's agent tools to include document mutations (`upload_document`, `update_document`, `delete_document`), enabling agents to manage documents independently. The implementation reuses the existing permission system and adds new API routes that respect task/project context and cascade-delete safety.

## User Story

As an agent, I want to upload files I generate as documents so that my outputs are automatically registered in the Documents library without requiring manual UI interaction.

As a user, I want my agents to create documents autonomously while respecting permission boundaries and audit trails, so I can trust document management workflows.

## Technical Approach

### Three New Stagent Tools

#### 1. `upload_document`
Creates a document from a file on the agent's filesystem.

**Parameters:**
- `file_path` (string, required) — Absolute path to file
- `taskId` (string, optional) — Associate with a task
- `projectId` (string, optional) — Associate with a project
- `direction` (enum: "input" | "output", optional) — Default: "output" for agent-generated files
- `metadata` (object, optional) — Custom key-value pairs for indexing

**Returns:**
```json
{
  "documentId": "doc-abc123",
  "status": "uploaded",
  "processingStatus": "queued"
}
```

**Behavior:**
- Validates file exists and is readable
- Copies file to `~/.stagent/uploads/` (or references existing copy)
- Creates database record in `documents` table with `direction`, `taskId`, `projectId`
- Triggers async preprocessing (text extraction, format detection)
- Emits notification if associated task/project specified

#### 2. `update_document`
Modifies document metadata or triggers reprocessing.

**Parameters:**
- `documentId` (string, required)
- `metadata` (object, optional) — Merged into existing metadata (not replaced)
- `reprocess` (boolean, optional) — If true, clear extracted fields and re-run preprocessing

**Returns:**
```json
{
  "documentId": "doc-abc123",
  "updated_fields": ["metadata.status", "processingStatus"],
  "processingStatus": "queued"
}
```

#### 3. `delete_document`
Removes a document and optionally cascade-deletes task associations.

**Parameters:**
- `documentId` (string, required)
- `cascadeDelete` (boolean, optional) — If false and document is linked to tasks, returns error listing tasks; if true, removes links then deletes

**Returns:**
```json
{
  "success": true,
  "message": "Document deleted. Task links removed: [task-1, task-2]"
}
```

### API Routes

Add three new routes to `src/app/api/documents/`:

| Route | Method | Purpose | Input |
|-------|--------|---------|-------|
| `/api/documents` | POST | Upload document | `{ file_path, taskId?, projectId?, direction?, metadata? }` |
| `/api/documents/[id]` | PATCH | Update metadata/reprocess | `{ metadata?, reprocess? }` |
| `/api/documents/[id]` | DELETE | Delete with cascade safety | `{ cascadeDelete? }` |

### Tool Registry Integration

Update `src/lib/agents/tools-registry.ts`:
- Add three new tools with descriptions (so Claude knows when to invoke)
- Route through `canUseTool` permission pre-check (reuse existing system from `tool-permission-persistence`)
- Auto-approve document mutations for "document:*" patterns; default-deny until user approves

### Permissions Model

Extend `src/lib/settings/permissions.ts`:
- Add permission patterns: `"Stagent(tool:upload_document)"`, `"Stagent(tool:delete_document)"`, etc.
- Agent execution context includes task/project ID — validate document mutations against task ownership
- Audit log entry: agent ID, tool, documentId, result, timestamp

### Key Design Decisions

**File paths, not bytes**: Agents pass absolute paths (simpler API, consistent with existing agent patterns). Agents run server-side; filesystem access is native.

**Separate tools, not unified mutate**: Explicit intent reduces accidental deletions; clearer for LLM reasoning; granular permission control.

**Direction field**: Distinguishes "reference documents I read" (input) from "work products I created" (output). Enables filtering in UI. Audit clarity.

**Explicit cascade deletes**: Agents must opt-in to cascade deletion. Prevents accidental loss of task-linked documents. Error message tells agent which tasks depend on the document.

**Metadata merge, not replace**: Agents can augment metadata (e.g., `{ chapter: 1, draft: false }`) without wiping user-added fields.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/documents/route.ts` | POST (upload) + other handlers |
| `src/app/api/documents/[id]/route.ts` | PATCH (update) + DELETE |
| `src/lib/agents/tools-registry.ts` | Register three new tools with descriptions |
| `src/lib/settings/permissions.ts` | Add "document:*" permission types |
| `src/lib/documents/output-scanner.ts` | Reuse for auto-upload output files (future) |

## Acceptance Criteria

- [ ] `upload_document` tool accepts file_path + optional taskId/projectId/metadata
- [ ] `update_document` tool merges metadata without replacing existing fields
- [ ] `delete_document` tool requires explicit cascadeDelete flag if document linked to tasks
- [ ] All document mutations go through `canUseTool` permission check
- [ ] Agents can auto-approve "document:*" patterns with "Always Allow"
- [ ] API validates file exists, copies to `~/.stagent/uploads/`, creates DB record
- [ ] Async preprocessing triggered (reuse `processDocument` from document-preprocessing)
- [ ] All mutations audited in `agent_logs` with agent ID, timestamp, document ID
- [ ] Task detail view shows output documents separately from input attachments (reuses `document-output-generation`)
- [ ] Document Manager filters by direction ("input" / "output")
- [ ] Integration test: agent generates file → calls upload_document → document appears in Documents list

## Scope Boundaries

**Included:**
- Three new Stagent tools (upload, update, delete)
- API routes with permission guards and cascade-delete safety
- Task/project context validation
- Audit logging in agent_logs
- Integration with existing `tool-permission-persistence` system

**Excluded:**
- Real-time file watching during task execution (separate stream-to-document feature)
- Document versioning UI (version tracking in metadata only)
- Collaboration locks during agent editing
- Webhooks triggered by document mutations
- Binary output formats (images, PDFs) — same scope as `document-preprocessing`
- S3/cloud storage — uses local `~/.stagent/uploads/` only

## References

- Related: [`document-preprocessing`](document-preprocessing.md) — text extraction, format detection, metadata indexing
- Related: [`file-attachment-data-layer`](file-attachment-data-layer.md) — documents table schema
- Related: [`document-output-generation`](document-output-generation.md) — auto-scans task output directories
- Related: [`tool-permission-persistence`](tool-permission-persistence.md) — "Always Allow" button, pre-check guards
- Consumer: AI-Native Book workflow — agents write chapters → upload directly to Documents
- Execution: `src/lib/agents/claude-agent.ts` + Agent SDK `canUseTool` pattern
