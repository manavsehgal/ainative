---
title: "Agent Intelligence"
category: "feature-reference"
section: "agent-intelligence"
route: "cross-cutting"
tags: [ai-assist, routing, autonomous, swarm, self-improvement, context, parallel, episodic-memory, handoffs]
features: ["task-definition-ai", "multi-agent-routing", "autonomous-loop-execution", "multi-agent-swarm", "agent-self-improvement", "workflow-context-batching", "parallel-research-fork-join", "agent-episodic-memory", "agent-async-handoffs", "chat-skill-composition"]
screengrabCount: 0
lastUpdated: "2026-04-15"
---

# Agent Intelligence

`ainative-business` layers several AI-powered capabilities on top of basic task execution. From one-click description improvement to multi-agent coordination, episodic memory, and async handoffs, these features reduce manual effort and improve output quality across the workspace.

## Key Features

### Task Definition AI Assist

A single-click "AI Assist" button on the task creation form takes the current title and generates a richer, more actionable description. The improved text is previewed before applying, so you retain full control.

### Multi-Agent Routing

When a task is created, the task classifier analyzes its content and automatically selects the best-fit agent profile from the registry. The selected profile can be overridden manually via the profile dropdown. The router considers task content, project context, profile capabilities, and runtime availability.

### Autonomous Loop Execution

Tasks can run in autonomous loops with configurable stop conditions:

- **Iteration limit** -- stop after N iterations.
- **Time limit** -- stop after a duration elapses.
- **Success criteria** -- stop when the agent reports completion.
- **Error threshold** -- stop after repeated failures.

Loops support pause and resume. The loop status view provides real-time progress and control.

### Multi-Agent Swarm

For complex tasks that benefit from multiple perspectives, the swarm feature coordinates several agents working concurrently. Each agent operates within its assigned profile, and results are aggregated upon completion.

### Agent Self-Improvement

Agents accumulate learned context across iterations, stored in the database. This behavioral context feeds back into subsequent runs, allowing agents to refine their approach over time without manual prompt tuning. Context proposals require human approval before being applied.

### Agent Episodic Memory

Distinct from behavioral learned context, episodic memory captures factual knowledge the agent discovers during task execution. Key characteristics:

- **Memory extraction** -- agents identify and store important facts, decisions, and discoveries as discrete memory entries
- **Confidence scoring** -- each memory has a confidence level based on source reliability
- **Time-based decay** -- older memories gradually lose relevance weight, keeping the context window focused on current knowledge
- **Relevance-filtered retrieval** -- when executing a new task, the agent retrieves only memories relevant to the current context
- **Operator review** -- a memory browser UI lets you inspect, edit, and delete stored memories

Episodic memory means agents build institutional knowledge over time. A financial analyst profile that researches a company once can recall that research in future tasks without re-doing the work.

### Agent Async Handoffs

Agents can hand off work to other agents asynchronously through a message bus:

- **send_handoff tool** -- agents use this tool to delegate work to another profile
- **Governance gates** -- chain depth limits prevent infinite handoff loops, and self-handoff is blocked
- **Inbox approvals** -- handoff requests surface in the inbox for human approval before the receiving agent begins work
- **Handoff policies** -- configure which profiles can hand off to which, and under what conditions

This enables multi-agent workflows where a researcher discovers a code issue and hands it off to the code reviewer without requiring a pre-built workflow definition.

### Skill Composition

Chat conversations on capable runtimes can run multiple skills simultaneously, layering specialized behaviors (research, code review, document drafting) onto a single session. The composition engine enforces three guardrails:

- **Capability gating** — only runtimes that advertise `supportsSkillComposition` accept more than one active skill; others fall back to single-skill mode with a visible hint.
- **Conflict heuristic** — new skills whose tools or instructions overlap with an active one trigger a confirmation dialog before the swap is applied.
- **Prompt-budget eviction** — when the combined skill prompts approach the model's context budget, the oldest low-priority skill is evicted automatically so the conversation stays responsive.

The active stack persists on the conversation row (`conversations.active_skill_ids`), and the `mergeActiveSkillIds` helper keeps updates atomic across concurrent activations. See the [Chat](./chat.md) feature doc for the user-facing flow.

### Workflow Context Batching

In multi-step workflows, context from earlier steps is batched and forwarded to downstream steps. This prevents information loss across the workflow and ensures each step has the full picture of prior results.

### Parallel Research Fork-Join

Research tasks can be forked into concurrent sub-tasks that investigate different angles simultaneously. Results are joined when all branches complete, producing a consolidated output that covers more ground than sequential execution.

## Related

- [Provider Runtimes](./provider-runtimes.md)
- [Profiles](./profiles.md)
- [Workflows](./workflows.md)
- [Schedules](./schedules.md)
- [Inbox & Notifications](./inbox-notifications.md)
