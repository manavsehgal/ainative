---
title: "Agent Intelligence"
category: "feature-reference"
section: "agent-intelligence"
route: "cross-cutting"
tags: [ai-assist, routing, autonomous, swarm, self-improvement, context, parallel]
features: ["task-definition-ai", "multi-agent-routing", "autonomous-loop-execution", "multi-agent-swarm", "agent-self-improvement", "workflow-context-batching", "parallel-research-fork-join"]
screengrabCount: 2
lastUpdated: "2026-03-21"
---

# Agent Intelligence

Stagent layers several AI-powered capabilities on top of basic task execution. From one-click description improvement to multi-agent coordination, these features reduce manual effort and improve output quality across the workspace.

## Screenshots

![AI Assist button in task creation form](../screengrabs/dashboard-create-form-ai-assist.png)
*The AI Assist button analyzes the task title and generates an improved description.*

![Task form after AI Assist applies suggestions](../screengrabs/dashboard-create-form-ai-applied.png)
*After applying AI Assist, the description is expanded with actionable detail.*

## Key Features

### Task Definition AI Assist

A single-click "AI Assist" button on the task creation form takes the current title and generates a richer, more actionable description. The improved text is previewed before applying, so the user retains full control.

### Multi-Agent Routing

When a task is created, the task classifier analyzes its content and automatically selects the best-fit agent profile from the registry (General, Code Reviewer, Researcher, Document Writer). The selected profile can be overridden manually via the profile dropdown. Routing logic lives in `src/lib/agents/profiles/`.

### Autonomous Loop Execution

Tasks can run in autonomous loops with configurable stop conditions:

- **Iteration limit** — stop after N iterations.
- **Time limit** — stop after a duration elapses.
- **Success criteria** — stop when the agent reports completion.
- **Error threshold** — stop after repeated failures.

Loops support pause and resume. The `LoopStatusView` component provides real-time progress and control.

### Multi-Agent Swarm

For complex tasks that benefit from multiple perspectives, the swarm feature coordinates several agents working concurrently. Each agent operates within its assigned profile, and results are aggregated upon completion.

### Agent Self-Improvement

Agents accumulate learned context across iterations, stored in the `learned_context` table. This context feeds back into subsequent runs, allowing agents to refine their approach over time without manual prompt tuning.

### Workflow Context Batching

In multi-step workflows, context from earlier steps is batched and forwarded to downstream steps. This prevents information loss across the workflow and ensures each step has the full picture of prior results.

### Parallel Research Fork-Join

Research tasks can be forked into concurrent sub-tasks that investigate different angles simultaneously. Results are joined when all branches complete, producing a consolidated output that covers more ground than sequential execution.

## Related

- [Provider Runtimes](./provider-runtimes.md)
- [Profiles](./profiles.md)
- [Workflows](./workflows.md)
- [Schedules](./schedules.md)
