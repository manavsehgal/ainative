---
title: "Multi-Agent Swarms"
subtitle: "Parallel Execution, Consensus, and Specialization"
chapter: 7
part: 3
readingTime: 16
relatedDocs: [profiles, agent-intelligence]
---

## The Problem

One agent is useful. Multiple agents working in concert are transformative. But multi-agent systems introduce coordination challenges: how do agents share context? How do they resolve conflicting outputs? How do you prevent duplication of effort? This chapter explores the frontier of multi-agent orchestration -- swarm patterns for parallel execution with consensus mechanisms.

If the previous chapters of this book have followed a trajectory from simple to complex, this chapter marks the point where the complexity changes in kind, not just in degree. A single agent executing a single task is a function call with personality. A workflow orchestrating sequential steps is a pipeline with decision points. But multiple agents working simultaneously on related problems, sharing partial results, and synthesizing a unified output -- that is a distributed system. And distributed systems have a well-earned reputation for humbling the engineers who build them.

I want to be honest about where Stagent stands on this frontier. The single-agent execution engine from Chapter 2 is battle-tested. The workflow orchestration from Chapter 4 has run thousands of multi-step pipelines. But multi-agent swarms -- true parallel execution with consensus -- are newer territory. Some of what I describe in this chapter is implemented and shipping. Some is designed and specified but not yet hardened through months of production use. And some is roadmap: patterns I believe are correct but have not yet built. I will be clear about which is which.

This honesty matters because the industry is awash in multi-agent demos that work beautifully on stage and collapse under real workloads. The gap between "three agents chatting in a notebook" and "three agents reliably coordinating in production" is as wide as the gap between a prototype and a product. If you take nothing else from this chapter, take this: the hard part of multi-agent systems is not getting agents to talk to each other. It is getting them to stop talking, agree on an answer, and do so within a token budget that does not bankrupt you.

> [!info]
> **Progressive Autonomy**
> This chapter follows the same progressive autonomy principle that runs through the entire book. You start with a single agent. You graduate to fan-out when one agent cannot cover enough ground. You add pipelines when sequential specialization matters. You reach for swarms only when the problem genuinely requires parallel exploration with synthesis. Each level adds power and complexity in equal measure. Skip levels at your peril.

## The Landscape: How the Industry Got Here

The multi-agent pattern is not new to AI. It has roots in multi-agent systems research from the 1990s -- the Contract Net Protocol, blackboard architectures, belief-desire-intention models. What is new is that modern LLMs have made agent construction trivially easy while leaving agent coordination just as hard as it ever was.

The current wave of multi-agent frameworks each take a different philosophical stance on coordination.

**OpenAI's Swarm** (2024) is deliberately minimal. It models agents as functions with handoff capabilities -- an agent can transfer control to another agent by returning a special handoff object. There is no central orchestrator, no shared state, no consensus mechanism. Coordination emerges from the handoff graph. This is elegant for customer service routing ("transfer to billing") but breaks down when you need agents to work in parallel and merge their outputs.

**CrewAI** takes the organizational metaphor seriously. Agents have roles, goals, and backstories. They are organized into "crews" with defined processes (sequential, hierarchical, or consensual). The hierarchical process assigns a manager agent that delegates to workers and synthesizes results. This is closer to what Stagent does, but CrewAI's abstraction is higher-level -- it manages the agent lifecycle for you, which means less control over execution details.

**AutoGen** from Microsoft models multi-agent interaction as conversation. Agents are participants in a group chat, and coordination happens through message passing. A "GroupChatManager" selects which agent speaks next based on the conversation history. This is powerful for open-ended collaboration but makes it hard to enforce structure. When you need a specific execution order with specific synthesis rules, conversational coordination feels like using a chat room to run a factory floor.

**Microsoft's Magentic-One** (2024) introduced a more structured approach: an Orchestrator agent that creates plans, delegates to specialized workers (WebSurfer, FileSurfer, Coder, ComputerTerminal), and tracks progress through a task ledger. This is the closest architecture to what I ended up building, though I arrived at it independently through the constraints of production use.

**LangGraph** offers the most flexible substrate -- arbitrary state machines with conditional edges, where nodes can be individual agents. You can model any multi-agent pattern in LangGraph, but you have to model it yourself. It is a meta-framework: powerful, general, and demanding.

What I noticed studying these systems is a recurring tension between flexibility and reliability. The more flexible the framework, the harder it is to reason about failure modes. The more structured the framework, the narrower its applicability. Stagent's approach is to offer a small number of well-defined coordination patterns -- the same philosophy we applied to workflows in Chapter 4 -- and make each pattern deeply observable and recoverable.

