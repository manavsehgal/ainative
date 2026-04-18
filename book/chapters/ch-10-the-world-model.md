---
title: "The World Model"
subtitle: "From Project State to Organizational Intelligence"
chapter: 10
part: 4
readingTime: 15
lastGeneratedBy: "2026-04-18T17:10:00.000Z"
relatedDocs: ["workflows", "profiles", "schedules"]
---

## What Is a World Model?

In March 2026, Jack Dorsey and Roelof Botha published an essay at Sequoia that reframed a two-thousand-year-old problem. The Roman Army, they argued, invented hierarchy not because it was elegant but because it was the only information-routing protocol available when leaders could manage somewhere between three and eight people. Every organizational innovation since -- McCallum's org chart, Taylor's scientific management, McKinsey's matrix, Spotify's squads -- has been an attempt to work around the same tradeoff: narrowing span of control means adding layers, but more layers mean slower information flow.

Block's answer, as Dorsey and Botha describe it, is to "replace what the hierarchy does" — not by giving everyone a copilot that makes the existing structure slightly better, but by building what they call "a company built as an intelligence." The mechanism is a world model: a continuously updated representation of the entire business that carries the information that managers used to relay.

This is the most important concept in the case studies we have examined throughout this book. Every other pattern -- agent profiles, workflow orchestration, scheduled loops, multi-agent swarms, human-in-the-loop permissions -- exists to feed, query, and act upon the world model. Without it, agents are clever scripts. With it, they become participants in organizational intelligence.

A world model is not a dashboard. Dashboards are read-only snapshots. A world model is a live, queryable, writable representation of organizational state that both humans and agents consult to make decisions. When an agent asks "what is blocked?" and gets an answer, that answer comes from the world model. When a workflow completes and updates a project's status, it writes to the world model. When a schedule fires at 6 AM and an agent scans for anomalies, it scans the world model.

Block distinguishes two world models. The company world model is how the organization understands itself: what is being built, what is blocked, where resources are allocated, what is working and what is not. The customer world model is a per-customer, per-merchant understanding built from honest signal -- in Block's case, transaction data. Most companies using AI today are focused on the customer world model (recommendation engines, churn prediction, personalization). Far fewer are building the company world model. That is where the organizational transformation lives.

> [!case-study]
> **Block / Sequoia (Dorsey & Botha, March 2026)** -- "Most companies using AI today are giving everyone a copilot, which makes the existing structure work slightly better without changing it. We're after something different: a company built as an intelligence." Block argues that a continuously updated model of the entire business can replace what hierarchy used to carry: context, alignment, and coordination across thousands of people.

## Block's Four Pillars

In their Sequoia essay, Dorsey and Botha propose that a world-model-driven company builds four things instead of traditional product roadmaps. We summarize their framework here because it maps directly to how we think about `ainative-business`'s architecture:

**First, capabilities** — the atomic primitives of the business. For Block, these are financial services (payments, lending, payroll). For a software platform like `ainative-business`, they are the core operations: task execution, workflow orchestration, document processing, scheduling. These are not products with UIs. They are reliable, composable building blocks.

**Second, a world model** — the live representation of organizational and customer state. Dorsey distinguishes a *company world model* (how the organization understands itself) from a *customer world model* (per-user understanding from real behavioral data). Most AI efforts focus on the customer side. The transformative move is building the company side.

**Third, an intelligence layer** — the system that composes capabilities in response to signals from the world model. In Dorsey and Botha's example, Block's intelligence layer might detect a merchant's seasonal cash flow dip and proactively compose a short-term loan from the lending capability. No product manager planned that specific interaction — the system composed it from available parts. This is the pattern `ainative-business`'s workflow engine aspires to.

**Fourth, interfaces** — the delivery surfaces (apps, dashboards, APIs) through which composed solutions reach users. Dorsey and Botha argue these are important but not where the value lives. The value is in the model and the intelligence.

The most radical insight is what happens when the intelligence layer fails. As Dorsey and Botha put it: "When the intelligence layer tries to compose a solution and can't because the capability doesn't exist, that failure signal is the future roadmap." The traditional roadmap — where product managers hypothesize about what to build next — becomes, in their framing, the company's "ultimate limiting factor."

This framework maps cleanly to what we have been building throughout this book. `ainative-business`'s agent profiles are capabilities. Its database is the embryonic world model. Its workflow engine and agent execution layer form the intelligence layer. Its Next.js interface is the delivery surface. And when an agent encounters a task it cannot complete -- a missing tool, an unavailable profile, an unresolvable dependency -- that is exactly the failure signal Dorsey describes.

## Harvey's Spectre

Harvey, the AI-native legal platform, arrived at a similar insight from a different direction. Their internal agent system, Spectre, started as a productivity tool for engineering. It evolved into something more fundamental.

