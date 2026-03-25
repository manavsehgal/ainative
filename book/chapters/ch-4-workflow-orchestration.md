---
title: "Workflow Orchestration"
subtitle: "From Linear Sequences to Adaptive Blueprints"
chapter: 4
part: 2
readingTime: 14
relatedDocs: [workflows, agent-intelligence]
relatedJourney: power-user
---

# Workflow Orchestration

## The Problem

Individual tasks are solved. But real work isn't a series of independent tasks—it's a *workflow*. Tasks depend on each other. Outputs flow from one step to the next. Failures need to be caught and handled. And the whole sequence needs to be observable. Stagent's workflow engine turns linear task sequences into adaptive, observable pipelines.

This is a truth that becomes painfully obvious the moment you move past demos. In Chapter 2, we built a task execution engine that could dispatch work to specialized agents, manage permissions, and stream results back to the UI. That engine is powerful for single tasks. But hand it a real business process — say, "research competitor pricing, draft a comparison report, get approval from the product lead, then update the pricing page" — and you quickly realize that the hard part is not executing any single step. It is coordinating the whole sequence.

The workflow orchestration problem is not new. The enterprise software world has been building workflow engines for decades. Apache Airflow, introduced by Airbnb in 2014, brought DAG-based scheduling to data engineering. Prefect emerged as a more Pythonic alternative, emphasizing flow-as-code and first-class error handling. Temporal took a different angle entirely, modeling workflows as durable functions that survive process crashes. These are mature, battle-tested systems. They are also designed for a world where every step is deterministic — where a "task" is a Python function with defined inputs and outputs, not an AI agent that might interpret the same prompt differently on every run.

The AI agent orchestration space is younger and wilder. LangGraph, LangChain's graph-based orchestration layer, lets you model agent workflows as state machines with conditional edges. CrewAI assigns agents distinct roles and manages delegation between them. AutoGen from Microsoft models multi-agent conversations as message-passing protocols. Each framework is grappling with the same fundamental tension: agents are not functions. They are stochastic, context-dependent, and capable of surprising you — for better or worse.

When I started designing Stagent's workflow layer, I studied all of these systems. What I noticed was a recurring pattern: the frameworks that tried to be maximally general ended up being maximally complex. LangGraph is powerful, but defining a non-trivial workflow requires understanding state schemas, conditional edges, checkpointing, and a custom execution model. Temporal is brilliant for durability, but its programming model — activities, signals, queries, child workflows — has a steep learning curve.

I wanted something simpler. Not simpler in capability, but simpler in concept. A workflow engine where the six most common patterns are first-class citizens, where the coordination logic fits in a single file, and where you can read the execution path for any workflow without a PhD in distributed systems. The result is a pattern-based engine that trades generality for clarity — and in practice, covers every workflow I have needed to build.

> [!info]
> **Why Not a DAG?**
> Traditional workflow engines model arbitrary directed acyclic graphs. Stagent uses named patterns instead. This is a deliberate constraint: six well-understood patterns are easier to reason about, test, and observe than arbitrary graph topologies. If a workflow does not fit one of the six patterns, it is usually a sign that the workflow needs to be decomposed into smaller, composable pieces.

## Six Orchestration Patterns

The type system tells the story. Every workflow in Stagent declares its orchestration pattern upfront, and the engine uses that declaration to select the right execution strategy. This is not a plugin system or an abstract graph — it is a closed set of patterns that I chose because they cover the workflows I have actually encountered in production use.

<!-- filename: src/lib/workflows/types.ts -->
```typescript
export type WorkflowPattern =
  | "sequence"
  | "planner-executor"
  | "checkpoint"
  | "autonomous-loop"
  | "parallel-research"
  | "multi-agent-swarm";

export interface WorkflowStep {
  id: string;
  name: string;
  agentProfile?: string;
  prompt: string;
  dependsOn?: string[];
  requiresApproval?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  pattern: WorkflowPattern;
  steps: WorkflowStep[];
  createdAt: string;
}
```
> Six patterns cover the full spectrum from simple sequences to multi-agent coordination

Let me walk through each pattern and explain not just what it does, but when and why you would reach for it.

