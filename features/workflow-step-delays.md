---
title: Workflow Step Delays
status: completed
priority: P1
milestone: post-mvp
source: changelog.md#2026-04-08 (split from growth-primitives design spec)
dependencies: [workflow-engine, scheduled-prompt-loops]
---

# Workflow Step Delays

## Description

Extend the workflow engine with time-distributed step execution. Today, workflow steps run back-to-back — there is no way to pause for hours, days, or weeks between steps. This feature adds an optional `delayDuration` field to workflow step definitions ("3d", "2h", "30m", "1w"). When the engine reaches a delay step, the workflow pauses, records a `resume_at` timestamp, and the existing scheduler tick automatically resumes the workflow when the time arrives.

This is a general-purpose primitive. The Growth module uses it for outreach sequences ("send initial email, wait 3 days, send follow-up"), but the same mechanism serves content publishing pipelines, user onboarding drips, staged rollouts, and approval cooling periods. Pause/resume is durable across process restarts because `resume_at` lives in the indexed workflows table.

## User Story

As a workflow author, I want to insert pause periods between workflow steps, so that multi-step sequences can respect time windows (follow-up delays, cooling periods, drip cadences) without me manually orchestrating re-execution.

## Technical Approach

### Duration Format

Human-friendly strings parsed to milliseconds: `Nm` (minutes), `Nh` (hours), `Nd` (days), `Nw` (weeks). Bounds enforced at validation: minimum 1 minute, maximum 30 days. Compound formats like `3d2h` are explicitly out of scope.

### Pause/Resume State Machine

Approach (B) from the design spec: **schedule-based**, not sleep-based. When the engine encounters a delay step, it:

1. Computes `resumeAt = now + parseDuration(step.delayDuration)`
2. Writes to the new indexed `workflows.resume_at` column
3. Merges `{ delayedStepIndex, resumeAt }` into `definition._state` (existing JSON-in-TEXT state pattern)
4. Sets `workflows.status = "paused"` (status enum already includes this value — no schema enum change)
5. Returns from `executeWorkflow()` without running the step

The existing scheduler tick in `src/lib/schedules/scheduler.ts` (runs every 60s) gains one new branch after `processHandoffs()`: it queries for paused workflows with `resume_at <= now()`, then calls a new `resumeWorkflow(workflowId, fromStepIndex)` export. The resume is **idempotent and atomic** — the UPDATE checks the current status is still `"paused"`, so a scheduler tick and a user's "Resume Now" click racing each other produces exactly one resume.

### Blueprint Validation

`BlueprintStepSchema` in `src/lib/validators/blueprint.ts` currently requires `name`, `profileId`, and `promptTemplate`. This feature makes `profileId` and `promptTemplate` optional and adds `delayDuration` as optional, plus a cross-field `refine()` enforcing XOR:

- **Delay step:** `delayDuration` set, `profileId` and `promptTemplate` absent
- **Task step:** `profileId` and `promptTemplate` set, `delayDuration` absent
- Neither valid, nor both

`parseDuration()` is called inside the refine so malformed durations fail at the validation boundary, not at runtime.

### Database Changes

New migration `0024_add_workflow_resume_at.sql`:

```sql
ALTER TABLE workflows ADD COLUMN resume_at INTEGER;
CREATE INDEX idx_workflows_resume_at ON workflows(resume_at) WHERE resume_at IS NOT NULL;
```

Per TDR-009, matching updates in `src/lib/db/schema.ts` (add `resumeAt: integer("resume_at")`) and `src/lib/db/bootstrap.ts` (add `resume_at INTEGER` to the workflows CREATE TABLE). No new table, so `clear.ts` is unchanged.

### Resume API Endpoint

New route `POST /api/workflows/[id]/resume` calls `resumeWorkflow()` with the step index read from `_state.delayedStepIndex + 1`. Returns 202 on success (fire-and-forget per TDR-001), 409 on already-active (lost the race), 404 on missing workflow.

### Chat Tool

The existing `create_workflow` chat tool in `src/lib/chat/tools/workflow-tools.ts` accepts `delayDuration` in its step definitions via the same Zod schema used by the blueprint validator (DRY via shared schema import).

### Chat Context Exposure

Registering the tool is not enough — the chat LLM also needs to *know* this capability exists so it can proactively suggest delays when the user describes a time-distributed sequence. Updates required in the chat layer:

**`src/lib/chat/system-prompt.ts` — STAGENT_SYSTEM_PROMPT:**

