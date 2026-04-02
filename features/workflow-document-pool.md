---
title: Workflow Document Pool
status: planned
priority: P1
milestone: post-mvp
source: plans/kind-mapping-turing.md
dependencies:
  - workflow-engine
  - file-attachment-data-layer
  - document-preprocessing
  - agent-document-context
  - document-output-generation
  - workflow-ux-overhaul
---

# Workflow Document Pool

## Description

Enable intuitive document handoff between workflows via a project-level document pool. When a workflow completes and produces output documents, those documents become available in the project pool for any subsequent workflow to consume as inputs. Users can explicitly select documents from the pool when creating workflows, or the system can auto-discover relevant documents based on selectors and prompt keyword matching.

Currently, chaining workflows requires users to manually look up document IDs via chat and paste them into workflow definitions — a 3-step manual process. This feature replaces that with a visual document picker in the workflow form, an "Output Dock" on completed workflows for one-click chaining, and smart chat tools that auto-discover relevant documents when creating follow-up workflows.

The architecture uses a junction table (`workflow_document_inputs`) for deterministic execution bindings, paired with a `DocumentSelector` resolution layer for intelligent auto-discovery at creation time. This separation ensures execution is always predictable while creation is smart and assistive.

## User Stories

**Beginner (Emily):** As a first-time user who just completed a research workflow, I want to see its output documents available when I create a follow-up workflow, so I can chain them without knowing document IDs.

**Power User (Marcus):** As a power user running 10+ workflows weekly, I want to wire specific output documents from Workflow A into specific steps of Workflow B, so each step gets only the context it needs.

**Automation User (Priya):** As a user who creates workflows via chat, I want the AI to automatically discover relevant documents from the project pool and suggest them, so I don't have to manually look up or reference document IDs.

## Technical Approach

### Phase 1: Data Model + Engine (Foundation)

**New junction table** — `workflow_document_inputs`:
- `id` TEXT PK, `workflowId` TEXT FK → workflows, `documentId` TEXT FK → documents
- `stepId` TEXT (null = available to all steps), `createdAt` INTEGER timestamp
- Indexes on workflowId and documentId for bidirectional queries
- Unique index on (workflowId, documentId, stepId) to prevent duplicates

**Type additions** in `src/lib/workflows/types.ts`:
- Add `documentIds?: string[]` to `WorkflowStep` (form-state convenience, resolved to junction rows on save)
- Add `DocumentSelector` interface for auto-discovery declarations

**New document resolver** — `src/lib/documents/document-resolver.ts`:
- `resolveDocumentSelector(projectId, selector)` queries project pool, returns matching documents
- Supports filters: fromWorkflowId, fromWorkflowName, category, direction, mimeType, namePattern, latest

**Context builder addition** — `src/lib/documents/context-builder.ts`:
- New `buildPoolDocumentContext(workflowId, stepId?)` function
- Queries junction table for matching documents, formats with existing `formatDocument()` pattern
- Respects 30KB context cap, same as `buildWorkflowDocumentContext()`

**Engine integration** — `src/lib/workflows/engine.ts`:
- `executeChildTask()` gains stepId parameter
- After existing `buildWorkflowDocumentContext(parentTaskId)`, also calls `buildPoolDocumentContext(workflowId, stepId)`
- Pool context is appended to the enriched prompt (after parent doc context, before step prompt)

**Bootstrap + migration** — standard pattern:
- Migration SQL file creates table
- `src/lib/db/index.ts` bootstrap adds CREATE IF NOT EXISTS
- `src/lib/data/clear.ts` adds delete in FK-safe order (before workflows, before documents)

### Phase 2: Workflow Form UX (Input Tray + Output Dock)

**Input Tray** — New `FormSectionCard` in `workflow-form-view.tsx`:
- "Input Documents" section between project selector and steps editor
- "Attach Documents" button opens a `DocumentPickerSheet` (new component)
- `DocumentPickerSheet` reuses `DocumentTable` internals with checkbox selection, filtered to active project
- Documents grouped by source: "From [Workflow Name]" / "Uploaded" / "Agent Generated"
- Selected documents appear as removable chip badges (reuse `DocumentChipBar` pattern)
- Per-step document binding: each step card gets an optional "Step Documents" collapsible section
- Three tiers: auto-selected (pre-checked via selector), suggested (highlighted via keyword match), available

**Output Dock** — Extension to `workflow-status-view.tsx`:
- On completed workflows, output documents section shows selectable cards with checkboxes
- Each card: file icon, name, size, version badge
- "Chain Into New Workflow" button navigates to `/workflows/new?inputDocs=id1,id2,id3`
- Workflow form reads `inputDocs` URL params to pre-populate Input Tray

**API route** — `src/app/api/workflows/[id]/documents/route.ts`:
- GET: list document bindings for a workflow (with document metadata)
- POST: attach document IDs to a workflow (with optional stepId scoping)
- DELETE: remove a document binding

### Phase 3: Chat Intelligence (Smart Wiring)

**Enhanced `create_workflow` tool** — accepts optional `documentIds` array:
- After inserting workflow row, inserts corresponding `workflow_document_inputs` rows
- Validates that referenced document IDs exist and belong to the same project

