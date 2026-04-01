---
title: "Workflow Orchestration"
subtitle: "From Linear Sequences to Adaptive Blueprints"
chapter: 4
part: 2
readingTime: 14
relatedDocs: [workflows, agent-intelligence]
relatedJourney: power-user
lastGeneratedBy: "2026-03-31T21:00:00Z"
---

# Workflow Orchestration

## The Problem

Individual tasks are solved. But real work isn't a series of independent tasks -- it's a *workflow*. Tasks depend on each other. Outputs flow from one step to the next. Failures need to be caught and handled. And the whole sequence needs to be observable. Stagent's workflow engine turns linear task sequences into adaptive, observable pipelines.

This is a truth that becomes painfully obvious the moment you move past demos. In Chapter 2, we built a task execution engine that could dispatch work to specialized agents across five different runtimes, manage permissions, and stream results back to the UI. That engine is powerful for single tasks. But hand it a real business process -- say, "research competitor pricing, draft a comparison report, get approval from the product lead, then update the pricing page" -- and you quickly realize that the hard part is not executing any single step. It is coordinating the whole sequence.

The workflow orchestration problem is not new. The enterprise software world has been building workflow engines for decades. Apache Airflow, introduced by Airbnb in 2014, brought DAG-based scheduling to data engineering. Prefect emerged as a more Pythonic alternative, emphasizing flow-as-code and first-class error handling. Temporal took a different angle entirely, modeling workflows as durable functions that survive process crashes. These are mature, battle-tested systems. They are also designed for a world where every step is deterministic -- where a "task" is a Python function with defined inputs and outputs, not an AI agent that might interpret the same prompt differently on every run.

The AI agent orchestration space is younger and wilder. LangGraph, LangChain's graph-based orchestration layer, lets you model agent workflows as state machines with conditional edges. CrewAI assigns agents distinct roles and manages delegation between them. AutoGen from Microsoft models multi-agent conversations as message-passing protocols. Each framework is grappling with the same fundamental tension: agents are not functions. They are stochastic, context-dependent, and capable of surprising you -- for better or worse.

When we started designing Stagent's workflow layer, we studied all of these systems. What we noticed was a recurring pattern: the frameworks that tried to be maximally general ended up being maximally complex. LangGraph is powerful, but defining a non-trivial workflow requires understanding state schemas, conditional edges, checkpointing, and a custom execution model. Temporal is brilliant for durability, but its programming model -- activities, signals, queries, child workflows -- has a steep learning curve.

We wanted something simpler. Not simpler in capability, but simpler in concept. A workflow engine where the six most common patterns are first-class citizens, where the coordination logic fits in a single file, and where you can read the execution path for any workflow without a PhD in distributed systems. The result is a pattern-based engine that trades generality for clarity -- and in practice, covers every workflow we have needed to build.

> [!info]
> **Why Not a DAG?**
> Traditional workflow engines model arbitrary directed acyclic graphs. Stagent uses named patterns instead. This is a deliberate constraint: six well-understood patterns are easier to reason about, test, and observe than arbitrary graph topologies. If a workflow does not fit one of the six patterns, it is usually a sign that the workflow needs to be decomposed into smaller, composable pieces.

## Six Orchestration Patterns

The type system tells the story. Every workflow in Stagent declares its orchestration pattern upfront, and the engine uses that declaration to select the right execution strategy. This is not a plugin system or an abstract graph -- it is a closed set of patterns that we chose because they cover the workflows we have actually encountered in production use.

<!-- filename: src/lib/workflows/types.ts -->
```typescript
export type WorkflowPattern =
  | "sequence"
  | "planner-executor"
  | "checkpoint"
  | "loop"
  | "parallel"
  | "swarm";

export interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  requiresApproval?: boolean;
  dependsOn?: string[];
  assignedAgent?: string;
  agentProfile?: string;
}

export interface WorkflowDefinition {
  pattern: WorkflowPattern;
  steps: WorkflowStep[];
  loopConfig?: LoopConfig;
  swarmConfig?: SwarmConfig;
  /** Parent task ID -- used to propagate document context */
  sourceTaskId?: string;
}
```
> Six patterns cover the full spectrum from simple sequences to multi-agent coordination

