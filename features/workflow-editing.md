---
title: Workflow Editing (Post-Execution)
status: completed
shipped-date: 2026-05-03
priority: P1
milestone: post-mvp
source: conversation
dependencies: [workflow-engine]
---

> Verified shipped 2026-05-03 via Ship Verification on prior `planned` drift. All 11 ACs PASS — Edit button visibility at `shared/workflow-header.tsx:92` + `workflow-list.tsx:213`; reset-to-draft at `api/workflows/[id]/route.ts:50-56`; state cleanup strips `_state`/`_loopState` per spec.

# Workflow Editing (Post-Execution)

## Description

Currently, workflows can only be edited while in "draft" status. Once a workflow is executed (transitioning to active → completed or failed), the definition becomes permanently read-only. Users must either re-run the exact same workflow or clone it into a disconnected copy to make changes.

This feature enables **edit-in-place** for completed and failed workflows. When a user edits a non-draft workflow, the system resets it to draft status (clearing execution state) so they can tweak prompts, adjust steps, change agent profiles, and re-execute — all within the same workflow entity, preserving its identity and document bindings.

This is the most natural iteration loop: run → review results → tweak → re-run. Clone remains available for users who want to preserve the original.

## User Story

As a workflow creator, I want to edit my completed or failed workflows so that I can iterate on prompts and step configurations based on execution results, without creating disconnected copies.

## Technical Approach

### API: Expand PATCH guard to allow completed/failed workflows

**File:** `src/app/api/workflows/[id]/route.ts` (lines 38-45)

The current guard rejects all edits when `status !== "draft"`. Change to:
- Allow edits when status is `draft`, `completed`, or `failed`
- Reject edits for `active` (running) and `paused` (could resume mid-flight) workflows
- When editing a `completed` or `failed` workflow, atomically reset status to `draft` in the same UPDATE statement
- Strip `_state` and `_loopState` from the stored definition as defense-in-depth (the form already builds a clean definition from state variables, but direct API callers could pass stale state)

The state-cleanup pattern is already proven in `src/app/api/workflows/[id]/execute/route.ts` (lines 31-53) where re-run does the identical reset.

### UI: Show Edit button for completed/failed workflows

**File:** `src/components/workflows/workflow-status-view.tsx` (line 336)

Expand the Edit button's visibility condition from `data.status === "draft"` to include `completed` and `failed`. The button already navigates to `/workflows/${workflowId}/edit`, and the edit page has no status guard — it fetches the workflow and populates the form regardless of status.

**File:** `src/components/workflows/workflow-list.tsx` (line 191)

Same change in the list card view — expand the Edit (pencil) button's visibility from `wf.status === "draft"` to include `completed` and `failed`.

### Form: No changes needed

The `WorkflowFormView` component (1599 lines) builds the PATCH definition entirely from form state variables (`pattern`, `steps`, `loopConfig`, `swarmConfig`), not from the raw parsed JSON. The `parseDefinition()` helper at line 83 does return `_state`/`_loopState` from the stored JSON, but the `useEffect` at line 432 only reads `.pattern`, `.steps`, `.loopConfig`, `.swarmConfig` — the execution state is naturally excluded.

### What Does NOT Change

- **Execute route** — Already handles draft workflows. After edit resets status to draft, normal execute flow works.
- **Database schema** — No new columns, tables, or migrations. Old task records remain linked by workflowId FK as historical artifacts.
- **Workflow engine** — State cleanup happens at the API level. Engine always works with clean definitions.
- **Edit page** (`src/app/workflows/[id]/edit/page.tsx`) — Has no status guard. Works as-is.
- **Clone flow** — Unchanged. Remains available for users who want a disconnected copy.
- **Pattern immutability** — Pattern selector remains disabled in edit mode (line 1089).

## Acceptance Criteria

- [x] Completed workflows show an Edit button in both the detail view and list card
- [x] Failed workflows show an Edit button in both the detail view and list card
- [x] Clicking Edit on a completed/failed workflow navigates to the edit form pre-populated with the workflow's definition
- [x] Saving edits on a completed/failed workflow resets its status to "draft"
- [x] Execution state (`_state`, `_loopState`) is stripped from the definition on save
- [x] Edited workflow can be executed via the normal Execute button
- [x] Old task records from previous executions remain intact (not deleted)
- [x] Active workflows cannot be edited (API returns 409)
- [x] Paused workflows cannot be edited (API returns 409)
- [x] Pattern selector remains disabled when editing (pattern is immutable)
- [x] Document pool bindings are preserved through the edit cycle

## Scope Boundaries

**Included:**
- Edit-in-place with status reset for completed and failed workflows
- Edit button visibility in detail view and list view
- API guard expansion with state cleanup

**Excluded:**
- Workflow version history / audit trail (separate feature if needed)
- Editing active or paused workflows (dangerous: mid-flight state)
- Changing the workflow pattern after creation (architectural constraint)
- Drag-and-drop step reordering (UX enhancement, separate feature)

## References

- Execute route state reset pattern: `src/app/api/workflows/[id]/execute/route.ts` (lines 31-53)
- PATCH route guard: `src/app/api/workflows/[id]/route.ts` (lines 38-45)
- Status view Edit button: `src/components/workflows/workflow-status-view.tsx` (line 336)
- List view Edit button: `src/components/workflows/workflow-list.tsx` (line 191)
- Form definition builder: `src/components/workflows/workflow-form-view.tsx` (lines 762-804)
- Related features: `workflow-engine` (dependency), `workflow-ux-overhaul` (completed)
