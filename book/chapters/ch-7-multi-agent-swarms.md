---
title: "Multi-Agent Swarms"
subtitle: "Async Handoffs, Governance Gates, and the Agent Workforce"
chapter: 7
part: 3
readingTime: 15
relatedDocs: [profiles, agent-intelligence]
lastGeneratedBy: "2026-03-31T21:00:00Z"
---

## The Problem

One agent is useful. Multiple agents working in concert are transformative. But multi-agent systems introduce coordination challenges that compound fast: how do agents share context? How do they delegate work without infinite loops? How do you prevent a cascade of handoffs from burning through your entire token budget before a human can intervene? This chapter explores multi-agent orchestration in Stagent -- from the static swarm topology we shipped in earlier sprints to the new async handoff system that lets agents delegate work to specialists through a governed message bus.

If the previous chapters of this book have followed a trajectory from simple to complex, this chapter marks the point where the complexity changes in kind, not just in degree. A single agent executing a single task is a function call with personality. A workflow orchestrating sequential steps is a pipeline with decision points. But multiple agents working simultaneously on related problems, sharing partial results, and now *handing off work to each other asynchronously* -- that is a distributed system with emergent behavior. And distributed systems with emergent behavior have a well-earned reputation for humbling the engineers who build them.

We want to be honest about what is production-ready and what is frontier. The swarm workflow pattern (Mayor/Workers/Refinery) has been running for months. The async handoff system -- where agents dynamically delegate to each other through a message bus with governance gates -- is newer. And the twenty-profile workforce concept, where business-function agents sit alongside technical agents in a unified catalog, represents the current state of the art in Stagent's multi-agent story. Each layer builds on the last.

> [!info]
> **Progressive Autonomy**
> This chapter follows the same progressive autonomy principle that runs through the entire book. You start with a single agent. You graduate to fan-out when one agent cannot cover enough ground. You add pipelines when sequential specialization matters. You reach for swarms when the problem genuinely requires parallel exploration with synthesis. And you reach for async handoffs when agents themselves need to decide who should handle what. Each level adds power and complexity in equal measure. Skip levels at your peril.

## The Agent Workforce: 20 Profiles and Counting

Before we talk about coordination, we need to talk about who is being coordinated. Stagent now ships with twenty built-in agent profiles spanning two categories: technical roles and business functions.

The **technical profiles** cover the engineering domain: General, Code Reviewer, Data Analyst, DevOps Engineer, Document Writer, Researcher, Project Manager, Technical Writer, and the specialized Sweep agent for proactive codebase auditing. These have been in the system since early sprints.

The **business-function profiles** are newer -- six roles designed for operational work outside of engineering:

- **Marketing Strategist** -- market research, campaign planning, and growth strategy
- **Sales Researcher** -- lead research, qualification, and personalized outreach planning
- **Customer Support Agent** -- ticket triage, empathetic response drafting, and escalation management
- **Financial Analyst** -- financial statement analysis, forecasting, and investor-ready reporting
- **Content Creator** -- blog posts, social media, newsletters, and conversion-focused copy
- **Operations Coordinator** -- SOP documentation, process optimization, and cross-functional coordination

Plus **personal profiles** for individual productivity: Health & Fitness Coach, Learning Coach, Shopping Assistant, Travel Planner, and Wealth Manager.

Each profile is defined as a YAML configuration paired with a SKILL.md file containing behavioral instructions. The profile registry scans `~/.claude/skills/` at startup, validates each profile, and makes the full catalog available through a unified API.

<!-- filename: src/lib/agents/profiles/types.ts -->
```typescript
export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  domain: string;
  tags: string[];
  skillMd: string;
  allowedTools?: string[];
  mcpServers?: Record<string, unknown>;
  canUseToolPolicy?: CanUseToolPolicy;
  maxTurns?: number;
  outputFormat?: string;
  supportedRuntimes: AgentRuntimeId[];
  runtimeOverrides?: Partial<Record<AgentRuntimeId, ProfileRuntimeOverride>>;
}
```

Every profile declares which runtimes it supports -- all five of them: Claude Code, OpenAI Codex, Anthropic Direct, OpenAI Direct, and the new Ollama provider for local models. A Marketing Strategist runs the same behavioral instructions whether it is backed by Claude Sonnet or a local Llama model through Ollama. The profile abstraction is provider-agnostic by design.

This matters for multi-agent coordination because specialization is the whole point. A swarm where every worker uses the same profile is just parallel duplication. A swarm where the Mayor uses a General profile, workers use Code Reviewer, Researcher, and Financial Analyst profiles, and the Refinery uses a Document Writer profile -- that is a team with genuine division of labor.

