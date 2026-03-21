---
title: Autonomous Loop Execution
priority: P3
status: completed
dependencies:
  - workflow-engine
  - agent-integration
---

# Autonomous Loop Execution

## Overview

Ralph Wiggum-inspired loop pattern: run agent tasks in a loop with stop conditions, iteration limits, and progress tracking. The agent confronts its own output each iteration, enabling autonomous refinement.

## Inspiration

From the Karpathy "One GPU Research Lab" article (`ideas/karpathy-one-gpu-research-lab.md`):
- **Ralph Wiggum technique**: `while :; do cat PROMPT.md | claude-code ; done` — persistent iteration where agents run, update artifacts, then re-run against updated state
- **Autoresearch's 5-minute experiment loop**: Fixed time budgets per iteration with clear metrics for progress

## Core Concepts

### Loop Definition
- **Prompt template**: Instructions the agent executes each iteration
- **Stop conditions**: Max iterations, time budget, success metric threshold, or human stop
- **Iteration context**: Each run sees the output/artifacts from the previous run
- **Progress tracking**: Metrics logged per iteration (cost, duration, quality score if applicable)

### Execution Model
- Loop creates child tasks per iteration (reuses existing task execution)
- Parent workflow tracks iteration count, cumulative metrics, stop reason
- Agent reads previous iteration's result as input context
- Human can pause/resume/cancel the loop at any point

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/workflows/loop-executor.ts` | Loop execution engine |
| `src/app/api/workflows/[id]/loop/route.ts` | Start/stop loop API |
| `src/components/workflows/loop-status.tsx` | Loop progress visualization |

## Acceptance Criteria

- [ ] Create a loop workflow with prompt, max iterations, and optional time budget
- [ ] Each iteration creates a child task with previous iteration's output as context
- [ ] Loop stops on: max iterations, time budget exceeded, human cancel, or agent-signaled completion
- [ ] Progress dashboard shows iteration history with per-iteration metrics
- [ ] Human can pause and resume a running loop
- [ ] Loop state persists across server restarts (stored in workflows table)