Let us walk through each pattern and explain not just what it does, but when and why you would reach for it.

**Sequence** is the workhorse. Steps execute one after another, and each step receives the output of the previous step as context. This is the pattern for "do A, then B, then C" workflows where the order is fixed and every step depends on the one before it. Research a topic, then write a summary, then format it as a blog post. The simplicity is the point -- there is no branching logic, no parallelism, no approval gates. Just a chain of agent calls with context flowing forward.

**Planner-Executor** introduces a metacognitive layer. The first step is always a planning step: the agent analyzes the overall goal and produces a structured plan. Subsequent steps execute that plan, with the plan itself injected as context. This is the pattern we reach for when the task is ambiguous or when the decomposition itself requires intelligence. "Refactor this module for better testability" is a task where the planning -- which functions to extract, which patterns to apply, what the test strategy should be -- is half the work.

**Checkpoint** adds human approval gates between steps. It is identical to Sequence in execution flow, but any step can be marked `requiresApproval: true`, which pauses the workflow and sends a notification to the user. The workflow resumes only when the human approves or rejects. This is the pattern for compliance-sensitive workflows, for anything involving external communication, or for any process where a wrong intermediate step would be expensive to undo. Draft a contract, get legal review, then send to the client.

**Loop** is for iterative refinement. Instead of a fixed sequence, the agent runs repeatedly -- analyzing output, identifying improvements, and running again -- until a stop condition is met. That stop condition might be a maximum iteration count, a time budget, an explicit signal from the agent ("I am satisfied with this output"), or a human pressing the pause button. The loop executor tracks iteration state, duration, and stop reasons, giving you full visibility into the refinement process.

**Parallel** fans work out to multiple agents simultaneously, then synthesizes the results. Branch steps execute concurrently (up to a configurable concurrency limit), and a synthesis step waits for all branches to complete before combining their outputs. This is the pattern for research tasks where you want multiple perspectives: have one agent research market data, another analyze competitor products, a third survey customer feedback, then synthesize all three into a strategic recommendation.

**Swarm** is the most sophisticated pattern. A coordinator agent breaks the work into subtasks, worker agents execute those subtasks concurrently, and a refinery step integrates and polishes the combined output. Unlike Parallel, where the branches are predefined by the human, the Swarm pattern lets the coordinator agent decide how to decompose the work. This is emergent coordination -- the human defines the goal, and the swarm figures out how to divide and conquer.

> [!tip]
> **Pattern Selection Heuristic**
> Start with Sequence. Switch to Checkpoint if you need human approval gates between steps. Use Parallel when independent sub-problems can be explored simultaneously. Graduate to Planner-Executor when the decomposition itself is complex. Reach for Loop when iterative refinement will outperform single-pass execution. Reserve Swarm for problems where the work breakdown is too complex or dynamic for a human to predefine.

The progression through these patterns mirrors a broader principle we keep returning to: **Progressive Autonomy**. You do not start with a swarm. You start with a sequence, build confidence in the agent's capabilities, and gradually increase the complexity of the orchestration as trust is established. The patterns are ordered by autonomy level -- Sequence gives the human the most control over structure, Swarm gives the least -- and the right choice depends on how much you trust the agents involved and how costly a mistake would be.

## The Workflow Engine

The engine is responsible for five things: step scheduling (what runs when), agent dispatching (who runs it), state management (where are we), context passing (what does each step know about previous steps), and error handling (what happens when things go wrong). These responsibilities live in a single file, and the core execution loop is readable enough that we can show it here without simplification.