## Coordination Patterns

Through building Stagent and studying the landscape, I have converged on three coordination patterns that cover the multi-agent use cases I have actually encountered. Each pattern has a different topology, different failure modes, and different sweet spots.

### Fan-Out/Fan-In (Parallel Research)

The simplest multi-agent pattern. A coordinator breaks a problem into independent slices, dispatches each slice to a separate agent, and merges the results when all agents complete. This is Stagent's `parallel` workflow pattern, and it has been in production the longest.

The key insight is that fan-out only works when the slices are genuinely independent. If Agent A's output depends on Agent B's output, you do not have a fan-out problem -- you have a pipeline problem wearing a parallel disguise. Forcing it into fan-out will produce inconsistent results because each agent operates in isolation, unaware of what the others are discovering.

In practice, fan-out excels at research tasks. "Analyze this competitor from the product angle, the engineering angle, and the market angle" is a natural fan-out. Each agent explores a different dimension of the same subject, and the synthesis step merges perspectives into a unified report. The agents do not need to coordinate during execution because their domains are orthogonal.

Stagent implements fan-out through the workflow engine's parallel pattern. Each step runs as an independent task with its own agent invocation, and the engine tracks completion across all branches before advancing to the next sequential phase. The implementation is straightforward because the coordination logic reduces to: dispatch all, wait for all, continue.

Where fan-out gets interesting is in failure handling. If three agents are researching in parallel and one fails, you have a choice: fail the entire workflow, continue with partial results, or retry the failed branch. Stagent currently fails the branch and lets the refinery step work with whatever succeeded, but I am considering adding a configurable retry-on-failure policy per branch.

### Pipeline (Sequential Specialization)

Agents arranged in a chain, where each agent's output becomes the next agent's input. This maps directly to Stagent's `sequence` and `planner-executor` workflow patterns, with the added dimension that each step can be assigned to a different agent profile.

The pipeline pattern shines when a task requires multiple distinct competencies applied in order. Consider a content production workflow: a Researcher agent gathers source material, a Writer agent drafts the content, a Code Reviewer agent validates any technical claims, and an Editor agent polishes the final output. Each agent is specialized for its role, and the sequential handoff ensures each builds on the previous agent's work.

What makes pipelines powerful in a multi-agent context is that specialization compounds. A general-purpose agent asked to research, write, review, and edit will produce mediocre results at each stage because it is spreading its context window across four different cognitive modes. Four specialized agents, each focused on one mode, will outperform the generalist -- not because any individual agent is smarter, but because specialization allows deeper engagement with each phase.

The danger of pipelines is latency. If each agent takes 30 seconds, a four-stage pipeline takes two minutes. And unlike fan-out, there is no parallelism to exploit -- each stage must wait for the previous one. For time-sensitive tasks, this is often the binding constraint that pushes you toward a hybrid approach: fan-out within pipeline stages.

### Swarm (Governed Parallel Execution)

The swarm is Stagent's most sophisticated coordination pattern, and it is the one I am most excited about. It combines elements of fan-out and pipeline into a three-phase structure: **Mayor**, **Workers**, **Refinery**.

The Mayor agent analyzes the task, decomposes it into work assignments, and defines the coordination rules. Workers execute their assignments in parallel, each operating within the boundaries the Mayor set. The Refinery agent receives all worker outputs plus the Mayor's original plan and synthesizes a final result -- resolving conflicts, filling gaps, and producing a coherent output.

This is the pattern I reach for when a problem requires both breadth and depth. The Mayor provides strategic direction. The workers provide parallel exploration. The Refinery provides synthesis and quality control. It is, in effect, a small organization with a manager, specialists, and an editor.

<!-- filename: src/lib/workflows/swarm.ts -->
```typescript
export interface SwarmWorkflowStructure {
  mayorStep: WorkflowStep;
  workerSteps: WorkflowStep[];
  refineryStep: WorkflowStep;
  workerConcurrencyLimit: number;
}
```

The implementation enforces structural constraints: a swarm must have at least four steps (one mayor, at least two workers, one refinery), and worker concurrency is capped to prevent runaway token usage. The `workerConcurrencyLimit` in the `SwarmConfig` controls how many workers execute simultaneously -- set it to 2 for cost-conscious operation, or match it to the worker count for maximum parallelism.

Each worker receives a prompt that includes the Mayor's analysis and their specific assignment. This shared context is critical -- without it, workers would lack the strategic framing that keeps their outputs compatible. The Refinery then receives everything: the Mayor's plan, every worker's output, and its own synthesis instructions.

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