**Sequence** is the workhorse. Steps execute one after another, and each step receives the output of the previous step as context. This is the pattern for "do A, then B, then C" workflows where the order is fixed and every step depends on the one before it. Research a topic, then write a summary, then format it as a blog post. The simplicity is the point — there is no branching logic, no parallelism, no approval gates. Just a chain of agent calls with context flowing forward.

**Planner-Executor** introduces a metacognitive layer. The first step is always a planning step: the agent analyzes the overall goal and produces a structured plan. Subsequent steps execute that plan, with the plan itself injected as context. This is the pattern I reach for when the task is ambiguous or when the decomposition itself requires intelligence. "Refactor this module for better testability" is a task where the planning — which functions to extract, which patterns to apply, what the test strategy should be — is half the work.

**Checkpoint** adds human approval gates between steps. It is identical to Sequence in execution flow, but any step can be marked `requiresApproval: true`, which pauses the workflow and sends a notification to the user. The workflow resumes only when the human approves or rejects. This is the pattern for compliance-sensitive workflows, for anything involving external communication, or for any process where a wrong intermediate step would be expensive to undo. Draft a contract, get legal review, then send to the client.

**Autonomous Loop** is for iterative refinement. Instead of a fixed sequence, the agent runs repeatedly — analyzing output, identifying improvements, and running again — until a stop condition is met. That stop condition might be a maximum iteration count, a time budget, an explicit signal from the agent ("I'm satisfied with this output"), or a human pressing the pause button. This is the pattern for code generation with test feedback, for document editing with quality thresholds, for any task where the agent needs to converge on a solution through multiple passes. The loop executor tracks iteration state, duration, and stop reasons, giving you full visibility into the refinement process.

**Parallel Research** fans work out to multiple agents simultaneously, then synthesizes the results. Branch steps execute concurrently (up to a configurable concurrency limit), and a synthesis step waits for all branches to complete before combining their outputs. This is the pattern for research tasks where you want multiple perspectives: have one agent research market data, another analyze competitor products, a third survey customer feedback, then synthesize all three into a strategic recommendation. The concurrency limit (defaulting to three) prevents overwhelming system resources while still delivering meaningful parallelism.

**Multi-Agent Swarm** is the most sophisticated pattern. A coordinator agent breaks the work into subtasks, worker agents execute those subtasks concurrently, and a refinery step integrates and polishes the combined output. Unlike Parallel Research, where the branches are predefined by the human, the Swarm pattern lets the coordinator agent decide how to decompose the work. This is emergent coordination — the human defines the goal, and the swarm figures out how to divide and conquer.

> [!tip]
> **Pattern Selection Heuristic**
> Start with Sequence. Switch to Checkpoint if you need human approval gates between steps. Use Parallel Research when independent sub-problems can be explored simultaneously. Graduate to Planner-Executor when the decomposition itself is complex. Reach for Autonomous Loop when iterative refinement will outperform single-pass execution. Reserve Multi-Agent Swarm for problems where the work breakdown is too complex or dynamic for a human to predefine.

The progression through these patterns mirrors a broader principle I keep returning to: **Progressive Autonomy**. You do not start with a swarm. You start with a sequence, build confidence in the agent's capabilities, and gradually increase the complexity of the orchestration as trust is established. The patterns are ordered by autonomy level — Sequence gives the human the most control over structure, Swarm gives the least — and the right choice depends on how much you trust the agents involved and how costly a mistake would be.

## The Workflow Engine

The engine is responsible for five things: step scheduling (what runs when), agent dispatching (who runs it), state management (where are we), context passing (what does each step know about previous steps), and error handling (what happens when things go wrong). These responsibilities live in a single file, and the core execution loop is readable enough that I can show it here without simplification.

<!-- filename: src/lib/workflows/engine.ts -->
```typescript
export async function executeWorkflow(workflowId: string): Promise<void> {
  const workflow = await getWorkflow(workflowId);
  await updateWorkflowStatus(workflowId, "running");

  for (const step of resolveExecutionOrder(workflow.steps)) {
    if (step.requiresApproval) {
      await createApprovalNotification(workflowId, step);
      await waitForApproval(workflowId, step.id);
    }

    const profile = step.agentProfile ?? "general";
    const context = await buildStepContext(workflow, step);

    try {
      const result = await executeStep(step, profile, context);
      await saveStepResult(workflowId, step.id, result);
    } catch (error) {
      await handleStepFailure(workflowId, step, error);
      break;
    }
  }

  await updateWorkflowStatus(workflowId, "completed");
}
```
> The core execution loop — resolve order, check approvals, dispatch, collect results