"In practice, Spectre is the beginning of a company world model: a live picture of what is happening inside Harvey and what needs to happen next."

The critical distinction is in what triggers Spectre's work. Much of what it does is no longer triggered by a human prompt. It is triggered by the system monitoring the company and making decisions based on incidents, bug reports, customer feedback, and Slack messages. Spectre watches the organizational state and acts when patterns emerge that require attention.

This is the difference between a copilot and a world model. A copilot waits for you to ask. A world model notices before you do. Harvey's engineers became so productive that they were harder to coordinate. The bottlenecks shifted from implementation to review, prioritization, coordination, and operating design. Spectre addressed this by maintaining the live picture -- the world model -- that enabled coordination without human intermediation.

Harvey's CEO, Gabe Pereyra, frames the broader implication clearly: "Leverage is no longer about how much one organization can produce; it's found in how much context people, teams, and institutions can coordinate across humans and agents." The world model is the coordination mechanism.

> [!case-study]
> **Harvey Spectre** -- "In practice, Spectre is the beginning of a company world model: a live picture of what is happening inside Harvey and what needs to happen next." Spectre is monitoring-triggered, not prompt-triggered. It watches organizational state and acts when patterns emerge, shifting the bottleneck from implementation to coordination and judgment.

## ainative's Embryonic World Model

We are not Block or Harvey. We do not have millions of transactions or hundreds of engineers. But we have the same architectural foundation, and it is worth examining what we already have.

`ainative-business`'s world model lives in ten database tables:

| Table | What It Captures |
|---|---|
| `projects` | Organizational units with working directories, descriptions, status |
| `tasks` | Individual work items with status, agent assignment, profile routing |
| `workflows` | Multi-step orchestration definitions and execution state |
| `agent_logs` | Every agent action: prompts, responses, tool calls, errors |
| `notifications` | Human-in-the-loop approvals, alerts, escalations |
| `documents` | Uploaded files with extracted text and processing metadata |
| `schedules` | Time-based triggers for recurring agent work |
| `learned_context` | Agent-discovered patterns and institutional knowledge |
| `settings` | System configuration, permissions, auth methods |
| `usage_ledger` | Resource consumption tracking across agents and projects |

Every action in the system creates a queryable artifact. When an agent executes a task, it writes to `agent_logs`. When a workflow completes a step, it updates `workflows` state. When a schedule fires, it creates entries in `tasks` and `agent_logs`. When a human approves or denies a tool permission, that decision is recorded in `notifications` and `settings`.

This is not yet a world model in Block's sense. It is a database. But it is a database designed from the start to be queryable by agents, not just by humans. And that design choice -- making organizational state machine-readable -- is the prerequisite for everything that follows.

```typescript
// Building with ainative: Querying the organizational world model
// Every action in ainative creates queryable state

// What's the health of Project X?
const project = await fetch("/api/projects/proj-8f3a-4b2c").then(r => r.json());
const tasks = await fetch(`/api/tasks?projectId=${project.id}`).then(r => r.json());
const workflows = await fetch(`/api/workflows?projectId=${project.id}`).then(r => r.json());

// The world model: tasks by status, agent performance, workflow completion rates
const blocked = tasks.filter((t: any) => t.status === "blocked");
const avgCompletionTime = tasks
  .filter((t: any) => t.status === "completed")
  .reduce((sum: number, t: any) => sum + (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()), 0) / tasks.length;

// Agents can query this same state to make decisions
// "Project X has 3 blocked tasks — should I escalate or attempt to unblock?"
```

The dashboard in `ainative-business` is not decoration. It is the first intelligence surface built on top of the world model. It shows task distribution by status, agent activity over time, workflow completion rates, and project health. Today a human reads it. Tomorrow an agent reads the same data through the same APIs and decides what to do about it.

## From Database to Intelligence

The evolution from database to world model to organizational intelligence follows a predictable path. We can see five stages, and `ainative-business` is currently between the first and second.

**Stage 1: Static Tables.** Data exists. You can query it. But nothing acts on the queries autonomously. This is where most project management tools live forever. You have a Jira board. You look at it. You decide what to do.

**Stage 2: Queryable State.** Agents can read organizational state through APIs and make decisions based on what they find. "Project X has 3 blocked tasks. Task Y has been waiting for 3 days. The agent assigned to Task Y has failed twice." `ainative-business` is entering this stage. Agents can query tasks, read logs, check project status, and use that context to inform their execution.

**Stage 3: Proactive Insights.** The system does not wait to be asked. Scheduled agents scan the world model and surface patterns. "Every Monday morning, three projects have tasks that have been idle for more than 48 hours. Here is a prioritized list." This is what Harvey's Spectre does. `ainative-business`'s scheduled loops are the foundation for this stage.