The "governed" in "governed multi-agent swarm" is intentional. Unlike open-ended multi-agent conversations where agents decide autonomously what to do next, Stagent's swarm has a fixed topology. The Mayor governs. Workers execute. The Refinery synthesizes. There is no dynamic handoff, no agent-to-agent negotiation, no emergent coordination. This is a deliberate constraint. In my experience, emergent coordination between LLM agents is unpredictable in ways that make production deployment terrifying. Fixed topology gives you predictable token usage, predictable latency, and predictable failure modes.

> [!warning]
> **Swarm Complexity**
> Swarms are the most powerful and the most dangerous multi-agent pattern. Each worker is an independent agent invocation with its own token budget, tool permissions, and failure modes. A swarm with 5 workers can burn through 500K tokens in a single execution. Start with fan-out for simple parallelism. Graduate to swarms only when you need the Mayor/Refinery governance layer.

## Consensus Mechanisms

When multiple agents produce outputs for the same problem, those outputs will differ. Sometimes the differences are complementary -- different perspectives on the same question. Sometimes they are contradictory -- incompatible conclusions from the same evidence. A consensus mechanism decides how to resolve these differences into a single output.

Stagent's current implementation uses what I call **coordinator adjudication**: the Refinery agent receives all worker outputs and uses its judgment to synthesize them. This is the simplest consensus mechanism and, in practice, the most flexible. The Refinery can identify contradictions, weigh evidence, and produce a synthesis that is better than any individual worker's output.

But coordinator adjudication has a limitation: it concentrates synthesis authority in a single agent call. If the Refinery misunderstands a worker's output or applies poor judgment, there is no check. This is why I am exploring two additional consensus mechanisms for future releases.

**Majority vote** works for tasks with discrete answers. If three workers independently classify a document and two say "technical specification" while one says "user guide," the majority wins. This is simple, robust, and well-suited to classification, validation, and yes/no decisions. The implementation would run the same prompt through multiple agents and compare structured outputs -- straightforward with JSON mode.