There are several architectural decisions embedded in this loop that are worth unpacking.

**Fire-and-forget execution.** The API route that starts a workflow returns immediately with a 202 Accepted status. The `executeWorkflow` function runs in the background as an unawaited promise. This keeps the UI responsive — the user sees the workflow start instantly, and progress updates flow back through the database. This is the same pattern we use for individual task execution, and it works for the same reason: long-running AI operations should never block request-response cycles.

**Database as coordination layer.** Every state transition — step started, step completed, step failed, waiting for approval — is written to the database. The UI polls this state to render progress. The approval flow works through the notifications table: the engine writes a notification, then polls for the human's response. This is not the most efficient coordination mechanism (WebSockets would be faster), but it has a property I value more than efficiency: crash recovery. If the server restarts mid-workflow, the state is in the database, not in memory. A future version could resume from the last completed step.

**Context chaining.** Each step receives the output of the previous step as part of its prompt. This is how information flows through the workflow without an external state store. The Sequence pattern passes raw output forward. The Planner-Executor pattern injects the plan into every executor step. The Parallel pattern collects all branch outputs and feeds them to the synthesis step. The context passing is pattern-specific, but the principle is universal: every step should know what came before it.

**Fail-fast with observability.** When a step fails, the engine stops the workflow (for sequential patterns) and records the error in both the workflow state and the agent logs table. This is a deliberate choice. Some workflow engines offer retry policies, exponential backoff, and automatic fallback to alternative execution paths. I considered all of these and decided they add complexity without proportional value for AI agent workflows. When an agent fails, the failure is usually semantic (it misunderstood the task, or the task was impossible) rather than transient (a network timeout). Retrying a semantic failure just burns tokens. Better to stop, show the human what happened, and let them decide whether to retry, modify the prompt, or abandon the workflow.

**Learning sessions.** One detail worth noting: the engine opens a "learning session" at workflow start and closes it at workflow end. During execution, agents can propose context they have learned — patterns they noticed, domain knowledge they inferred, corrections to earlier assumptions. These proposals are buffered during the session and presented as a single batch notification when the workflow completes. This turns every workflow execution into a potential learning event, where the system gets smarter not just by completing work, but by reflecting on it.

![Book reader showing a live workflow execution with step progress](/book/images/book-reader-workflow.png "This is a live workflow execution in the book reader itself. When you triggered the Deep Dive reading path, it started a three-step workflow: research the chapter topic, synthesize with your reading history, and generate personalized commentary. The progress bar above is real — you are watching an actual workflow engine run.")

![Workflow progress dashboard with execution metrics and step status](/book/images/workflow-progress.png "The workflow progress view shows real execution metrics. Each step displays its agent profile, duration, and output status. The total workflow duration, token usage, and step-by-step timeline are all drawn from the same database state that the engine writes to during execution.")

## Designing Workflows: Human as Architect

There is a subtle but important shift that happens when you introduce workflow orchestration into an AI-native application. Without workflows, the human is an operator — they write prompts, review outputs, iterate on results. With workflows, the human becomes an architect. They design the structure of work rather than performing it.

This is the **Human as System Designer** pattern in action. Consider the difference between these two approaches to generating a quarterly business review:

Without workflows: "Write a quarterly business review for Q1 2026. Include financial performance, customer metrics, product milestones, and strategic outlook." The human writes one prompt, gets one output, and then spends an hour editing and supplementing it.

With a Planner-Executor workflow: The human defines a two-phase workflow. Phase one: "Analyze the Q1 data and produce a structured outline for a quarterly business review, identifying the key metrics and narratives for each section." Phase two: "Using the outline from the planning phase, write a complete quarterly business review with specific data, charts, and strategic recommendations." The human designed the process. The agents did the work. And the output is better, because the planning step forced the agent to think about structure before diving into prose.

With a Parallel Research workflow: The human goes further. Four branch agents — one for financials, one for customer metrics, one for product milestones, one for competitive landscape — work simultaneously on their sections. A synthesis agent weaves the sections into a coherent narrative. The human designed a five-agent orchestra and conducted it by defining the workflow structure.