<!-- filename: src/lib/workflows/engine.ts -->
```typescript
export async function executeWorkflow(workflowId: string): Promise<void> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId));

  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const definition: WorkflowDefinition = JSON.parse(workflow.definition);
  const state = createInitialState(definition);
  const parentTaskId: string | undefined = definition.sourceTaskId ?? undefined;

  await updateWorkflowState(workflowId, state, "active");

  // Open a learning session to buffer context proposals during execution.
  openLearningSession(workflowId);

  // Loop pattern manages its own lifecycle -- delegate fully
  if (definition.pattern === "loop") {
    try {
      await executeLoop(workflowId, definition);
    } finally {
      await closeLearningSession(workflowId).catch(console.error);
    }
    return;
  }

  try {
    switch (definition.pattern) {
      case "sequence":
        await executeSequence(workflowId, definition, state, parentTaskId);
        break;
      case "planner-executor":
        await executePlannerExecutor(workflowId, definition, state, parentTaskId);
        break;
      case "checkpoint":
        await executeCheckpoint(workflowId, definition, state, parentTaskId);
        break;
      // ... parallel, swarm
    }
  } finally {
    await closeLearningSession(workflowId).catch(console.error);
  }
}
```
> The core execution loop -- resolve pattern, open learning session, dispatch, collect results

There are several architectural decisions embedded in this code that are worth unpacking.

**Fire-and-forget execution.** The API route that starts a workflow returns immediately with a 202 Accepted status. The `executeWorkflow` function runs in the background as an unawaited promise. This keeps the UI responsive -- the user sees the workflow start instantly, and progress updates flow back through the database. This is the same pattern we use for individual task execution, and it works for the same reason: long-running AI operations should never block request-response cycles.

**Database as coordination layer.** Every state transition -- step started, step completed, step failed, waiting for approval -- is written to the database. The UI polls this state to render progress. The approval flow works through the notifications table: the engine writes a notification, then polls for the human's response. This is not the most efficient coordination mechanism (WebSockets would be faster), but it has a property we value more than efficiency: crash recovery. If the server restarts mid-workflow, the state is in the database, not in memory.

**Multi-runtime dispatch.** Each step can specify its own agent profile and runtime. A workflow might use Claude Code SDK for a code-generation step, Anthropic Direct for a research step, and Codex App Server for a step that requires OpenAI-specific capabilities. The smart runtime router evaluates cost and capability requirements per step, so a five-step workflow might execute across three different providers without the user thinking about provider selection at all.

**Learning sessions.** The engine opens a "learning session" at workflow start and closes it at workflow end. During execution, agents can propose context they have learned -- patterns they noticed, domain knowledge they inferred, corrections to earlier assumptions. These proposals are buffered during the session and presented as a single batch notification when the workflow completes. This turns every workflow execution into a potential learning event, where the system gets smarter not just by completing work, but by reflecting on it.

## The Blueprint Gallery

One of the most impactful additions to the workflow system is the blueprint gallery. Early users consistently told us the same thing: "I love the patterns, but I don't know where to start." The gallery solves this by providing pre-built workflow templates for common business processes that users can instantiate, customize, and run immediately.

Blueprints are defined as YAML files -- both built-in templates that ship with Stagent and user-created templates stored in a configurable directory. The registry scans both directories, validates each blueprint against a Zod schema, and presents them in the UI as a browsable catalog.

<!-- filename: src/lib/workflows/blueprints/registry.ts -->
```typescript
function scanDirectory(
  dir: string,
  isBuiltin: boolean
): Map<string, WorkflowBlueprint> {
  const blueprints = new Map<string, WorkflowBlueprint>();
  if (!fs.existsSync(dir)) return blueprints;

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    try {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const parsed = yaml.load(content);
      const result = BlueprintSchema.safeParse(parsed);
      if (!result.success) {
        console.warn(`[blueprints] Invalid blueprint ${file}:`,
          result.error.issues.map((i) => i.message).join(", "));
        continue;
      }
      blueprints.set(result.data.id, { ...result.data, isBuiltin });
    } catch (err) {
      console.warn(`[blueprints] Error loading ${file}:`, err);
    }
  }
  return blueprints;
}
```
> The blueprint registry -- YAML files validated through Zod, with user blueprints layered on top of built-ins

The gallery ships with two categories of blueprints. **Technical blueprints** cover developer workflows: code review pipelines, deploy-and-verify sequences, research synthesis, and documentation generation. **Business-function blueprints** cover operational workflows: lead research pipelines, content marketing pipelines, customer support triage, financial reporting, and business daily briefings.

