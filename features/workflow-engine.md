---
title: Workflow Engine
status: completed
priority: P2
milestone: mvp
source: ideas/mvp-vision.md, ideas/task-workflows.md
dependencies: [agent-integration, task-board]
---

# Workflow Engine

## Description

Multi-step workflow execution using three patterns: Sequence (prompt chaining), Planner→Executor (orchestrator-workers), and Human-in-the-Loop Checkpoint. These patterns enable tasks that are more complex than single agent calls — multi-step processes where output from one step feeds into the next.

Workflows are defined as JSON structures stored in the `workflows` table and executed by the workflow engine, which coordinates Agent SDK calls according to the pattern.

## User Story

As a user, I want to define multi-step workflows so that I can chain agent actions together — like having an agent research a topic, draft a document, then wait for my approval before publishing.

## Technical Approach

### Three MVP Workflow Patterns

| Pattern | Agent SDK Mechanism | Example |
|---------|---------------------|---------|
| Sequence | Sequential `query()` calls with gate checks | Research → Draft → Review → Publish |
| Planner → Executor | Main agent + `AgentDefinition` subagents via `agents` param | "Build a landing page" → plan → execute each step |
| Human-in-the-Loop Checkpoint | `canUseTool` callback + `PermissionResultAllow/Deny` | Agent drafts → human approves → agent sends |

### Workflow Definition (JSON)

```typescript
interface WorkflowDefinition {
  pattern: "sequence" | "planner-executor" | "checkpoint";
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  requiresApproval?: boolean;  // Human checkpoint
  dependsOn?: string[];        // Step dependencies
}
```

### Workflow Engine

- `src/lib/workflows/engine.ts` — state machine that advances through workflow steps
- For Sequence: run steps in order, pass output from step N as context to step N+1
- For Planner→Executor: first step generates a plan, subsequent steps execute each planned item using subagents
- For Checkpoint: insert a human approval gate between steps

### API Routes

- `POST /api/workflows` — create a workflow definition
- `POST /api/workflows/[id]/execute` — start workflow execution
- `GET /api/workflows/[id]/status` — get workflow execution state (which step, progress)

### Components

- `WorkflowCreateDialog` — form to define a workflow (select pattern, add steps)
- `WorkflowStatusView` — visual progress through steps (which step is active, completed, waiting)

### UX Considerations

- Flag for `/frontend-designer` review: workflow creation UX, step visualization, and progress indicators need design input

## Acceptance Criteria

- [ ] Users can create a Sequence workflow with multiple steps
- [ ] Sequence workflows execute steps in order, passing output forward
- [ ] Planner→Executor pattern generates a plan and executes sub-tasks
- [ ] Human-in-the-Loop checkpoints pause execution and notify the user
- [ ] Workflow status shows progress through steps
- [ ] Workflow definitions are stored as JSON in the workflows table
- [ ] Failed steps can be retried without restarting the entire workflow
- [x] WorkflowList shows skeleton loaders while fetching (C1)
- [x] WorkflowStatusView shows skeleton loaders while fetching (C1)
- [x] Optimistic status update after clicking Execute (I5)
- [x] Step list has `aria-live="polite"` for screen reader announcements (A1)
- [x] Status badge colors use shared `status-colors.ts` constants (M1)
- [x] `patternLabels` deduplicated to shared constants (M9)

## Scope Boundaries

**Included:**
- Three workflow patterns (Sequence, Planner→Executor, Checkpoint)
- Workflow definition creation
- Workflow execution engine
- Step-by-step progress tracking
- JSON workflow definitions stored in database

**Excluded:**
- Visual DAG/graph editor (post-MVP)
- Parallel execution patterns (fork/join — post-MVP)
- Critic/Verifier pattern (post-MVP)
- Evaluator-Optimizer pattern (post-MVP)
- Custom workflow pattern definitions

## References

- Source: `ideas/mvp-vision.md` — Workflow Patterns for MVP section, Deferred to Post-MVP section
- Source: `ideas/task-workflows.md` — Canonical workflow patterns, AI agent workflow patterns
- Related features: `agent-integration` (provides execution), `task-board` (workflows create/manage tasks)
