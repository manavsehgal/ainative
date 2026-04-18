---
title: "The Swarm"
subtitle: "Multi-Agent Coordination"
chapter: 8
part: 3
readingTime: 16
relatedDocs: [profiles, agent-intelligence]
lastGeneratedBy: "2026-04-18T17:10:00.000Z"
---

# The Swarm — Multi-Agent Coordination

## The Coordination Problem

A single agent that can write code is impressive. Twenty agents writing code in parallel is chaos unless you solve coordination. This is not a new problem -- it is the oldest problem in software engineering, dressed in new clothes. Fred Brooks told us in 1975 that adding people to a late project makes it later. The communication overhead grows quadratically with team size. Agents are no different. They are faster than humans and never need coffee breaks, but they are subject to the same fundamental coordination constraints.

The numbers tell the story of where the industry is heading: 72% of enterprise AI projects now use multi-agent architectures, up from 23% in 2024. Anthropic's Claude Agent SDK delivers 90%+ performance gains on complex tasks, but at 15x the token cost of single-turn interactions. The performance gains justify the cost -- if you can keep the agents from stepping on each other's work.

> [!case-study]
> **Harvey and the Coordination Bottleneck**
> Gabe Pereyra, CEO of Harvey (the legal AI company), articulated this shift in April 2026: "As throughput ceases to be a meaningful constraint, the central questions stop being what should people do, but how do we organize around intelligence and govern results." Harvey discovered that as their agents became more capable, the bottleneck shifted from implementation to coordination. "Engineers are now so productive they're harder to coordinate." This is the paradox of agent productivity: the faster each individual agent works, the more critical the orchestration layer becomes.

The naive approach is to give each agent a task and let them run independently. This works until two agents modify the same file, or one agent's output depends on another's that is not finished yet, or three agents each decide to add the same utility function because they do not know the others exist. The result is merge conflicts, wasted compute, and a codebase that looks like it was written by twenty strangers who never spoke to each other -- because it was.

What we need is not just parallelism but **coordinated** parallelism. Agents that know about each other, that can divide work intelligently, that can resolve conflicts without human intervention for routine cases while escalating genuinely ambiguous situations. We need, in short, a swarm.

## Gas Town's Architecture

The most detailed multi-agent system we have studied in the wild is Gas Town, Steve Yegge's creation at Sourcegraph. Built over 17 days in January 2026, Gas Town comprises 75,000 lines of Go across 2,000 commits. It is not a toy. It is a production system that runs 20-30 agents in parallel, and its architecture reveals hard-won lessons about what actually works at scale.

> [!case-study]
> **Gas Town's Agent Roles**
> Gas Town models its agents as specialized roles within a town metaphor. The **Mayor** is the coordinator -- it decomposes high-level objectives into work items and assigns them to specialists. The **Polecats** are the workers -- each Polecat is a coding agent with a specific specialty (frontend, backend, testing, infrastructure). The **Refinery** processes raw outputs into polished artifacts -- think of it as the CI/CD pipeline personified. The **Witness** observes execution and maintains the audit trail. The **Deacon** manages the persistent state and handles recovery when agents crash. Each role maps to an organizational function: leadership, execution, quality assurance, observability, and infrastructure. The metaphor is whimsical, but the architecture beneath it is rigorous.

The key insight from Gas Town is that multi-agent systems need the same roles that human organizations need. You cannot run a company with only engineers. You need someone to set priorities (Mayor), people to execute (Polecats), a quality process (Refinery), monitoring (Witness), and infrastructure (Deacon). The agents differ in their tools, their permissions, their context, and their decision-making authority -- exactly like humans in an organization.

Gas Town achieves durability through what Yegge calls **nondeterministic idempotence**. Each agent's state is backed by git, stored as a "Bead" -- a persistent identity with a mail inbox, a Hook (specification), and a role pointer. If an agent crashes, it can be restarted from its last known state. If two agents produce conflicting changes, the system uses git's merge machinery to resolve what it can and escalates what it cannot. "The agent's persistent state survives crashes, restarts, and even migration between machines."

This is fundamentally different from stateless agent architectures where a crash means starting over. In Gas Town, agents accumulate context across their lifetime, and that context is as durable as a git repository. The parallel to Kubernetes is explicit in their documentation: "K8s asks 'Is it running?' while Gas Town asks 'Is it done?'" Kubernetes manages process lifecycle. Gas Town manages task lifecycle. Both are reconciliation loops, but they operate at different levels of abstraction.

## Profile-Based Specialization

Gas Town's role system maps directly to a concept we have been building in `ainative-business`: **agent profiles**. A profile is not just a system prompt -- it is a complete specification of an agent's capabilities, permissions, tools, and behavioral patterns. `ainative-business` currently ships with four profiles, each designed for a distinct type of work:

- **General**: The default profile. Broad capabilities, moderate tool access, suitable for open-ended tasks that do not fit a specific specialty.
- **Code Reviewer**: Security-focused analysis. Access to file reading and search tools but restricted write permissions. Applies OWASP checks and produces structured findings.
- **Researcher**: Web-enabled information gathering with citation tracking. Optimized for tasks that require synthesis across multiple sources.
- **Document Writer**: Structured output generation. Templates, formatting rules, and document-specific tool access.

Each profile defines three critical boundaries. **Tools** specify what the agent can do -- a code reviewer can read files and run tests but should not modify production code. **Permissions** specify what the agent is allowed to do without asking -- the general profile might auto-approve file reads but require human approval for writes. **Domain knowledge** specifies what the agent knows -- injected via learned context scoped to the profile (Chapter 7).

```typescript
// Profile definition structure
interface AgentProfile {
  id: string;                    // "code-reviewer"
  name: string;                  // "Code Reviewer"
  systemPrompt: string;          // Role-specific instructions
  tools: string[];               // ["Read", "Grep", "Glob", "Bash"]
  defaultPermissions: {
    autoApprove: string[];       // Tools that don't need human approval
    requireApproval: string[];   // Tools that always need approval
    deny: string[];              // Tools this profile can never use
  };
  maxTurns: number;              // Execution budget
  costCapUsd: number;            // Spending limit per task
}
```

The profile system creates natural boundaries that prevent the chaos of unconstrained multi-agent execution. A code reviewer cannot accidentally deploy. A researcher cannot modify source code. A document writer cannot run arbitrary shell commands. These boundaries are not just safety measures -- they improve agent performance by narrowing the decision space. An agent that knows it is a code reviewer and can only use read-oriented tools will focus its reasoning on analysis rather than wasting tokens considering whether to modify the code it is reviewing.

## Chain Depth Governance

One of the most dangerous failure modes in multi-agent systems is runaway agent chains. Agent A delegates to Agent B, which delegates to Agent C, which delegates to Agent D, and suddenly you have a four-deep chain of agents, each spending tokens, each potentially making decisions that compound errors from the level above. Without governance, a single poorly-scoped task can cascade into thousands of dollars of compute and a tangled mess of conflicting changes.

Gas Town addresses this with explicit chain depth limits. `ainative-business` implements the same principle through a `maxChainDepth` parameter in workflow definitions. When a coordinator agent spawns worker agents, each worker tracks its depth in the chain. A worker at depth 3 in a system with `maxChainDepth: 3` cannot spawn sub-agents. It must complete its work directly or report back to its coordinator that the task needs to be decomposed differently.

This constraint is more than a cost control measure. It is a forcing function for task decomposition quality. If a task requires depth-4 agent chains to complete, it is almost certainly too vaguely specified. Good task decomposition produces work items that a single agent can complete in one pass. The chain depth limit makes poor decomposition fail fast rather than fail expensively.

## The Kubernetes Parallel

The comparison between multi-agent orchestration and container orchestration is more than an analogy. Both systems face the same fundamental challenges: scheduling work across heterogeneous resources, handling failures gracefully, scaling up and down based on demand, and maintaining desired state in the face of nondeterminism.

Kubernetes reconciliation loops continuously compare desired state ("three replicas of this service should be running") with actual state ("only two are running") and take corrective action. A swarm coordinator does the same: compare desired state ("these five subtasks should be completed") with actual state ("three are done, one failed, one is running") and take corrective action ("retry the failed one with additional context, wait for the running one").

The difference, as Gas Town's documentation notes, is the level of abstraction. Kubernetes asks "Is it running?" -- a binary question about process lifecycle. A swarm coordinator asks "Is it done?" -- a nuanced question about task completion that requires understanding the task's success criteria, evaluating the quality of the output, and deciding whether to accept, retry, or escalate.

> [!case-study]
> **Stripe's Minion Governance**
> Stripe's Minions system (2025-2026) demonstrates production-grade governance for multi-agent work. Their rules are deliberately conservative: maximum 2 CI retry cycles before escalating to a human, mandatory human review before any merge, and a strict rule that "Minions use the same developer tooling that equally enables Stripe's human engineers." The last point is crucial -- Minions do not get special APIs or shortcuts. They work through the same PRs, the same CI pipelines, the same code review process as human engineers. This means every governance mechanism Stripe built for humans automatically applies to agents. The result: all 1,300+ agent-generated PRs are human-reviewed, with zero human-written code making it through without agent assistance.

## Sweeps: Garbage Collection for Technical Debt

Multi-agent systems produce technical debt faster than single-agent systems. When twenty agents contribute code in parallel, inconsistencies accumulate: slightly different error handling patterns, redundant utility functions, inconsistent naming conventions. Gas Town's answer to this is the **Sweep** -- a systematic correction wave that runs periodically to identify and fix architectural drift.

A Sweep is not a one-time cleanup. It is a recurring process, analogous to garbage collection in a runtime. The system identifies categories of drift (inconsistent error handling, unused imports, style violations), spawns specialized agents to fix each category, and runs the results through the same review pipeline as regular work. "Sweeps: systematic correction waves that curb architectural drift."

