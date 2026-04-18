---
title: Agent Document API Access
status: completed
priority: P2
milestone: post-mvp
dependencies:
  - document-preprocessing
  - file-attachment-data-layer
  - tool-permission-persistence
source: ideas/ai-native-book-strategy.md
---

# Agent Document API Access

## Description

Agents currently have read-only access to documents (`list_documents`, `get_document`), creating a gap in the autonomy loop: agents can generate task outputs but cannot persist them as documents without user UI interaction. This feature extends ainative's agent tools to include document mutations (`upload_document`, `update_document`, `delete_document`), enabling agents to manage documents independently. The implementation reuses the existing permission system and adds new API routes that respect task/project context and cascade-delete safety.

## User Story

As an agent, I want to upload files I generate as documents so that my outputs are automatically registered in the Documents library without requiring manual UI interaction.

As a user, I want my agents to create documents autonomously while respecting permission boundaries and audit trails, so I can trust document management workflows.

## Technical Approach

### Three New ainative Tools

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
- Copies file to `~/.ainative/uploads/` (or references existing copy)
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

PATCH and DELETE already exist at `src/app/api/documents/[id]/route.ts` — they will be extended. POST is new.

| Route | Method | Status | Changes |
|-------|--------|--------|---------|
| `/api/documents` | POST | **New** | Server-side upload from `file_path` (distinct from user-facing `/api/uploads/` multipart flow) |
| `/api/documents/[id]` | PATCH | **Extend** | Add `metadata` merge + `reprocess` flag (currently only handles `taskId`, `projectId`, `category`) |
| `/api/documents/[id]` | DELETE | **Extend** | Add `cascadeDelete` safety check (currently deletes unconditionally) |

### Tool Registration (MCP Server Pattern)

Tools are defined in `src/lib/chat/tools/document-tools.ts` as functions returning `tool()` arrays from `@anthropic-ai/claude-agent-sdk`, assembled into the ainative MCP server via `src/lib/chat/ainative-tools.ts`. The existing `document-tools.ts` already has `list_documents` and `get_document` — extend it with the three new mutation tools.

Each tool definition includes a description string that Claude uses to decide when to invoke the tool, input schema via Zod, and an async handler function.

### Permission Gating

Add the three new tool names to the `PERMISSION_GATED_TOOLS` set in `src/lib/chat/engine.ts` (line 199):

```typescript
const PERMISSION_GATED_TOOLS = new Set([
  "mcp__stagent__execute_task",
  "mcp__stagent__cancel_task",
  // ... existing entries
  "mcp__stagent__upload_document",   // NEW
  "mcp__stagent__update_document",   // NEW
  "mcp__stagent__delete_document",   // NEW
]);
```

Non-gated `mcp__stagent__*` tools auto-approve (line 206). Gated tools trigger the `canUseTool` → notification → user approval flow. Users can "Always Allow" via patterns like `"mcp__stagent__upload_document"` stored in the settings table.

Audit log entry: agent ID, tool, documentId, result, timestamp — via existing `agent_logs` table.

### Key Design Decisions

**File paths, not bytes**: Agents pass absolute paths (simpler API, consistent with existing agent patterns). Agents run server-side; filesystem access is native.

**Separate tools, not unified mutate**: Explicit intent reduces accidental deletions; clearer for LLM reasoning; granular permission control.

**Direction field**: Distinguishes "reference documents I read" (input) from "work products I created" (output). Enables filtering in UI. Audit clarity.

**Explicit cascade deletes**: Agents must opt-in to cascade deletion. Prevents accidental loss of task-linked documents. Error message tells agent which tasks depend on the document.

**Metadata merge, not replace**: Agents can augment metadata (e.g., `{ chapter: 1, draft: false }`) without wiping user-added fields.

### Output Scanner Relationship

`src/lib/documents/output-scanner.ts` already auto-scans task output directories after execution and creates document records for files found there. The new `upload_document` tool provides a complementary **programmatic** path — agents can explicitly register documents during execution rather than relying on post-execution filesystem scanning. Both paths coexist: auto-scan catches files agents write to disk without explicit upload; `upload_document` gives agents intentional control over what gets registered and with what metadata.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/chat/tools/document-tools.ts` | Add 3 new tool definitions alongside existing `list_documents` / `get_document` |
| `src/lib/chat/engine.ts` | Add 3 tool names to `PERMISSION_GATED_TOOLS` set (line 199) |
| `src/app/api/documents/route.ts` | Add POST handler for server-side file upload |
| `src/app/api/documents/[id]/route.ts` | Extend PATCH (metadata merge, reprocess) + DELETE (cascade check) |
| `src/lib/chat/ainative-tools.ts` | Reference — assembles tool arrays into MCP server |
| `src/lib/documents/output-scanner.ts` | Reference — complementary auto-scan path for output documents |

## Acceptance Criteria

- [ ] `upload_document` tool accepts file_path + optional taskId/projectId/metadata
- [ ] `update_document` tool merges metadata without replacing existing fields
- [ ] `delete_document` tool requires explicit cascadeDelete flag if document linked to tasks
- [ ] All document mutations gated via `PERMISSION_GATED_TOOLS` in `engine.ts`
- [ ] Agents can "Always Allow" via `mcp__stagent__upload_document` pattern in settings
- [ ] API validates file exists, copies to `~/.ainative/uploads/`, creates DB record
- [ ] Async preprocessing triggered (reuse `processDocument` from document-preprocessing)
- [ ] All mutations audited in `agent_logs` with agent ID, timestamp, document ID
- [ ] Task detail view shows output documents separately from input attachments (reuses `document-output-generation`)
- [ ] Document Manager filters by direction ("input" / "output")
- [ ] Integration test: agent generates file → calls upload_document → document appears in Documents list

## Scope Boundaries

**Included:**
- Three new ainative tools (upload, update, delete)
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
- S3/cloud storage — uses local `~/.ainative/uploads/` only

## References

- Related: [`document-preprocessing`](document-preprocessing.md) — text extraction, format detection, metadata indexing
- Related: [`file-attachment-data-layer`](file-attachment-data-layer.md) — documents table schema
- Related: [`document-output-generation`](document-output-generation.md) — auto-scans task output directories
- Related: [`tool-permission-persistence`](tool-permission-persistence.md) — "Always Allow" button, pre-check guards
- Consumer: AI-Native Book workflow — agents write chapters → upload directly to Documents
- Execution: `src/lib/agents/claude-agent.ts` + Agent SDK `canUseTool` pattern
