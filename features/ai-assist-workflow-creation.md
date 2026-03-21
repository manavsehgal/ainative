---
title: AI Assist → Workflow Creation
status: completed
priority: P1
milestone: post-mvp
dependencies:
  - task-definition-ai
  - workflow-engine
  - agent-profile-catalog
---

# AI Assist → Workflow Creation

## User Story

As a user creating a task, when AI Assist recommends a multi-step breakdown, I want to create a workflow from those recommendations so tasks are properly linked, ordered, and executed as a unit.

## Problem

Currently, AI Assist generates subtask breakdowns that are created as **orphaned independent tasks** — no workflow, no `workflowId` linkage, no execution ordering. Users who want coordinated multi-step execution must manually recreate the breakdown as a workflow.

## Solution

Bridge AI Assist recommendations into the workflow engine:

1. **Expanded AI response** — AI suggests per-step profiles, dependencies, and all 6 workflow patterns (sequence, planner-executor, checkpoint, parallel, loop, swarm)
2. **Workflow builder** — Pure function converts assist response into a validated `WorkflowDefinition`
3. **Confirmation sheet** — UI for reviewing/editing the proposed workflow before creation
4. **API endpoint** — Atomic creation of workflow + linked tasks in a single transaction
5. **Profile auto-suggestion** — Keyword-based fallback when AI doesn't suggest a profile

## Acceptance Criteria

- [ ] AI Assist recommends all 6 workflow patterns with per-step profile suggestions
- [ ] "Create as Workflow" button appears when breakdown has 2+ steps and pattern isn't "single"
- [ ] Confirmation sheet allows editing: name, pattern, step order, per-step profiles
- [ ] Pattern-specific config sections (loop: maxIterations, swarm: workerConcurrencyLimit)
- [ ] Workflow + tasks created atomically via POST /api/workflows/from-assist
- [ ] Optional immediate execution via "Accept & Run" button
- [ ] Existing "Create All" subtask flow unchanged (backward compatible)
- [ ] Profile "auto" defers to multi-agent-router at execution time

## Technical Design

### Key Files

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/agents/runtime/task-assist-types.ts` | Modify | Expand types for 6 patterns + profiles + deps |
| `src/lib/agents/runtime/claude.ts` | Modify | Upgrade system prompt with profile catalog |
| `src/lib/workflows/assist-builder.ts` | Create | Convert assist response → WorkflowDefinition |
| `src/app/api/workflows/from-assist/route.ts` | Create | Atomic workflow + tasks creation endpoint |
| `src/components/tasks/workflow-confirmation-sheet.tsx` | Create | Sheet UI for reviewing proposed workflow |
| `src/components/tasks/ai-assist-panel.tsx` | Modify | Add "Create as Workflow" button |
| `src/components/tasks/task-create-panel.tsx` | Modify | Wire up Sheet state + callback |
| `src/lib/agents/profiles/suggest.ts` | Create | Keyword-based profile suggestion |
| `src/lib/workflows/engine.ts` | Modify | Honor "auto" profile via router |