[Try: Agent Profiles](/profiles)

## Coordination Patterns

Through building Stagent and studying the landscape, we have converged on four coordination patterns that cover the multi-agent use cases we have actually encountered. Each pattern has a different topology, different failure modes, and different sweet spots.

### Fan-Out/Fan-In (Parallel Research)

The simplest multi-agent pattern. A coordinator breaks a problem into independent slices, dispatches each slice to a separate agent, and merges the results when all agents complete. This is Stagent's `parallel` workflow pattern, and it has been in production the longest.

Fan-out excels at research tasks. "Analyze this competitor from the product angle, the engineering angle, and the market angle" is a natural fan-out. Each agent explores a different dimension of the same subject, and the synthesis step merges perspectives into a unified report.

### Pipeline (Sequential Specialization)

Agents arranged in a chain, where each agent's output becomes the next agent's input. Consider a content production workflow: a Researcher gathers source material, a Content Creator drafts the content, a Code Reviewer validates technical claims, and a Document Writer polishes the final output. Each agent is specialized for its role, and the sequential handoff ensures each builds on the previous agent's work.

### Swarm (Governed Parallel Execution)

The swarm combines elements of fan-out and pipeline into a three-phase structure: **Mayor**, **Workers**, **Refinery**. The Mayor analyzes the task and decomposes it into assignments. Workers execute in parallel. The Refinery synthesizes a final result.

<!-- filename: src/lib/workflows/swarm.ts -->
```typescript
export function buildSwarmWorkerPrompt(input: {
  mayorName: string;
  mayorResult: string;
  workerName: string;
  workerPrompt: string;
}): string {
  return [
    "You are one worker in a governed multi-agent swarm.",
    "",
    `${input.mayorName}:`,
    input.mayorResult.trim(),
    "",
    `${input.workerName} assignment:`,
    input.workerPrompt.trim(),
    "",
    "Complete only your assigned slice. Return concrete findings the refinery can merge.",
  ].join("\n");
}
```

The "governed" in "governed multi-agent swarm" is intentional. Unlike open-ended multi-agent conversations where agents decide autonomously what to do next, the swarm has a fixed topology. The Mayor governs. Workers execute. The Refinery synthesizes. There is no dynamic handoff within a swarm, no agent-to-agent negotiation. This is a deliberate constraint that gives you predictable token usage, predictable latency, and predictable failure modes.

### Async Handoffs (Dynamic Delegation)

The newest coordination pattern, and the one that changes the game. Async handoffs let agents delegate work to other agents *dynamically* -- not through a pre-built workflow, but through a message bus that any agent can invoke during execution.

A Researcher discovers a code quality issue while investigating a bug report. Instead of noting it and moving on, the Researcher hands the finding off to the Code Reviewer profile, which spins up a new task to analyze the code in depth. The Code Reviewer finds a security concern and hands it off to the DevOps Engineer to check the deployment pipeline. Each handoff creates a new task, tracks the chain of delegation, and respects governance rules that prevent the system from running away.

This is fundamentally different from the swarm pattern. Swarms have a fixed topology defined at workflow creation time. Handoffs have an emergent topology that unfolds during execution. The trade-off is flexibility versus predictability -- and that is why governance gates are non-negotiable.

## The Async Handoff System

The handoff system has three components: the message bus, the governance layer, and the inbox integration.

### The Message Bus

Every handoff flows through a central bus that creates, validates, dispatches, and completes handoff requests. When an agent calls the `send_handoff` tool, it creates a `HandoffRequest` specifying the source and target profiles, a subject, a body, and an optional priority level.

<!-- filename: src/lib/agents/handoff/types.ts -->
```typescript
export interface HandoffRequest {
  fromProfileId: string;
  toProfileId: string;
  sourceTaskId: string;
  subject: string;
  body: string;
  priority?: number;
  requiresApproval?: boolean;
  parentMessageId?: string;
}

export const MAX_CHAIN_DEPTH = 5;
```

