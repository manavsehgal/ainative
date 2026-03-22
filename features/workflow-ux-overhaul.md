---
title: Workflow UX Overhaul
status: completed
priority: P1
milestone: post-mvp
source: conversation/2026-03-17-workflow-issues
dependencies:
  - workflow-engine
  - ai-assist-workflow-creation
  - agent-document-context
  - document-output-generation
---

# Workflow UX Overhaul

## Description

Comprehensive fix for 8 UX and data-flow gaps in the workflow system that degrade the end-to-end experience. Users report that file attachments aren't passed to workflow steps, intermediate outputs are truncated and unreadable, the dashboard doesn't reflect workflow progress, there's no guidance on when to use "Create All" vs "Workflow", and generated documents aren't linked from the workflow detail view. The final output quality is also impacted by a low $2.0 per-step budget cap.

This feature addresses the full lifecycle: task creation guidance, document context propagation, execution visibility, output readability, and post-completion document access.

## User Story

As a user running multi-step workflows, I want my attached files to flow through every step, I want to read each step's full output as it completes, I want to track progress from the dashboard, and I want to access all generated documents from the workflow view — so that workflows produce high-quality, complete results without me losing context.

## Technical Approach

### Chunk 1: Document Context Propagation

**Problem**: `buildDocumentContext(taskId)` only finds docs for that specific taskId. Child tasks get fresh IDs — parent's files are invisible.

- Add `buildWorkflowDocumentContext(workflowId, parentTaskId)` to `context-builder.ts`
- Thread `sourceTaskId` from workflow definition through all execution patterns in `engine.ts`
- Prepend parent document context to each child task's prompt
- Add `stepDocuments` and `parentDocuments` to workflow status API response
- Show documents section in `workflow-status-view.tsx`

**Key files**: `src/lib/documents/context-builder.ts`, `src/lib/workflows/engine.ts`, `src/app/api/workflows/[id]/status/route.ts`, `src/components/workflows/workflow-status-view.tsx`

### Chunk 2: Output Readability

**Problem**: Step outputs truncated to 500 chars with `LightMarkdown` and line clamping. No expand. Budget cap cuts output.

- Add expandable inline output (collapsed `LightMarkdown` + expand button → `ContentPreview`)
- New `WorkflowFullOutput` component — sheet with all step outputs concatenated
- Detect budget exhaustion in `processAgentStream()`, annotate result with warning
- Increase workflow step budget from $2.0 to $5.0 via `WORKFLOW_STEP_MAX_BUDGET_USD`

**Key files**: `src/components/workflows/workflow-status-view.tsx`, `src/components/workflows/workflow-full-output.tsx` (new), `src/lib/agents/claude-agent.ts`, `src/lib/constants/task-status.ts`

### Chunk 3: Dashboard Visibility

**Problem**: Only parent task visible on dashboard. Steps hidden. Parent disappears on completion.

- Enrich parent task card with workflow progress (step N/M, current step name)
- Link to workflow detail from task card
- Show stale indicator for workflows running > 30min without progress
- Keep completed workflow parent tasks briefly visible on dashboard

**Key files**: `src/app/dashboard/page.tsx`, `src/components/tasks/task-card.tsx`, `src/components/dashboard/priority-queue.tsx`

### Chunk 4: AI Assist Guidance

**Problem**: No explanation of "Create All" vs "Workflow". Reasoning text buried at bottom.

- Move `reasoning` to prominent callout position
- Add explanatory text under each button (independent tasks vs context-chained pipeline)
- Show "Recommended" badge on Workflow button when pattern is multi-step
- Complexity-aware guidance note for complex tasks

**Key files**: `src/components/tasks/ai-assist-panel.tsx`

## Acceptance Criteria

### Document Context Propagation
- [ ] File attached to parent task is visible in workflow step 1's prompt as "Attached Documents"
- [ ] File context flows to all subsequent steps (not just step 1)
- [ ] Documents > 30K chars are truncated with path reference fallback
- [ ] Workflows without `sourceTaskId` (legacy) execute without errors
- [ ] Workflow detail view shows output documents per completed step
- [ ] Parent task's input documents shown in workflow detail view

### Output Readability
- [ ] Each step output shows collapsed preview (500 chars) with "Expand" button
- [ ] Expanded view uses full `ReactMarkdown` with GFM support
- [ ] "View Full Output" button opens sheet with all step results concatenated
- [ ] Full output sheet has copy-all and download-as-markdown buttons
- [ ] Budget exhaustion annotates result with visible warning
- [ ] Workflow step budget is $5.0 (vs $2.0 for standalone tasks)

### Dashboard Visibility
- [ ] Parent task card shows workflow progress indicator (e.g., "3/5 steps")
- [ ] Current step name displayed on parent task card
- [ ] Task card links to workflow detail view
- [ ] Failed workflow shows warning icon on parent task
- [ ] Parent task remains visible on dashboard during full workflow lifecycle

### AI Assist Guidance
- [ ] Reasoning text appears as prominent callout above action cards
- [ ] "Create All" button has subtitle: "Creates {n} independent tasks"
- [ ] "Workflow" button has subtitle: "Runs as {pattern} with context flow"
- [ ] "Recommended" badge on Workflow button when pattern is multi-step
- [ ] Complex tasks show additional guidance about workflow benefits

## Scope Boundaries

**Included:**
- Document context propagation from parent to all workflow child tasks
- Expandable step output with full markdown rendering
- Full workflow output concatenation view
- Budget increase for workflow steps
- Budget exhaustion detection and annotation
- Dashboard workflow progress indicators
- AI assist choice guidance and recommendation

**Excluded:**
- Per-step budget configuration UI (backend constant is sufficient for now)
- Visual workflow graph editor (current step list UI is adequate)
- Real-time SSE for workflow progress (polling every 3s is sufficient)
- Workflow template/blueprint changes (orthogonal, already complete)
- Changes to how parallel/swarm patterns display (only sequence/checkpoint affected)

## UX Design Notes

### Workflow Status View — Output Expansion Pattern
- **Collapsed**: `LightMarkdown` preview (500 chars, 2-line clamp) + "Expand" ghost button
- **Expanded**: `ContentPreview` with full markdown, copy, download buttons
- **Full Output Sheet**: Triggered from header button, renders all steps sequentially

### Dashboard Progress Indicator
- Small progress bar under task title (thin, uses brand blue)
- Text: "{current}/{total} · {currentStepName}" in muted-foreground
- Failed state: destructive border + warning icon
- Stale state (>30min): amber clock icon

### AI Assist Guidance Layout
```
┌─ AI Reasoning Callout (info variant) ─────────┐
│ "This task involves sequential research and    │
│  drafting steps that benefit from context flow" │
└────────────────────────────────────────────────┘

┌─ Create All ───────────────┐  ┌─ Workflow [Recommended] ──┐
│ Creates 4 independent      │  │ Runs as Sequence with     │
│ tasks with no shared       │  │ context flow between      │
│ context                    │  │ steps                     │
│          [Create All]      │  │         [Create Workflow]  │
└────────────────────────────┘  └───────────────────────────┘
```

## References

- Source: User-reported issues (2026-03-17 conversation)
- Related features: [workflow-engine](workflow-engine.md), [ai-assist-workflow-creation](ai-assist-workflow-creation.md), [agent-document-context](agent-document-context.md), [document-output-generation](document-output-generation.md)
- Enables: Better output quality by fixing context flow; better discoverability of workflow results
