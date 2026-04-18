---
title: "Blueprints"
subtitle: "Workflow Orchestration"
chapter: 5
part: 2
readingTime: 14
lastGeneratedBy: "2026-04-18T17:10:00.000Z"
relatedDocs: ["workflows", "agent-intelligence"]
relatedJourney: "power-user"
---

## Beyond Single Tasks

A task is an atom. Useful on its own, but limited. Real work is molecular — tasks combine, depend on each other, branch conditionally, loop iteratively, and converge into deliverables that no single task could produce alone.

Consider shipping a feature. It is never just "write the code." It is: understand the requirements, plan the implementation, write the code, write the tests, run the tests, fix the failures, review the changes, update the documentation, open a pull request, respond to reviewer feedback, merge. Each step depends on the one before it. Some steps can run in parallel. Some steps might loop (write tests, run tests, fix failures, run tests again). Some steps need different expertise — a researcher for requirements analysis, a code-reviewer for the implementation, a document-writer for the docs.

This is workflow orchestration, and it is where AI-native development stops feeling like a clever trick and starts feeling like a machine that builds machines. The forge handles individual tasks. Blueprints connect tasks into systems of work that produce compound outcomes greater than the sum of their parts.

> [!case-study]
> **8090's Foundry and Planner**
> The Citadel in *Furiosa* has a Foundry — but the Foundry does not decide what to build. The Planner decides. The Planner analyzes what is needed, designs the sequence of operations, and the Foundry executes. In 8090's wasteland economy, the separation is critical: planning and execution are different competencies requiring different resources. Agents that can write code are not necessarily agents that can plan a multi-step delivery pipeline. `ainative-business`'s workflow engine reflects this split. A planner step — using a `general` or `project-manager` profile — produces the execution plan. Subsequent steps — using `code-reviewer` or `document-writer` profiles — execute against that plan. The planner reasons broadly; the executors work precisely.

## The Six Patterns

Not all workflows are the same. Over months of building and using `ainative-business`, we have identified six distinct orchestration patterns that cover the vast majority of real-world scenarios. Each pattern makes different trade-offs between simplicity, parallelism, and human control.

**1. Sequence**: The simplest pattern. Steps execute one after another, each receiving the output of the previous step. Plan, then implement, then test, then review. No parallelism, no branching, maximum predictability. This is the default for teams just starting with workflow automation.

**2. Planner-Executor**: A planning step produces a structured work breakdown. Execution steps run against the plan. The planner uses a general-purpose profile with broad context; the executors use specialized profiles with narrow tool permissions. This is the pattern we use most in `ainative-business`'s own development — an agent decomposes a feature spec into tasks, then other agents execute each task.

**3. Checkpoint**: A sequence with human approval gates. The workflow pauses at designated steps, surfaces results for review, and waits for explicit approval before continuing. Essential for high-stakes work where autonomous execution carries unacceptable risk — deploying to production, modifying financial data, publishing external content.

**4. Loop**: A step or sequence repeats until a condition is met. Write tests, run tests, fix failures, repeat until all tests pass. The loop pattern is how agents handle iterative refinement — work that cannot be done right on the first try and requires multiple passes.

**5. Parallel**: Independent steps execute simultaneously. If tests and documentation can be written concurrently (they usually can), run both at once. Parallel patterns cut wall-clock time but increase resource consumption.

**6. Swarm**: Multiple agents work on the same problem from different angles, then results are merged or voted on. This is the most advanced pattern and the least commonly needed, but it shines for problems where diversity of approach matters more than efficiency — architecture decisions, creative work, security audits where multiple perspectives catch more issues than a single exhaustive pass.

These patterns compose. A planner-executor workflow might have parallel execution steps. A loop might contain a checkpoint. The workflow engine treats patterns as building blocks, not rigid templates.

## Deterministic + Agentic Nodes

One of the most important insights from production workflow systems is that not every step should be agentic. Some steps are deterministic: run the test suite, check if a file exists, parse a JSON response, compute a diff. These operations do not benefit from language model reasoning. They benefit from speed, reliability, and zero cost.

> [!case-study]
> **Stripe's Blueprints and the Toolshed**
> Stripe's internal workflow system — described by ByteByteGo's architecture analysis — uses what they call "blueprints" that mix deterministic and agentic nodes. A blueprint might have an agentic step (understand the codebase and plan changes), followed by a deterministic step (run the linter), followed by another agentic step (fix linter errors), followed by a deterministic step (run CI). The agentic steps do the reasoning; the deterministic steps do the verification. Stripe backs this with what they call the "Toolshed" — an MCP server exposing approximately 500 internal tools. The agent does not shell out to random commands. It calls structured tools with typed inputs and typed outputs. The Toolshed is the interface between agentic reasoning and deterministic infrastructure. Our workflow engine follows the same principle: steps declare whether they are agentic (executed by a profiled agent) or deterministic (executed by a script or API call).