This concept maps directly to how mature engineering organizations operate. Google has dedicated teams for large-scale changes (LSCs) that sweep across the monorepo to update deprecated APIs, fix security vulnerabilities, and enforce new standards. The difference is that LSCs require human engineers and take weeks. Agent sweeps take hours.

`ainative-business`'s roadmap includes a sweep system built on the workflow engine. A sweep is a workflow that queries the codebase for a specific pattern of drift, generates fix tasks, and executes them through the standard agent pipeline with human review gates. The feedback from sweeps feeds back into the knowledge graph (Chapter 7) -- if the same drift pattern appears repeatedly, it suggests that the root cause is not individual agents but a missing or unclear specification.

## ainative Today

`ainative-business`'s current multi-agent capability operates through the **swarm workflow pattern** -- a coordinator agent that decomposes work and delegates to specialized worker agents. The task classifier routes incoming work to the appropriate agent profile based on the task description, and handoffs between agents preserve context through the workflow engine.

```typescript
// Building with ainative: Multi-agent swarm workflow
const workflow = await fetch("/api/workflows", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Full-Stack Feature Swarm",
    projectId: "proj-8f3a-4b2c",
    definition: {
      pattern: "swarm",
      coordinator: { agentProfile: "general", maxTurns: 5 },
      workers: [
        {
          id: "backend",
          agentProfile: "code-reviewer",
          task: "Implement API endpoints for user preferences",
        },
        {
          id: "frontend",
          agentProfile: "code-reviewer",
          task: "Build React components for the preferences UI",
        },
        {
          id: "tests",
          agentProfile: "code-reviewer",
          task: "Write integration tests for the preferences feature",
        },
      ],
      governance: {
        maxChainDepth: 3,
        budgetCapUsd: 5.0,
        requireHumanReview: true,
      },
    },
  }),
}).then((r) => r.json());

// The coordinator decomposes the high-level objective,
// assigns subtasks to workers based on their profiles,
// monitors progress, and assembles the final result.
// Each worker operates within its profile's tool and permission boundaries.
```

The task classifier analyzes incoming task descriptions and routes them to the most appropriate agent profile. A task mentioning "review the security of" gets routed to the code-reviewer profile. A task asking to "research alternatives for" goes to the researcher. This routing is not keyword matching -- it uses an LLM classification step that considers the full task description, the project context, and the available profiles.

Handoffs between agents in a workflow preserve the execution context. When a coordinator delegates to a worker, it passes not just the task description but the relevant portion of the coordinator's reasoning -- why this subtask was carved out, what constraints apply, and what the expected output format is. When the worker completes, its results and any learned context flow back to the coordinator for synthesis.

A newer form of multi-agent coordination operates within a single conversation rather than across workflow steps: **skill composition**. Multiple skills can now be active simultaneously -- up to three on Claude and Codex runtimes, one on Ollama -- governed by the `RuntimeFeatures.supportsSkillComposition` and `maxActiveSkills` flags in the runtime catalog. When skills are composed, a conflict detection heuristic scans for polarity-divergent directives (for example, one skill encouraging verbose output while another demands brevity). If the prompt budget is exceeded, the system evicts the oldest skill. This is coordination at the instruction level rather than the task level -- agents that carry multiple behavioral directives and resolve tensions between them within a single conversation turn.

## Roadmap Vision

The current swarm system is functional but stateless -- agents are spawned for a task and terminated when it completes. The roadmap vision introduces **persistent agent identities** inspired by Gas Town's Bead model.

**Persistent identities with mailboxes** give each agent a durable presence. Instead of spawning a fresh code-reviewer for every review task, the system maintains a persistent code-reviewer identity that accumulates context across tasks. The mailbox pattern allows asynchronous communication between agents -- a frontend agent can leave a message for the backend agent about an API contract change, and the backend agent will see it when it starts its next task.

**Nondeterministic idempotence** addresses the fundamental challenge of parallel agent work. When two agents modify overlapping parts of a codebase, the results are nondeterministic -- you cannot predict the exact merge outcome. But you can make the system idempotent by ensuring that the desired end state is achieved regardless of execution order. Gas Town demonstrates this through git-backed state: if a merge conflict occurs, the system can retry the conflicting agent's work on top of the other agent's committed changes.

**Automated merge conflict resolution** takes this further. Simple conflicts (two agents adding imports to the same file, or appending to the same array) can be resolved automatically. Complex conflicts (two agents modifying the same function body with different approaches) require escalation to the coordinator or to a human. The system learns over time which types of conflicts it can safely auto-resolve, feeding this knowledge back into the institutional memory system.

The ultimate vision is an agent organization that mirrors the best human organizations: specialized roles, clear communication channels, shared institutional memory, governance that enables rather than restricts, and the ability to scale up or down based on the work at hand. We are not there yet. But the architecture of Gas Town, the governance of Stripe's Minions, and the profile system in `ainative-business` are all converging on the same destination -- not a single brilliant agent, but a well-coordinated swarm of specialists that is greater than the sum of its parts.