- Under `### Workflows`, update the `create_workflow` line to mention delay-step support: *"create_workflow: Create a multi-step workflow with a definition. Steps can be task steps (profile + prompt) or delay steps (delayDuration like '3d', '2h', '30m') that pause the workflow before the next step."*
- In `## Guidelines`, add a new bullet: *"For time-distributed sequences (outreach cadences, drip campaigns, cooling periods, staged rollouts), use delay steps with delayDuration (format: Nm|Nh|Nd|Nw, 1m..30d bounds). Do not ask the user to create separate workflows or schedules — a single workflow with delay steps is the idiomatic pattern."*
- Under existing `## When to Use Which Tools` table, add: *"Time-distributed multi-step sequences ('send email, wait 3 days, follow up') → `create_workflow` with delay steps."*

**`src/lib/chat/suggested-prompts.ts`:**

- Add to `buildCreatePrompts()`: *"Design a drip sequence" → "Help me build a drip workflow with delay steps between sends. Ask me about the cadence, number of touches, and content goal for each step, then use create_workflow."*
- Optional addition to `buildExplorePrompts()` when a paused workflow exists: *"Resume 'Outreach Sequence'" → "Resume the paused workflow 'Outreach Sequence' (id: ...) now instead of waiting for the scheduler."*

**`src/lib/chat/tools/workflow-tools.ts` — tool description:**

- The `create_workflow` tool's `description` field must explicitly mention delay steps so the tool description surfaces in tool-use planning, not just the system prompt: *"Create a multi-step workflow. Each step is either a task step (requires profileId and promptTemplate) or a delay step (requires delayDuration, e.g. '3d'). Delay steps pause the workflow and auto-resume when the time arrives."*
- The step parameter schema (Zod) must be exported so the blueprint validator and the chat tool share a single source of truth — no duplicated types.

**Why this matters:** Adding a tool without documenting it in the system prompt results in the chat LLM never suggesting it, even when users describe the exact problem the tool solves. This has been observed with existing table tools that are registered but invisible to the LLM because the system prompt lacks a Tables section.

### UX — Status View

In `WorkflowStatusView` (`src/components/workflows/workflow-status-view.tsx`), delay steps reuse the existing step card layout (`surface-card-muted rounded-lg border border-border/50 p-4`) with three visual variations keyed off step state:

- **Upcoming delay** (draft workflow, not yet executed): neutral color, label "Will wait 3d", no countdown
- **Active delay** (workflow paused, waiting): warning-family color, `Clock3` icon (already imported), `<time>` element with local-timezone absolute time + compact remaining duration, "Resume Now" button
- **Completed delay** (workflow resumed past this step): success-family color, `CheckCircle` icon, "Delayed 3d — completed"

Countdown is **static on mount/focus** — no per-second ticking. The reason: live aria-live updates would flood assistive tech users. Users needing a refresh can reload or refocus the page.

### UX — Workflow Editor

In `workflow-form-view.tsx` (the actual filename; spec called it `workflow-editor.tsx`), `renderStepEditor` (around line 904) branches on `step.delayDuration`. For delay steps, render a simplified `FormSectionCard` with:

- Badge label `DELAY`
- Editable step name
- Single duration picker (text input with pattern hint "30m, 2h, 3d, 1w")
- Inline client-side validation using `parseDuration()` for immediate feedback
- No profile selector, no runtime selector, no prompt textarea

## Acceptance Criteria

### Functional

- [ ] Workflow steps can include `delayDuration` field (format: `Nm|Nh|Nd|Nw`, bounds 1m..30d)
- [ ] Blueprint validator rejects steps that mix `delayDuration` with `profileId`/`promptTemplate` (XOR rule)
- [ ] Blueprint validator rejects malformed duration strings at validation boundary (not runtime)
- [ ] Engine pauses workflow at delay step, writes `resume_at` column and `_state.delayedStepIndex`
- [ ] `workflows.status` becomes `"paused"` during delay (reusing existing enum value)
- [ ] Scheduler tick resumes paused workflows when `resume_at <= now()`
- [ ] Resume is atomic and idempotent — concurrent scheduler + user click produces exactly one resume
- [ ] `POST /api/workflows/[id]/resume` returns 202/409/404 correctly
- [ ] Kill and restart dev server during a delay → workflow still resumes after `resume_at`
- [ ] `create_workflow` chat tool accepts `delayDuration` in step definitions
- [ ] `create_workflow` tool description explicitly documents delay-step syntax (surfaces in LLM tool-use planning)
- [ ] `STAGENT_SYSTEM_PROMPT` workflows section mentions delay-step support
- [ ] `STAGENT_SYSTEM_PROMPT` guidelines include a rule steering the LLM toward delay steps for time-distributed sequences (not separate workflows/schedules)
- [ ] `suggested-prompts.ts` has at least one Create-category prompt demonstrating the delay-step pattern ("Design a drip sequence")
- [ ] Step parameter Zod schema is exported from one location and imported by both the chat tool and the blueprint validator (single source of truth)
- [ ] Migration 0024 applied; `schema.ts` and `bootstrap.ts` in sync per TDR-009