This hybrid approach is critical for reliability. Agentic steps are powerful but probabilistic — they might produce slightly different results on each run. Deterministic steps are limited but exact — they produce the same result every time. A well-designed workflow alternates between them: the agent reasons and creates, the deterministic step validates and verifies. This creates a ratchet effect: the workflow can only move forward through validated checkpoints.

```typescript
// Building with ainative: Planner-executor workflow
const workflow = await fetch("/api/workflows", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Feature Delivery Pipeline",
    projectId: "proj-8f3a-4b2c",
    definition: {
      pattern: "planner-executor",
      steps: [
        { id: "plan", title: "Plan implementation", agentProfile: "general" },
        { id: "implement", title: "Write code", agentProfile: "code-reviewer", dependsOn: ["plan"] },
        { id: "test", title: "Write and run tests", agentProfile: "code-reviewer", dependsOn: ["implement"] },
        { id: "review", title: "Review changes", agentProfile: "code-reviewer", dependsOn: ["test"] },
      ],
    },
  }),
}).then((r) => r.json());

await fetch(`/api/workflows/${workflow.id}/execute`, { method: "POST" });
```

The `dependsOn` array is the backbone of workflow orchestration. It declares what must complete before a step can begin. The workflow engine in `src/lib/workflows/engine.ts` performs a topological sort on these dependencies, identifies the execution order, detects cycles (and rejects them), and dispatches steps as their prerequisites complete. Steps without mutual dependencies can run in parallel if the engine determines that resources are available.

## The Ralph Wiggum Loop

Sometimes the most powerful pattern is the simplest one.

> [!case-study]
> **Geoffrey Huntley's Ralph Wiggum Technique: $50K for $297**
> Geoffrey Huntley, an Australian developer, created what he calls the Ralph Wiggum technique — a loop so simple it barely qualifies as engineering: `while :; do cat PROMPT.md | claude-code ; done`. A bash while loop that feeds a prompt to Claude Code, over and over, until the work is done. Huntley used it to complete a $50,000 freelance contract for just $297 in API costs. The story went viral, and Anthropic subsequently built an official Ralph Wiggum plugin for Claude Code with stop hooks, iteration limits, and structured completion conditions — transforming a bash hack into institutional tooling. The lesson is not "use simple loops for everything." The lesson is: do not over-engineer your orchestration. Start with the simplest pattern that could possibly work.

The Ralph Wiggum loop works because it exploits a key property of modern language models: they can pick up where they left off. Each iteration, the agent reads the current state of the codebase (which it modified in the previous iteration), consults the prompt (which describes the desired end state), identifies the gap, and does work to close it. The loop terminates when the agent determines there is nothing left to do — or when the human watching the API bill decides it is done.

This is the minimum viable workflow: no DAG, no dependency resolution, no step definitions. Just repetition with feedback. And it is a legitimate pattern that belongs in every workflow designer's toolkit alongside the more sophisticated options.

## Gas Town's Pipeline

Between simple loops and complex DAGs lies a middle ground: the linear pipeline with role specialization.

> [!case-study]
> **Gas Town: Mayor, Polecats, Refinery**
> Gas Town in the *Furiosa* universe runs a three-stage pipeline. The Mayor sets priorities and allocates resources. The Polecats — the town's warrior-mechanics — execute the dangerous work. The Refinery processes the results into usable fuel. Each stage has different actors with different skills and different risk profiles. The Mayor does not climb tanks. The Polecats do not set policy. The Refinery does not fight. This specialization-by-stage maps directly to workflow orchestration. A planning stage uses a profile with broad read access and no write permissions. An execution stage uses a profile with write access to specific directories. A review stage uses a profile that can read changes but not modify them. Each stage is scoped to its competency, and trust boundaries are enforced at the profile level, not through human vigilance.

The pipeline pattern — sequential stages with specialized roles — is the most common workflow structure we see in production use. It is simple enough to understand at a glance, structured enough to enforce quality gates, and flexible enough to accommodate most delivery processes. When we ask `ainative-business` users how they structure their workflows, the majority describe some variant of: plan it, build it, test it, review it. Four stages, four profiles, one pipeline.

## The Orchestration Ecosystem

`ainative-business`'s workflow engine does not exist in isolation. The broader ecosystem of workflow orchestration is maturing rapidly, and the patterns converging across the industry validate the approach.