The bus writes the handoff to the `agent_messages` table with a computed chain depth, then either marks it as `accepted` (if no approval is required) or creates a notification for human review. Accepted handoffs are processed on the next scheduler tick: a child task is created with the target profile, linked to the source task's project for context, and fired for execution.

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
    if (parent) {
      chainDepth = parent.chainDepth + 1;
    }
  }

  // Validate governance rules
  const validation = validateHandoff(request, chainDepth);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const id = crypto.randomUUID();
  await db.insert(agentMessages).values({
    id,
    fromProfileId: request.fromProfileId,
    toProfileId: request.toProfileId,
    taskId: request.sourceTaskId,
    subject: request.subject.trim(),
    body: request.body.trim(),
    priority: request.priority ?? 2,
    status: request.requiresApproval ? "pending" : "accepted",
    requiresApproval: request.requiresApproval ?? false,
    parentMessageId: request.parentMessageId ?? null,
    chainDepth,
    createdAt: new Date(),
  });
  return id;
}
```

The processing loop runs inside the scheduler's tick cycle. This is a key architectural decision: handoffs are not processed immediately but on the next 60-second poll. This batching provides a natural circuit breaker -- even if an agent fires off multiple handoffs in rapid succession, they are processed one at a time with a gap between each batch.

### Governance Gates

Without governance, async handoffs would be a footgun. An agent could hand off to another agent, which hands off to another, which hands back to the first, creating an infinite loop that drains your token budget in minutes. The governance layer prevents this with three rules.

**No self-handoff.** An agent cannot hand off to the same profile. This prevents the simplest form of infinite recursion -- an agent deciding it needs to do more work and handing off to itself.

**Chain depth limit.** Every handoff chain is tracked through `parentMessageId` references. The current chain depth is computed from the parent, and if it exceeds `MAX_CHAIN_DEPTH` (5), the handoff is rejected. This caps the total delegation depth regardless of which profiles are involved.

**Profile validation.** Both the source and target profiles must exist in the registry. You cannot hand off to a profile that has been deleted or misspelled.

<!-- filename: src/lib/agents/handoff/governance.ts -->
```typescript
export function validateHandoff(
  request: HandoffRequest,
  currentChainDepth: number
): { valid: boolean; error?: string } {
  // No self-handoff
  if (request.fromProfileId === request.toProfileId) {
    return { valid: false, error: "Cannot hand off to the same profile (no self-handoff)" };
  }

  // Chain depth limit
  if (currentChainDepth >= MAX_CHAIN_DEPTH) {
    return {
      valid: false,
      error: `Chain depth limit reached (max ${MAX_CHAIN_DEPTH}). Cannot create further handoffs.`,
    };
  }

  // Validate both profile IDs exist
  const profiles = listAllProfiles();
  const profileIds = new Set(profiles.map((p) => p.id));

  if (!profileIds.has(request.fromProfileId)) {
    return { valid: false, error: `Source profile not found: ${request.fromProfileId}` };
  }
  if (!profileIds.has(request.toProfileId)) {
    return { valid: false, error: `Target profile not found: ${request.toProfileId}` };
  }

  return { valid: true };
}
```

These rules are simple, composable, and hard to circumvent. A chain depth of 5 means a maximum of 6 agents in a delegation chain (the original plus 5 handoffs). In practice, most useful handoff chains are 2-3 deep. The limit of 5 provides headroom for complex multi-agent scenarios while preventing runaway behavior.

> [!warning]
> **Token Economics of Handoff Chains**
> Each handoff creates a new task with its own agent invocation. A chain of 5 handoffs means 6 separate LLM calls, each with its own context window and token budget. The governance limit of 5 is not just a safety mechanism -- it is a cost control. Always monitor handoff chains through the agent logs, and consider requiring approval for handoffs in high-cost environments.

### Inbox Integration

When a handoff request has `requiresApproval: true`, the bus creates a notification in the inbox. The notification shows which agent is handing off to which, the subject and context being passed, and provides Approve/Deny controls. This is the same inbox that handles tool permission requests (Chapter 8), so there is no new UI to learn -- handoff approvals appear alongside permission requests in a unified governance queue.

For handoffs that arrive via a delivery channel (Slack or Telegram), the approval can happen right in the chat thread. The channel gateway recognizes "approve" and "deny" replies and resolves them back through the permission bridge. This means a Researcher agent can hand off to a Code Reviewer, and a team lead can approve the handoff from Slack without ever opening Stagent's web UI.

## The Smart Runtime Router

Multi-agent coordination becomes more interesting when agents can run on different providers. Stagent's runtime router selects the optimal provider for each task based on keyword signals, profile affinity, and user preferences.

<!-- filename: src/lib/agents/router.ts -->
```typescript
const COST_SCORE: Record<AgentRuntimeId, number> = {
  "anthropic-direct": 3,
  "openai-direct": 3,
  "claude-code": 1,
  "openai-codex-app-server": 1,
  ollama: 5,              // Free — always $0
};