**Weighted merge** assigns different authority levels to different agents based on their specialization. A Code Reviewer agent's assessment of code quality carries more weight than a Researcher agent's assessment of the same code. Weights could be configured statically (in the profile) or dynamically (based on the agent's learned context score for the domain). This is the mechanism I am most interested in, because it connects directly to the self-improvement system from Chapter 6 -- agents that have learned more about a domain should have more influence in that domain.

> [!info]
> **Token Economics**
> Multi-agent patterns multiply token usage. A swarm with one Mayor, four Workers, and one Refinery makes six separate LLM calls. If each consumes 10K tokens, that is 60K tokens for a single workflow execution. Stagent's usage ledger tracks per-task token consumption, making multi-agent cost visible and budgetable. Always set token limits on swarm workflows -- unbounded multi-agent execution is the fastest way to an unexpected bill.

The token economics of multi-agent systems deserve more attention than they typically get. In a single-agent system, cost scales linearly with task complexity -- more complex tasks require longer conversations, which consume more tokens. In a multi-agent system, cost scales with both complexity and parallelism. A swarm that fans out to five workers does not just use five times the tokens of a single agent -- it often uses more, because each worker needs context about the overall task, the Mayor's instructions, and its specific assignment. The overhead of coordination context can easily double the per-worker token cost.

This is why Stagent's swarm implementation includes a `workerConcurrencyLimit`. It is not just about preventing API rate limits (though that matters too). It is about giving operators a knob to trade latency for cost. Running two workers at a time instead of five takes longer but costs the same total -- and spreads the cost over time, making it easier to stay within per-minute spending limits.

## Specialization Through Profiles

The power of multi-agent patterns comes not from having multiple copies of the same agent, but from having multiple *different* agents. Specialization is the superpower.

Stagent's agent profile system, introduced in Chapter 6 and detailed in the profiles registry, provides the foundation for multi-agent specialization. Each profile defines a distinct behavioral identity: system prompt, allowed tools, MCP server connections, output format preferences, and runtime overrides per execution engine.

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

In a swarm workflow, the Mayor step might use a `general` profile (broad reasoning, planning capability), the worker steps might each use a specialized profile (`code-reviewer`, `researcher`, `document-writer`), and the Refinery step might use a profile optimized for synthesis and editing. Each agent profile carries its own tool permissions, so a researcher worker can access web search tools while a code reviewer worker can access filesystem tools -- without either having access to tools outside their specialization.

This per-profile tool scoping is a security feature as much as a coordination feature. In a multi-agent system, the blast radius of a misbehaving agent is proportional to its tool access. A researcher agent with filesystem write access could corrupt files. A code reviewer with web access could exfiltrate code. Principle of least privilege is not just good security practice -- it is essential for multi-agent safety.

The profile system also connects to learned context. Each profile accumulates its own learned patterns from past executions (Chapter 6). A code reviewer profile that has learned your project's naming conventions will apply those conventions when reviewing code in a swarm, without explicit instruction. Over time, specialized agents become genuinely specialized -- not just through their static system prompts, but through their accumulated experience.

[Try: Agent Profiles](/settings)

## Real-World Challenges

Building multi-agent systems in production has taught me several lessons that are not obvious from the framework documentation.

### Message Passing and Context Windows

Every piece of information shared between agents consumes context window space. In a swarm, the Mayor's output is injected into every worker's prompt. Every worker's output is injected into the Refinery's prompt. If the Mayor produces a 2,000-token analysis and four workers each produce 3,000 tokens of findings, the Refinery starts with 14,000 tokens of context before its own instructions. This is workable with 100K+ context windows, but it creates pressure to keep intermediate outputs concise.

I have found that explicit output format instructions are essential for multi-agent coordination. "Return your findings as a bulleted list, maximum 500 words" is not a nice-to-have -- it is a structural requirement that keeps the context pipeline from overflowing. The Refinery's quality degrades noticeably when worker outputs exceed a few thousand tokens each, because the synthesis task becomes harder as input volume grows.

### State Consistency

In a fan-out pattern, workers execute in parallel against a shared context (the Mayor's analysis). But what if the underlying data changes during execution? If Worker A reads a file at time T and Worker B reads the same file at time T+30s after another process modified it, their outputs will be based on inconsistent state.

Stagent does not currently solve this problem at the infrastructure level. The practical mitigation is to keep swarm execution fast (seconds to low minutes, not hours) and to avoid swarm patterns for tasks that modify shared state. This is an area where traditional distributed systems wisdom applies directly: if you need consistency, serialize. If you can tolerate eventual consistency, parallelize. Multi-agent swarms are inherently eventually consistent systems.

### Deadlock Prevention

Deadlocks in multi-agent systems are different from deadlocks in traditional concurrent programming. They do not involve mutex locks. Instead, they manifest as circular dependencies: Agent A is waiting for Agent B's output, and Agent B is waiting for Agent A's output. In conversational multi-agent systems (like AutoGen's group chat), this can happen when two agents keep deferring to each other.

Stagent's fixed topology prevents this class of deadlock entirely. The Mayor never waits for workers. Workers never wait for each other. The Refinery never waits for the Mayor (it already has the Mayor's output). Information flows in one direction: Mayor to Workers to Refinery. This is a DAG, and DAGs cannot deadlock.

For more complex topologies (which Stagent does not yet support but which are on the roadmap), deadlock prevention would require either timeout-based circuit breakers or a global coordinator that detects and breaks cycles. I lean toward timeouts -- they are simpler to implement and their failure mode (incomplete output) is preferable to the alternative (infinite hang).

### Observability

When a single agent fails, debugging is straightforward: read the execution log. When a swarm fails, the question is which agent failed, why, and whether the failure cascaded to other agents. Multi-agent observability requires per-agent logging, cross-agent correlation, and timeline visualization.

Stagent's swarm dashboard provides this through a three-lane view: Mayor on the left, Workers in the center (with parallel tracks), Refinery on the right. Each lane shows the step's status, its output, and any errors. Failed workers are highlighted, and the Refinery's synthesis notes which workers it was able to incorporate and which were missing.

This visual topology maps directly to the mental model. When something goes wrong, you can scan the dashboard and immediately see: did the Mayor give poor instructions? Did a specific worker fail? Did the Refinery struggle to synthesize? Each failure mode has a different fix, and the dashboard makes it obvious which mode you are in.

## Designing Multi-Agent Systems: The Human Role

If there is a theme that connects every chapter of this book, it is that AI-native applications work best when humans and agents each do what they are good at. In multi-agent systems, the human's role shifts from operator to system designer.

You are not executing tasks. You are not even reviewing individual outputs (though you can). You are designing the coordination protocol: which agents participate, what each one does, how their outputs are synthesized, and what happens when things go wrong. You are the architect of a small, temporary organization that exists for the duration of a workflow execution.

This is a different skill from prompt engineering. Prompt engineering optimizes a single agent's behavior. Multi-agent design optimizes the interactions between agents. The prompts matter, but the topology matters more. A well-designed swarm with mediocre individual prompts will often outperform a poorly designed swarm with excellent individual prompts, because coordination failures compound while prompt quality is bounded.

The progressive autonomy principle applies here too. Start by designing swarms manually: choose the agents, write their assignments, configure the Refinery's synthesis rules. As you develop intuition for what works, you can let the Mayor agent handle task decomposition (which Stagent's swarm pattern already does). Eventually, you might trust the system to select worker profiles dynamically based on the task domain. But each step up the autonomy ladder should be earned through observation and validation, not assumed.

> [!tip]
> **Design Heuristic: The Meeting Test**
> Before creating a multi-agent swarm, ask yourself: "If these were people, would I schedule a meeting for this?" If the task can be done by one person working alone, use a single agent. If it needs a meeting with a clear agenda, assigned roles, and a designated note-taker who synthesizes the discussion -- that is a swarm. If you would not trust the meeting to produce a good outcome without a facilitator, make sure your Mayor and Refinery prompts are strong.

## Lessons Learned

Building multi-agent features for Stagent has reinforced three convictions that I now consider foundational.

**Start Simple, Add Agents Later.** It is tempting to reach for multi-agent patterns because they feel sophisticated. Resist this. A single well-prompted agent with good tools will outperform a poorly coordinated swarm on most tasks. Multi-agent patterns earn their complexity when: (1) the task requires genuinely different competencies, (2) parallelism provides meaningful speedup, or (3) consensus across multiple perspectives produces measurably better output. If none of these conditions hold, a single agent is the right answer.

I have seen teams deploy multi-agent systems for tasks that a single agent handles perfectly well, because the multi-agent version "felt more robust." It was not. It was slower, more expensive, harder to debug, and produced outputs of equivalent quality. The only thing it robustly produced was higher token bills.

**Shared State Is Hard.** The moment two agents need to read or write the same state, you have a coordination problem that no amount of prompt engineering can solve. Keep agents' concerns orthogonal. If they must share state, make one agent the writer and others readers, and use the pipeline pattern to sequence the writes. The swarm pattern's Mayor/Worker/Refinery structure enforces this naturally: the Mayor writes the plan, workers read it and write their findings, the Refinery reads everything and writes the final output. No concurrent writes. No conflicts.

**Specialization Is the Superpower.** The most impactful multi-agent pattern is not the most complex one -- it is the one where each agent is genuinely specialized for its role. A code review swarm where one worker focuses on security, another on performance, and a third on API design will catch issues that a single general-purpose reviewer misses. Not because the swarm is smarter in aggregate, but because each specialized agent goes deeper into its domain than a generalist would.

This is the same principle that makes human teams effective. A team of generalists will produce generalist output. A team of specialists, well-coordinated, will produce output that no individual -- no matter how talented -- could match. The coordination overhead is the price of depth. It is almost always worth paying.

[Try: Agent Profiles](/settings)

## What Comes Next

Multi-agent orchestration is the most rapidly evolving area in AI-native development. The patterns in this chapter represent the state of the art as I understand it in early 2026, but the landscape is shifting fast.

On Stagent's roadmap, I see three areas of development. First, **dynamic worker selection**: letting the Mayor agent choose which profiles to assign to workers based on task analysis, rather than requiring the human to specify profiles at workflow creation time. Second, **cross-swarm learning**: feeding the Refinery's synthesis quality back into the learned context system, so the coordination protocol itself improves over time. Third, **nested swarms**: allowing a worker step in one swarm to spawn a sub-swarm for its own task, enabling hierarchical decomposition of truly complex problems.

Further out, I am watching the industry converge on standards for inter-agent communication. The Model Context Protocol (MCP) provides a foundation for tool sharing. If agents can expose capabilities to each other through MCP servers, the boundary between "tools" and "other agents" dissolves -- an agent becomes just another tool that happens to be intelligent. This is a powerful abstraction, and I suspect it will reshape how we think about multi-agent coordination within the next year.

But the most important development will not be technical. It will be the emergence of design patterns for multi-agent systems that are as well-understood as design patterns for object-oriented programming. We are in the "goto statement" era of multi-agent design -- we know the basic mechanisms work, but we have not yet developed the structured programming disciplines that make them reliable at scale. This book, and this chapter in particular, is my contribution to that emerging body of knowledge. It is necessarily incomplete. The field is moving too fast for any single text to be definitive. But the principles -- progressive autonomy, fixed topologies, specialization through profiles, human as system designer -- these I believe will endure even as the specific implementations evolve.