**New `find_related_documents` tool**:
- Parameters: projectId, query (text), direction?, sourceWorkflowId?, limit?
- Queries output documents from completed workflows in the project
- Matches by document name, category, and source workflow name
- Returns document list with metadata for the AI to present to the user

**System prompt enhancement**:
- Instruct AI to proactively call `find_related_documents` when creating follow-up workflows
- Instruct AI to mention output documents by name after workflow execution completes
- Instruct AI to suggest "Chain Into New Workflow" when output documents are available

## Acceptance Criteria

### Phase 1: Data + Engine
- [ ] `workflow_document_inputs` table exists with FK constraints and indexes
- [ ] Creating a workflow with document IDs persists bindings in junction table
- [ ] Executing a workflow with pool documents injects their content into step prompts
- [ ] Per-step document scoping works: step-specific docs only injected into that step
- [ ] Workflow-level docs (stepId=null) injected into all steps
- [ ] Existing workflows without document bindings execute unchanged (backward compatible)
- [ ] Pool document context respects 30KB cap
- [ ] `resolveDocumentSelector()` correctly filters by all selector fields
- [ ] Bootstrap creates table on fresh DB; migration applies on existing DB
- [ ] `clear.ts` deletes junction table rows in FK-safe order

### Phase 2: Form UX
- [ ] Workflow form shows "Input Documents" section with attach button
- [ ] Document picker sheet displays project documents grouped by source
- [ ] Selected documents appear as removable chips in the Input Tray
- [ ] Per-step document selection available via collapsible section on each step card
- [ ] Output Dock on completed workflow shows selectable output document cards
- [ ] "Chain Into New Workflow" navigates with inputDocs URL params
- [ ] Workflow form pre-populates Input Tray from URL params
- [ ] Saving workflow persists document bindings via POST to documents API

### Phase 3: Chat
- [ ] `create_workflow` tool accepts and persists documentIds
- [ ] `find_related_documents` tool discovers output docs from completed project workflows
- [ ] AI proactively suggests documents when creating follow-up workflows
- [ ] AI mentions output documents after workflow completion

## Scope Boundaries

**Included:**
- Junction table for workflow-document bindings (per-workflow and per-step)
- Document picker UI in workflow form (Input Tray)
- Output dock on completed workflow status page
- Document selector type for auto-discovery at creation time
- Chat tool enhancements for smart document wiring
- URL-based document pre-population for workflow chaining

**Excluded:**
- `@doc:` inline mentions in step prompts (deferred — Phase 4)
- Persistent context shelf sidebar in workflow form (deferred — Phase 4)
- Dynamic document references resolved at execution time (deferred — Phase 4)
- Workflow completion triggers / automatic chaining (deferred — Phase 4)
- Document lineage graph / Flow Trail visualization (deferred — Phase 5)
- Pipeline canvas / drag-and-drop builder (deferred — Phase 5)
- Multi-workflow pipeline templates with document slots (deferred — Phase 5)
- Cross-project document sharing
- Semantic search over document content (vector embeddings)
- Document diff between workflow runs

## References

- Source: `plans/kind-mapping-turing.md` — brainstorming results with PM, Architect, and Frontend Designer perspectives
- Related features:
  - `workflow-engine` — core execution engine this extends
  - `agent-document-context` — existing document context builder this builds on
  - `document-output-generation` — output documents that populate the pool
  - `workflow-ux-overhaul` — workflow form this extends
  - `workflow-blueprints` — blueprints could declare document slot expectations (future)

### Key Files to Modify

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Add `workflowDocumentInputs` table |
| `src/lib/db/migrations/0017_*.sql` | CREATE TABLE migration |
| `src/lib/db/index.ts` | Bootstrap CREATE IF NOT EXISTS |
| `src/lib/data/clear.ts` | Add delete for junction table |
| `src/lib/workflows/types.ts` | Add `documentIds` to WorkflowStep, add `DocumentSelector` |
| `src/lib/documents/document-resolver.ts` | NEW: `resolveDocumentSelector()` |
| `src/lib/documents/context-builder.ts` | Add `buildPoolDocumentContext()` |
| `src/lib/workflows/engine.ts` | Pass stepId, call pool context builder |
| `src/components/workflows/workflow-form-view.tsx` | Add Input Tray section |
| `src/components/workflows/workflow-status-view.tsx` | Add Output Dock |
| `src/components/workflows/document-picker-sheet.tsx` | NEW: document selection sheet |
| `src/app/api/workflows/[id]/documents/route.ts` | NEW: GET/POST/DELETE for bindings |
| `src/lib/chat/tools/workflow-tools.ts` | Enhance create_workflow, add find_related_documents |

### Reusable Components

| Component | Path | Reuse |
|-----------|------|-------|
| `DocumentChipBar` | `src/components/documents/document-chip-bar.tsx` | Chip badges for selected docs |
| `DocumentTable` | `src/components/documents/document-table.tsx` | Selection UI internals for picker |
| `FormSectionCard` | Workflow form pattern | Container for Input Tray |
| `buildDocumentContext()` | `src/lib/documents/context-builder.ts` | `formatDocument()` reuse |
| `BlueprintVariable type: "file"` | `src/lib/workflows/blueprints/types.ts` | Already anticipates doc slots |
