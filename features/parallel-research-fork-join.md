---
title: Parallel Research Fork/Join
status: completed
priority: P2
milestone: post-mvp
source: ideas/mvp-vision.md, ideas/task-workflows.md
dependencies: [workflow-engine, multi-agent-routing]
---

# Parallel Research Fork/Join

## Description

Parallel Research Fork/Join is the next bounded expansion of ainative's workflow engine. It adds one new control-flow pattern: launch multiple research branches at the same time, wait for them all to finish, then hand their outputs to a final synthesis step.

This should ship as a narrow workflow primitive, not as a grab-bag of advanced orchestration ideas. Critic/verifier loops, evaluator-optimizer patterns, and broader swarm behavior remain out of scope until ainative proves that simple fork/join concurrency is understandable, observable, and reliable in the existing workflow UX.

## User Story

As a power user, I want to split one research question into parallel agent branches and then merge the results into a final answer so that I can gather information faster without manually creating and coordinating multiple tasks.

## Technical Approach

### Workflow Pattern

Add a new `parallel` workflow pattern to the existing workflow definition model:

```typescript
interface WorkflowDefinition {
  pattern: "sequence" | "planner-executor" | "checkpoint" | "loop" | "parallel";
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  dependsOn?: string[];
  assignedAgent?: string;
  agentProfile?: string;
}
```

First-slice rules:

- Steps with no `dependsOn` start as parallel branch steps
- Exactly one synthesis step depends on all branch step IDs
- The synthesis step receives labeled outputs from each completed branch
- Execution uses a small system concurrency cap to avoid runaway task fan-out

### Execution Engine

- Extend `src/lib/workflows/engine.ts` with a `parallel` executor that:
  - finds all ready branch steps
  - launches them concurrently as child tasks
  - waits for all branch results before unlocking the synthesis step
  - records branch-level status and outputs in workflow state
- Reuse existing child-task execution, runtime assignment, and profile-compatibility checks
- Persist enough workflow state that a restarted app can still display finished branch outputs and the pending join step correctly

### Authoring UX

- Add `Parallel Research` to the workflow pattern selector
- Keep the editor bounded:
  - 2-5 parallel branch steps
  - 1 required synthesis step
  - no arbitrary graph editor
- Make the join structure legible in the existing form instead of introducing a canvas or DAG builder

### Status UX

- Show branch cards or rows with independent running/completed/failed states
- Show the synthesis step as `waiting` until all branches complete
- Surface labeled branch outputs in the workflow detail view so the user can understand what fed the final synthesis step

## Acceptance Criteria

- [x] Users can create a `parallel` workflow with at least two branch steps and one synthesis step
- [x] Branch steps without dependencies are launched concurrently through the existing child-task execution path
- [x] The synthesis step does not start until every required branch finishes successfully
- [x] The synthesis step receives labeled outputs from each branch as prompt context
- [x] Workflow status shows per-branch progress plus an explicit waiting state for the synthesis step
- [x] Validation rejects malformed parallel definitions, including missing join dependencies or more than one synthesis step
- [x] Failed branch runs are clearly surfaced without hiding successful sibling outputs

## Scope Boundaries

**Included:**
- One new fork/join workflow pattern for parallel research and synthesis
- Bounded workflow-form support for branch definition
- Branch-level progress visibility in workflow status
- Reuse of existing runtime/profile assignment per step

**Excluded:**
- Arbitrary DAG editing
- N-of-M joins, first-result-wins, or race/discriminator patterns
- Critic/verifier and evaluator-optimizer loops
- Multi-agent swarm roles such as mayor/refinery/mailbox coordination
- Automatic branch retry or dynamic branch generation by the planner

## References

- Source: `ideas/mvp-vision.md` — Deferred to Post-MVP workflow patterns
- Source: `ideas/task-workflows.md` — Parallel Split (Fork) and Synchronization (Join)
- Related features: `workflow-engine`, `multi-agent-routing`, `multi-agent-swarm`, `agent-self-improvement`