### UX (Design Bridge from `/frontend-designer`)

- [ ] Delay step renders with `Clock3` icon (already imported in workflow-status-view.tsx:21), not a new icon
- [ ] Delay step card reuses `surface-card-muted rounded-lg border border-border/50 p-4` pattern
- [ ] Countdown label uses `<time dateTime={iso}>` element with user's local timezone
- [ ] Format example: "Resumes Fri, Apr 11 at 8:00 AM PDT"
- [ ] For delays ≥ 1 day: compact remaining format ("2w 5d remaining") via `formatDuration()`, not "423 hours"
- [ ] For delays < 1 hour: "Resumes in 30 min" without live ticking (static on page load/focus)
- [ ] Completed delay step shows `CheckCircle` icon + "Delayed 3d — completed" (distinct visual state from active)
- [ ] "Resume Now" button reuses Execute button pattern (`<Button size="sm"><Play className="h-3 w-3 mr-1" />`), disabled during API call, re-enabled on error
- [ ] Resume Now button is keyboard-accessible (Tab-reachable, Space/Enter triggers)
- [ ] If scheduler resumes first, user's Resume Now click shows non-blocking toast: "Workflow already resumed by scheduler" (from 409 response)
- [ ] Workflow-level status badge uses `variant="secondary"` when paused waiting (matches existing `waiting_dependencies` family)
- [ ] In `workflow-form-view.tsx` editor, delay step card uses `FormSectionCard` with badge `DELAY`, single duration picker, no profile/runtime/prompt fields
- [ ] Duration picker text input has pattern hint "30m, 2h, 3d, 1w" and inline error for invalid format

## Scope Boundaries

**Included:**

- `delayDuration` field on sequence-pattern workflow steps
- Duration parser (`parseDuration` / `formatDuration`)
- `resume_at` indexed column, migration, bootstrap, schema sync
- Scheduler tick extension for paused → active transition
- Resume API endpoint (`POST /api/workflows/[id]/resume`)
- `create_workflow` chat tool extension
- Workflow status view UI for 3 delay step states (upcoming, active, completed)
- Workflow editor UI for delay step card
- Chat system-prompt updates: delay-step documentation, intent-routing for time-distributed sequences
- Suggested-prompts update: Create-category drip-sequence prompt

**Excluded:**

- Delays inside loop/parallel/swarm patterns — different state machines, separate feature
- Compound durations (`3d2h`) — single unit only
- Conditional delays ("wait until condition is met") — closer to Watches feature
- Delay cancellation as a separate action — Resume Now already covers this
- Live ticking countdowns — accessibility concern (aria-live noise)
- Timezone override UI — always shows user's local timezone

## References

- Source: split from the 2026-04-08 Growth-Enabling Primitives design spec (removed after grooming — see `changelog.md` 2026-04-08 entry for provenance)
- Existing workflow engine: `src/lib/workflows/engine.ts:192-220` (sequence executor, delay branch insertion point)
- Existing scheduler: `src/lib/schedules/scheduler.ts:220-271` (tick loop, extension after `processHandoffs`)
- Existing workflow status enum: `src/lib/db/schema.ts:61` (already includes `"paused"`)
- Existing pause transition: `src/app/api/workflows/[id]/route.ts:100-114` (PATCH handler)
- Related TDRs: TDR-001 (fire-and-forget), TDR-003 (DB polling), TDR-009 (idempotent bootstrap), TDR-011 (JSON-in-TEXT), TDR-012 (epoch timestamps), TDR-019 (heartbeat engine pattern)
- Related features: `bulk-row-enrichment` (independent sibling from same design spec), `scheduled-prompt-loops` (scheduler infrastructure reused)