const QUALITY_SCORE: Record<AgentRuntimeId, number> = {
  "claude-code": 3,
  "openai-codex-app-server": 2,
  "anthropic-direct": 2,
  "openai-direct": 2,
  ollama: 1,              // Local models, smaller parameter counts
};
```

In a handoff chain, each agent can run on a different provider. The Researcher might run on Anthropic Direct for fast, cost-effective research. The Code Reviewer might run on Claude Code for full filesystem access. A preliminary triage step might run on Ollama for zero-cost local execution. The router makes these decisions automatically based on the target profile's capabilities and the user's cost/quality/latency preference.

This is where the five-runtime architecture pays dividends in multi-agent scenarios. A swarm with five workers does not have to run all five on the same expensive provider. Low-stakes workers can run on Ollama. High-stakes workers can run on Claude. The cost of coordination drops without sacrificing quality where it matters.

## Real-World Challenges

### Message Passing and Context Windows

Every piece of information shared between agents consumes context window space. In a handoff chain, the body of each handoff request carries the context forward. If handoff bodies are verbose, downstream agents start with bloated context before their own instructions. We have found that keeping handoff bodies under 500 tokens produces the best results -- enough context for the receiving agent to understand the task, not so much that it crowds out the agent's own reasoning.

### State Consistency

In a fan-out pattern, workers execute in parallel against a shared context. But handoffs are asynchronous -- the receiving agent might not start for 60 seconds or more (one scheduler tick). If the underlying data changes in that window, the handoff context may be stale. The practical mitigation is to include timestamps in handoff bodies and to design handoff chains that are tolerant of slightly stale inputs.

### Observability

When a single agent fails, debugging is straightforward: read the execution log. When a handoff chain fails, you need to trace across multiple tasks. Stagent links handoff messages to both source and target tasks, creating a traceable chain in the agent logs. The `parentMessageId` field lets you reconstruct the full delegation tree from any point in the chain.

> [!tip]
> **Design Heuristic: The Meeting Test**
> Before creating a multi-agent swarm or enabling handoffs, ask yourself: "If these were people, would I schedule a meeting for this?" If the task can be done by one person working alone, use a single agent. If it needs a meeting with a clear agenda, assigned roles, and a designated note-taker -- that is a swarm. If it needs an ad-hoc Slack thread where one person says "hey, can you look at this?" and passes it along -- that is a handoff.

## Lessons Learned

**Start Simple, Add Agents Later.** A single well-prompted agent with good tools will outperform a poorly coordinated swarm on most tasks. Multi-agent patterns earn their complexity when the task requires genuinely different competencies, parallelism provides meaningful speedup, or consensus across multiple perspectives produces measurably better output. If none of these conditions hold, a single agent is the right answer.

**Governance Is Not Optional.** The chain depth limit of 5 and the self-handoff prevention might seem conservative. They are exactly right. Without them, a single misbehaving agent can spawn a cascade of handoffs that burns through hundreds of thousands of tokens before anyone notices. The governance gates are the difference between a controlled delegation and a runaway chain reaction.

**Specialization Is the Superpower.** The most impactful multi-agent pattern is not the most complex one -- it is the one where each agent is genuinely specialized for its role. A code review swarm where one worker focuses on security, another on performance, and a third on API design will catch issues that a single general-purpose reviewer misses. The business-function profiles extend this principle beyond engineering -- a Financial Analyst and a Sales Researcher working in concert can produce a competitive analysis that neither could match alone.

**Handoffs Bridge the Gap Between Workflows and Agents.** Before async handoffs, multi-agent coordination required pre-built workflows. You had to know at design time which agents would participate and in what order. Handoffs let agents make that decision at runtime. This is more flexible but harder to predict -- which is exactly why the governance gates exist. The right mental model is not "agents making decisions" but "agents proposing decisions that governance validates."

[Try: Create a Workflow](/workflows)

## What Comes Next

The handoff system opens new coordination patterns that were not possible with static workflows alone. We are exploring **handoff policies** -- per-profile rules that constrain which profiles can hand off to which, creating an organizational chart for agents. We are investigating **cross-swarm learning** -- feeding the Refinery's synthesis quality back into the learned context system so coordination itself improves over time. And we are watching how the twenty-profile workforce behaves as teams adopt business-function profiles for operational work that was previously manual.

The deeper question is whether the fixed-topology swarm and the emergent-topology handoff represent two ends of a spectrum or two fundamentally different paradigms. Our current belief is that they are complementary: swarms for predictable, repeatable coordination; handoffs for adaptive, situation-dependent delegation. The best multi-agent systems will use both, choosing the right pattern for each situation. The governance layer ensures that regardless of which pattern you choose, the system stays within bounds that humans have defined and can revise.