Each business-function blueprint maps to one of the six new business profiles (Marketing Strategist, Sales Researcher, Customer Support Agent, Financial Analyst, Content Creator, Operations Coordinator). The sprint planning blueprint, for instance, uses the Project Manager profile for decomposition, the Researcher profile for context gathering, and the Document Writer profile for the final sprint document. This tight coupling between blueprints and profiles means that instantiating a blueprint automatically selects the right agent expertise for each step.

> [!tip]
> **Custom Blueprints**
> When you find yourself running the same workflow pattern repeatedly, export it as a YAML blueprint. Drop it into `~/.stagent/blueprints/` and it appears in the gallery alongside the built-ins. User blueprints can even override built-ins by using the same ID -- useful for adapting a generic "content pipeline" to your organization's specific review process.

## Agent Async Handoffs

The most significant architectural addition to workflow orchestration in recent sprints is agent async handoffs. Previously, agents could only collaborate within a predefined workflow structure -- step A feeds into step B, with the human defining the topology upfront. Handoffs break this constraint. An agent executing a task can dynamically delegate work to another profile through a message bus, without requiring a pre-built workflow definition.

The handoff system uses a governance-gated message bus. When a researcher agent discovers a code issue during an analysis task, it can call the `send_handoff` tool to delegate the issue to the code-reviewer profile. The handoff request surfaces in the user's inbox for approval before the receiving agent begins work.

<!-- filename: src/lib/agents/handoff/bus.ts -->
```typescript
export async function sendHandoff(request: HandoffRequest): Promise<string> {
  // Determine chain depth from parent message
  let chainDepth = 0;
  if (request.parentMessageId) {
    const [parent] = await db
      .select({ chainDepth: agentMessages.chainDepth })
      .from(agentMessages)
      .where(eq(agentMessages.id, request.parentMessageId));
    if (parent) chainDepth = parent.chainDepth + 1;
  }

  // Validate governance rules
  const validation = validateHandoff(request, chainDepth);
  if (!validation.valid) throw new Error(validation.error);

  const id = crypto.randomUUID();
  await db.insert(agentMessages).values({
    id,
    fromProfileId: request.fromProfileId,
    toProfileId: request.toProfileId,
    taskId: request.sourceTaskId,
    subject: request.subject.trim(),
    body: request.body.trim(),
    status: request.requiresApproval ? "pending" : "accepted",
    requiresApproval: request.requiresApproval ?? false,
    chainDepth,
    createdAt: new Date(),
  });
  return id;
}
```
> The handoff bus -- governance-gated delegation between agent profiles

Two safety mechanisms prevent handoffs from spiraling out of control. **Chain depth limits** cap how many times a handoff can chain from one agent to another (the default limit is 3). This prevents a researcher handing to a code-reviewer who hands to a document-writer who hands to a researcher in an infinite delegation loop. **Self-handoff blocking** prevents an agent from delegating to its own profile -- a degenerate case that would waste tokens without gaining a new perspective.

The handoff bus integrates with the scheduler tick loop. Pending handoffs are processed alongside schedule firings, which means approved handoffs execute within 60 seconds of approval without requiring a separate background process. This architectural choice -- piggybacking on the existing poll loop rather than adding a new one -- keeps the system simple while delivering responsive execution.

## Designing Workflows: Human as Architect

There is a subtle but important shift that happens when you introduce workflow orchestration into an AI-native application. Without workflows, the human is an operator -- they write prompts, review outputs, iterate on results. With workflows, the human becomes an architect. They design the structure of work rather than performing it.

This is the **Human as System Designer** pattern in action. Consider the difference between these two approaches to generating a quarterly business review:

Without workflows: "Write a quarterly business review for Q1 2026. Include financial performance, customer metrics, product milestones, and strategic outlook." The human writes one prompt, gets one output, and then spends an hour editing and supplementing it.

