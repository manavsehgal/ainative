---
title: Multi-Agent Swarm
priority: P3
status: completed
milestone: post-mvp
source: ideas/mvp-vision.md, ideas/karpathy-one-gpu-research-lab.md
dependencies:
  - workflow-engine
  - multi-agent-routing
---

# Multi-Agent Swarm

## Description

Multi-Agent Swarm is the first bounded slice of Gas Town-inspired orchestration inside Stagent's existing workflow system. Instead of introducing a new graph runtime or mailbox subsystem, it adds one explicit swarm pattern with three fixed roles: a mayor step that plans the work, a pool of worker steps that run in parallel, and a refinery step that merges the successful worker outputs into one final result.

This slice is intentionally narrow. It proves that Stagent can expose swarm-style orchestration through the current workflow editor, child-task execution path, monitoring model, and human-facing status UI before taking on dynamic worker generation, mailbox coordination, or more autonomous re-planning.

## User Story

As a power user, I want to run one mayor, several specialist workers, and a refinery inside a single workflow so that I can coordinate multi-agent work without manually creating and supervising each task.

## Inspiration

From the Karpathy "One GPU Research Lab" article (`ideas/karpathy-one-gpu-research-lab.md`):
- **Gas Town architecture**: Mayor (control plane) dispatches work to 20-30 Polecat workers, results flow through a Refinery for merge conflict resolution, Witness monitors health
- **MEOW work units**: Molecular Expression of Work — Beads (atomic tasks) compose into Epics, Molecules, and higher-order units
- **Nondeterministic Idempotence**: Workflows survive crashes via persistent task state and git-backed checkpoints

## Core Concepts

### Roles
- **Mayor**: Orchestrator that decomposes a project goal into parallel work units
- **Workers**: Independent agent instances executing assigned beads/tasks
- **Refinery**: Merge process that reconciles outputs from multiple workers
- **Monitor**: Health check and progress aggregation (reuses existing monitoring)

## Technical Approach

- Add a new `swarm` workflow pattern to the existing workflow definition model
- Keep the authoring shape bounded:
  - step 1 = mayor
  - steps 2-6 = worker pool (2-5 workers)
  - final step = refinery
- Allow a small configurable worker concurrency limit so swarm runs can stay bounded
- Reuse existing child-task execution, runtime assignment, profile compatibility checks, workflow status persistence, and workflow detail polling
- Build worker prompts from the completed mayor output plus each worker's authored assignment prompt
- Build refinery prompts from the mayor output plus labeled worker results
- Add step retry support for failed swarm workers and refinery runs without re-running successful sibling workers

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/workflows/swarm.ts` | Swarm structure parsing, concurrency normalization, and prompt builders |
| `src/lib/workflows/engine.ts` | Mayor → worker fan-out → refinery execution plus retry handling |
| `src/components/workflows/workflow-form-view.tsx` | Swarm pattern authoring UI |
| `src/components/workflows/swarm-dashboard.tsx` | Mayor/worker/refinery workflow detail surface |
| `src/app/api/workflows/[id]/steps/[stepId]/retry/route.ts` | Step retry API for failed swarm stages |

## Acceptance Criteria

- [x] Users can create a `swarm` workflow with one mayor step, 2-5 worker steps, and one refinery step
- [x] The mayor step executes first and its output is injected into each worker prompt as shared plan context
- [x] Worker steps execute in parallel through the existing child-task workflow path with a bounded concurrency limit
- [x] The refinery step waits for successful worker completion and receives labeled worker outputs plus the mayor plan as context
- [x] Workflow status shows distinct mayor, worker, and refinery progress in the workflow detail view
- [x] Failed worker or refinery steps can be retried from the workflow detail view without re-running successful sibling workers
- [x] Swarm execution state persists in workflow definition state so progress survives refreshes and normal server restarts

## Scope Boundaries

**Included:**
- One bounded swarm workflow pattern inside the current workflow engine
- Fixed role structure: mayor, worker pool, refinery
- Configurable worker concurrency
- Swarm-specific status presentation and failed-step retries
- Reuse of current runtime/profile assignment and child-task execution

**Excluded:**
- Dynamic worker generation by the mayor
- Mailbox or queue extensions beyond existing workflow/task state
- Automatic worker reassignment or self-healing orchestration
- Arbitrary graph editing or nested swarms
- Git-backed checkpoints or merge-conflict automation beyond the refinery prompt