Temporal.io, the durable execution platform, reached a $5 billion valuation — proving enterprise demand for reliable workflow orchestration. LangGraph, the agent orchestration framework, accumulated over 126,000 GitHub stars, demonstrating developer appetite for multi-step agent pipelines. Google's Agent-to-Agent (A2A) protocol attracted over 150 organizations, establishing that agent workflows need standardized communication interfaces.

These are not competing approaches. They are layers of a stack that is still assembling itself. Temporal provides durable execution guarantees (workflows survive crashes and restarts). LangGraph provides agent-specific orchestration primitives (memory, branching, human-in-the-loop). A2A provides cross-agent communication standards (agents from different vendors in the same workflow). `ainative-business` sits at the application layer, providing the user interface and project context that makes these capabilities accessible to teams that are not distributed systems engineers.

The convergence is real: every serious agent deployment eventually needs multi-step orchestration, role-based routing, and human approval gates. The question is not whether you need blueprints, but when.

## ainative Today

The workflow engine is live and handling real workloads. Here is the current state:

**YAML Blueprint Definitions**: Workflows are defined as structured YAML (or JSON via the API) with named steps, dependency declarations, and profile assignments. The workflow types in `src/lib/workflows/types.ts` provide full TypeScript typing for workflow definitions, making it possible to validate blueprints at creation time rather than discovering errors during execution.

**Step Dependencies**: The `dependsOn` array on each step declares prerequisite relationships. The engine resolves these into an execution order, validates that no cycles exist, and dispatches steps when their dependencies complete. Steps without mutual dependencies are eligible for parallel execution.

**Workflow Engine**: The engine in `src/lib/workflows/engine.ts` manages the lifecycle of a workflow execution — creating step instances, tracking status transitions, handling step completion callbacks, and propagating failures. Each step generates a unique ID to avoid key conflicts in the UI.

**Workflow UI**: The `/workflows` route provides a management interface for creating, viewing, and monitoring workflows. The workflow detail view shows step status with dependency visualization. Three dedicated components in `src/components/workflows/` handle the list, detail, and creation experiences.

**Profile Integration**: Each workflow step specifies an `agentProfile` that governs the agent's behavior during that step. Different steps in the same workflow can use different profiles — a `general` profile for planning, a `code-reviewer` for implementation, a `document-writer` for documentation.

**Conversation Templates from Blueprints**: Blueprints now serve as conversation starters, not just workflow definitions. An optional `chatPrompt` field on any blueprint provides a template that initializes a new conversation with pre-filled context and instructions. Three entry points surface this capability: an empty-state button when no conversation is active, a `/new-from-template` slash command, and the `⌘K` command palette. The `renderBlueprintPrompt()` function resolves template variables — project name, date, profile — before injecting the prompt. This extends the blueprint concept from "how work is orchestrated" to "how work begins," making it easier for users to start complex workflows from a single conversational entry point.

## Roadmap Vision

Workflows today are powerful but manual. The roadmap extends them toward reuse, marketplace dynamics, and cross-system orchestration:

**Workflow Marketplace**: A library of community-contributed blueprint templates — "Feature Delivery Pipeline," "Security Audit Workflow," "Documentation Sprint," "Bug Triage and Fix." Users install a template, customize it for their project, and run. This transforms workflows from something each team builds from scratch into shared infrastructure.

**A2A Protocol Integration**: Google's Agent-to-Agent protocol enables workflows where steps execute across different agent providers. A planning step might use Claude for its reasoning depth. An implementation step might use Codex for its sandbox environment. A review step might use a specialized security analysis model. A2A provides the communication standard; `ainative-business` provides the orchestration.

**Durable Execution**: Today, if the server restarts mid-workflow, in-progress steps may need to restart. Durable execution — persisting workflow state to the database at every transition — would allow workflows to resume exactly where they left off after any interruption. This is essential for workflows that run for hours or days.

**Conditional Branching**: Steps that route differently based on the output of previous steps. If the test step finds no failures, skip the fix step and go straight to review. If the review step finds critical issues, loop back to implementation. Today, the dependency graph is static. Conditional branching makes it dynamic.

**Workflow Versioning**: As workflows evolve, teams need to track changes, compare versions, and roll back to known-good configurations. Workflow versioning would store the complete definition history and let users pin executions to specific versions while iterating on the template.

The blueprint is the machine that builds machines. Not the individual agent — that is just a hammer. The blueprint is the assembly line: the sequence of operations, the quality checks, the handoffs between specialists, the feedback loops that turn raw capability into reliable output. The forge does the work. The blueprint makes the work systematic.