With a Parallel workflow using the Financial Analyst blueprint: Four branch agents -- one for financials using the Financial Analyst profile, one for customer metrics using the Data Analyst, one for product milestones using the Project Manager, a fourth for competitive landscape using the Researcher -- work simultaneously on their sections. Each step executes on the optimal runtime for its task (the Researcher might use Claude for nuanced analysis, while the Financial Analyst uses Codex for structured data processing). A synthesis agent weaves the sections into a coherent narrative. The human designed a five-agent orchestra and conducted it by defining the workflow structure.

> [!tip]
> **AI-Assisted Workflow Creation**
> You do not need to design workflows from scratch. The AI Assist feature analyzes a task description and recommends converting it into a workflow with appropriate steps, patterns, and profile assignments. Describe what you want to accomplish, and the system proposes the orchestration structure. You review, adjust, and run -- the system designs the coordination while you retain architectural control.

## Observability as a First-Class Concern

Every workflow engine in the industry eventually adds observability. Airflow has its web UI with DAG run views and task instance logs. Prefect has its dashboard with flow run timelines. Temporal has its web interface for inspecting workflow histories. Observability is not optional -- when a workflow fails at step seven of twelve, you need to know exactly what happened, what the agent saw, and what it produced.

Stagent's approach to observability is built on two pillars: structured agent logs and workflow state snapshots.

Every significant event -- workflow started, step dispatched, step completed, step failed, approval requested, approval granted -- is recorded in the agent logs table with a structured JSON payload. These logs are immutable and timestamped, forming an audit trail that can answer any question about what happened during execution.

The workflow state itself is a JSON document stored alongside the workflow record and updated after every state transition. It contains the status of every step, the current step index, timing information, and error details. The UI polls this state to render real-time progress views -- you can watch a workflow execute step by step, seeing each agent spin up, work, and complete.

When a workflow uses multiple runtimes, the observability layer tracks which provider executed each step. This is invaluable for cost analysis: you can see that steps routed to Ollama (local) cost nothing while the synthesis step routed to Claude consumed the bulk of the token budget. The smart runtime router's decisions become visible, auditable, and adjustable.

## Lessons Learned

**Context Batching Matters.** Early versions of the engine passed context between steps as raw strings, concatenating previous outputs with new prompts. This worked for two-step workflows. By step five, the context window was dominated by intermediate outputs that were no longer relevant. The fix was context batching -- summarizing previous outputs at key checkpoints rather than accumulating everything. The agent sees a concise summary of where the workflow has been, not a transcript of everything that happened.

**Blueprints Beat Blank Canvases.** The blueprint gallery transformed workflow adoption. Before blueprints, users stared at the workflow creation form the way most people stare at a blank document -- paralyzed by choice. After introducing the business-function blueprints (sprint planning, content pipeline, financial reporting), workflow creation jumped because users had a starting point. They customized extensively -- swapping profiles, adding steps, changing runtimes -- but they almost never started from scratch. The lesson: templates are not a convenience feature. They are an adoption mechanism.

**Handoffs Need Governance From Day One.** Our first implementation of agent handoffs had no chain depth limit. Within hours of testing, a researcher agent handed work to a code-reviewer, which handed a documentation request to a document-writer, which generated a research question and handed back to the researcher. The loop burned through tokens before anyone noticed. Chain depth limits and self-handoff blocking were not optimization -- they were safety-critical. Any system where agents can initiate work for other agents needs hard limits on delegation chains.

**Observability Is the Feature.** We initially thought of the workflow progress view as a nice-to-have -- a dashboard for people who like watching progress bars. We were wrong. Observability is what makes the entire system trustworthy. When a user can see exactly which step is running, what the agent is doing, how long it has been working, and what the intermediate results look like, they trust the system enough to run workflows without hovering. The observability layer is not a debugging tool. It is the feature that makes Progressive Autonomy possible, because you cannot grant autonomy to a system you cannot see.

The workflow engine is where Stagent stops being a task runner and starts being a work orchestrator. Individual tasks prove that agents can do work. Workflows prove that agents can do *coordinated* work -- and that humans can design the coordination rather than performing the work themselves. In the next chapter, we will look at what happens when you add scheduling to this mix, turning one-shot workflows into recurring, self-maintaining processes.

[Try: Create a Workflow](/workflows)