This progression — from operator to architect — is where the real productivity gains live. The individual agent capabilities do not change. What changes is the human's relationship to the work. They stop doing and start designing.

> [!tip]
> **Workflow Templates Save Hours**
> Once you have designed a workflow that works well, save it as a template. The quarterly business review workflow, the code review pipeline, the content publishing workflow — these are reusable blueprints that encode organizational knowledge about how work should be structured. Templates turn one human's workflow design into an institutional asset.

## Context Propagation and Document Awareness

One of the trickier problems in workflow orchestration is ensuring that every step has access to the right context — not just the output of previous steps, but the original documents and data that motivated the workflow in the first place.

In Stagent, this is handled through document context propagation. When a workflow is created from a task that has attached documents, the workflow definition stores a `sourceTaskId` reference. The engine uses this reference to build document context — extracted text from attached files — and injects it into each step's prompt alongside the step-specific context.

This means that a research workflow can reference the original brief throughout all of its steps. A document review workflow can give every agent access to the source document. The context does not degrade as it passes through the chain — each step gets the full picture, not a summary of a summary.

This is a lesson I learned the hard way. Early versions of the workflow engine only passed the previous step's output forward. By step four of a five-step workflow, the agents had lost all connection to the original intent. They were operating on a telephone-game version of the context, and the results showed it. Adding document context propagation fixed this entirely — every step can go back to the source.

## Observability as a First-Class Concern

Every workflow engine in the industry eventually adds observability. Airflow has its web UI with DAG run views and task instance logs. Prefect has its dashboard with flow run timelines. Temporal has its web interface for inspecting workflow histories. Observability is not optional — when a workflow fails at step seven of twelve, you need to know exactly what happened, what the agent saw, and what it produced.

Stagent's approach to observability is built on two pillars: structured agent logs and workflow state snapshots.

Every significant event — workflow started, step dispatched, step completed, step failed, approval requested, approval granted — is recorded in the agent logs table with a structured JSON payload. These logs are immutable and timestamped, forming an audit trail that can answer any question about what happened during execution.

The workflow state itself is a JSON document stored alongside the workflow record and updated after every state transition. It contains the status of every step, the current step index, timing information, and error details. The UI polls this state to render real-time progress views — you can watch a workflow execute step by step, seeing each agent spin up, work, and complete.

This dual approach — immutable event log plus mutable state snapshot — gives you the best of both worlds. The state snapshot is fast to query for current status. The event log is complete for post-mortem analysis.

## Lessons Learned

**Context Batching Matters.** Early versions of the engine passed context between steps as raw strings, concatenating previous outputs with new prompts. This worked for two-step workflows. By step five, the context window was dominated by intermediate outputs that were no longer relevant. The fix was context batching — summarizing previous outputs at key checkpoints rather than accumulating everything. The agent sees a concise summary of where the workflow has been, not a transcript of everything that happened.

**Templates Over Copy-Paste.** The first workflow I built in Stagent was a content publishing pipeline: research, outline, draft, review, publish. I built it by hand, step by step, in the workflow creation UI. The second time I needed the same pipeline, I copied the configuration. The third time, I realized this was absurd and built the template system. Workflow templates — reusable definitions with placeholder variables — eliminated the copy-paste problem and created a shared library of organizational best practices. If you find yourself building the same workflow twice, make it a template.

**Observability Is the Feature.** I initially thought of the workflow progress view as a nice-to-have — a dashboard for people who like watching progress bars. I was wrong. Observability is what makes the entire system trustworthy. When a user can see exactly which step is running, what the agent is doing, how long it has been working, and what the intermediate results look like, they trust the system enough to run workflows without hovering. When the workflow fails, they can diagnose the problem in seconds instead of guessing. The observability layer is not a debugging tool. It is the feature that makes Progressive Autonomy possible, because you cannot grant autonomy to a system you cannot see.

The workflow engine is where Stagent stops being a task runner and starts being a work orchestrator. Individual tasks prove that agents can do work. Workflows prove that agents can do *coordinated* work — and that humans can design the coordination rather than performing the work themselves. In the next chapter, we will look at what happens when you add scheduling to this mix, turning one-shot workflows into recurring, self-maintaining processes.

[Try: Create a Workflow](/workflows)