**Stage 4: Causal Models.** The system understands not just what is happening but why. "Task Y is blocked because Document Z has not been processed, and Document Z has not been processed because the PDF processor failed on a corrupted file." Causal chains enable the system to suggest fixes, not just report problems. This requires the learned_context table to accumulate enough patterns to build dependency graphs.

**Stage 5: Predictive Intelligence.** The system anticipates. "Based on historical patterns, this project is likely to miss its deadline by 4 days. Here are three interventions that have resolved similar situations in the past." This is the full world model: a causal, predictive, continuously learning representation of organizational reality.

> [!case-study]
> **8090 Knowledge Graph** -- "A living map that propagates changes forward and backward automatically across every artifact." 8090's Software Factory binds its five stations (Refinery, Foundry, Planner, Validator, Knowledge Graph) with a graph that captures not just what decisions were made but why. When requirements shift, changes propagate automatically. This is institutional memory that compounds with every project -- the organizational equivalent of compound interest.

## ainative Today

Today's `ainative-business` world model is Stage 1 trending toward Stage 2. The ten tables capture organizational state. The APIs expose it. Agents can query it during task execution. The dashboard renders it for humans.

What makes this foundation viable is a design principle that runs throughout the codebase: every action creates an artifact. There are no side-channel communications, no unrecorded decisions, no tribal knowledge that exists only in someone's head. When an agent executes a task, the full conversation -- prompts, responses, tool calls, errors -- is recorded in `agent_logs`. When a workflow transitions between steps, the state change is written to the database. When a human makes a permission decision, it is stored in `settings` and `notifications`.

This is the "remote-first" advantage that Dorsey describes at Block. "Everything we do creates artifacts. Decisions, discussions, code, designs, plans, problems, and progress all exist as recorded actions. It's the raw material for a company world model." `ainative-business` is remote-first by nature -- it is a software system where all state is machine-readable. The world model is not something we need to build on top. It is something that emerges from the data we are already capturing.

The learned_context table deserves special attention. When agents discover patterns during execution -- a particular approach that works well for a type of task, a common failure mode, a useful piece of organizational knowledge -- they can propose learned context entries. These accumulate over time, forming the rudimentary causal layer. Today they are text entries that agents can query. Tomorrow they become nodes in a knowledge graph.

```typescript
// Building with ainative: Learned context as embryonic intelligence
// Agents propose context during execution; the system accumulates it

// After a task completes, the agent proposes what it learned
const learnedContext = {
  projectId: "proj-8f3a-4b2c",
  category: "failure-pattern",
  content: "PDF processing fails on files > 50MB. Workaround: split into chunks first.",
  source: "task-execution",
  confidence: 0.85,
};

// Future agents query this before starting similar tasks
const relevantContext = await fetch(
  `/api/learned-context?projectId=${project.id}&category=failure-pattern`
).then(r => r.json());

// The world model grows smarter with every task execution
```

## Roadmap Vision

The distance between `ainative-business`'s ten tables and Block's company world model is large but traversable. Here is what the path looks like.

**Full Knowledge Graph.** The learned_context table evolves into a proper graph database (or graph layer on top of SQLite). Nodes represent projects, tasks, agents, documents, decisions, and patterns. Edges represent relationships: "depends-on," "caused-by," "resolved-by," "similar-to." This is 8090's Knowledge Graph pattern: a living map that propagates changes forward and backward automatically.

**Emergent Roadmap.** When agents fail -- when the intelligence layer cannot compose a solution because the capability does not exist -- those failure signals are captured, clustered, and surfaced as roadmap candidates. No product manager hypothesizes about what to build next. The system tells you what is missing. This is the most radical idea in Dorsey's framework, and it is technically achievable once the failure signals are structured and queryable.

**Digital Twins.** Josh Bersin and Viven.ai describe "the intelligence of the entire team as if it's one person." A digital twin of the organization that can answer questions like "if we add two more engineers to this project, what happens to the timeline?" or "which agent profile is most effective for compliance tasks?" This requires the predictive layer -- Stage 5 -- but the foundation is agent performance data that `ainative-business` already captures in the usage_ledger.

**Generation at Scale.** Duolingo shipped 148 courses in one year after spending twelve years building the first set manually. The world model -- understanding what a good course looks like, what learners struggle with, how content should progress -- enabled generation at a pace that manual processes could never match. The same principle applies to any organization with a rich enough world model: once the model understands the patterns, it can generate new instances faster than humans can plan them.

The world model is not a feature. It is the organizing principle of the AI-native organization. Every table we add, every log we capture, every learned context entry an agent proposes -- these are neurons in an organizational brain that is slowly learning to think. The hierarchy carried information for two thousand years because nothing else could. Now something else can. The question is whether we build it deliberately or let it emerge chaotically from disconnected tools and siloed data.

Block is betting on deliberate construction. So are we.
