---
title: "Task Execution"
subtitle: "Single-Agent to Multi-Agent Task Orchestration"
chapter: 2
part: 1
readingTime: 15
relatedDocs: [agent-intelligence, profiles, monitoring]
relatedJourney: work-use
---

## The Problem

Every AI product demo starts the same way. A human types a prompt, the model responds, the human refines. It is the pair programming pattern — conversational, iterative, grounded in turn-by-turn feedback. And for many tasks, it works beautifully. The human stays in the loop, catches mistakes early, and steers the work toward the right outcome.

But what happens when you remove the human from the loop?

This is the question that separates chatbots from agents. A chatbot waits for your next message. An agent takes your intent and runs with it — reading files, calling tools, making decisions, recovering from errors — all without you hovering over its shoulder. The gap between those two modes is where most AI applications stumble, and it is the gap this chapter is about.

The industry has tried to close this gap several times. AutoGPT burst onto the scene in early 2023 with the promise of fully autonomous agents that could decompose goals into sub-tasks, execute them in sequence, and self-correct. It was electrifying to watch — and wildly unreliable in practice. Agents would enter infinite loops, burn through API credits on tangential research, or confidently execute the wrong plan. The core insight was sound (LLMs can drive multi-step workflows), but the execution lacked the constraints that make autonomy safe.

LangChain's agent framework took a more structured approach, introducing the concept of agent executors with explicit tool definitions and chain-of-thought prompting. CrewAI pushed further into multi-agent territory, letting you define teams of agents with distinct roles and delegation patterns. These frameworks proved that orchestration matters — but they also revealed a tension that I think is fundamental to this space: the more autonomy you grant, the more guardrails you need.

> [!warning]
> **The Autonomy Trap**
> Full autonomy without guardrails is reckless. An agent with unrestricted tool access can delete files, make network requests, or run up API bills — all while confidently reporting success. The goal is not maximum autonomy. The goal is *progressive* autonomy: start constrained, earn trust through successful executions, and expand permissions incrementally. Every system in this chapter exists to make that progression safe.

When I started building Stagent, I wanted to find the middle ground. Not the "let the agent do everything" approach that makes demos exciting and production deployments terrifying. Not the "human approves every action" approach that defeats the purpose of automation. Instead, a system where agents operate within well-defined boundaries, where the database serves as a shared coordination layer, and where humans can step in precisely when their judgment matters most.

The architecture that emerged has three layers: a multi-agent routing system that matches tasks to specialized profiles, a fire-and-forget execution model that keeps the UI responsive while agents work in the background, and a permission system that cascades from profile-level constraints through persistent user preferences down to real-time human approval. Each layer addresses a different failure mode I encountered while building the system, and together they form what I think of as a progressive autonomy stack.

## Multi-Agent Routing

The first lesson I learned was that a single general-purpose agent is a liability. Not because the underlying model is incapable — Claude is remarkably versatile — but because the framing matters enormously. A code review needs a different system prompt, different tool access, and different behavioral constraints than a research task. Asking one agent to be good at everything means it is optimized for nothing.

This is a pattern the industry is converging on. CrewAI calls them "agents with roles." LangChain introduced "agent types." Microsoft's AutoGen has "conversable agents" with distinct system messages. The terminology varies, but the insight is the same: specialization through prompt engineering and tool scoping produces dramatically better results than general-purpose agents with kitchen-sink tool access.

In Stagent, specialization lives in the profile system. Each profile is a YAML file paired with a SKILL.md document that together define an agent's identity: what it is good at, which tools it can access, what its behavioral constraints are, and how it should format its output. The system ships with built-in profiles — a general assistant, a code reviewer, a researcher, a document writer, a data analyst, a DevOps engineer, and more — but users can create their own by dropping a new directory into `~/.claude/skills/`.

> [!info]
> **Agent Profiles: Specialization Through Configuration**
> Each profile defines a complete agent persona: domain expertise, allowed tools, MCP server connections, permission policies, output format, and behavioral instructions via SKILL.md. Built-in profiles ship with the app and are copied to the user's home directory on first run. Users can customize existing profiles or create entirely new ones — the system hot-reloads changes without restart.

The routing decision — which profile handles a given task — starts with the task classifier. Early in development, this was a simple keyword matcher: if the task title mentions "review" or "PR," route to the code reviewer. If it mentions "research" or "investigate," route to the researcher. This sounds naive, and it is, but it has a virtue that more sophisticated approaches lack: it is completely transparent. You can read the routing logic in under twenty lines and predict exactly where any task will land.

<!-- filename: src/lib/agents/profiles/registry.ts -->
```typescript
import type { AgentProfile } from "./types";
import { generalProfile } from "./general";
import { codeReviewerProfile } from "./code-reviewer";
import { researcherProfile } from "./researcher";
import { documentWriterProfile } from "./document-writer";

const PROFILE_REGISTRY: Map<string, AgentProfile> = new Map([
  ["general", generalProfile],
  ["code-reviewer", codeReviewerProfile],
  ["researcher", researcherProfile],
  ["document-writer", documentWriterProfile],
]);

export function getProfile(id: string): AgentProfile | undefined {
  return PROFILE_REGISTRY.get(id);
}

export function classifyTask(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("review") || text.includes("pr")) return "code-reviewer";
  if (text.includes("research") || text.includes("investigate")) return "researcher";
  if (text.includes("document") || text.includes("report")) return "document-writer";
  return "general";
}
```
*The profile registry and task classifier — routing logic in under 20 lines*

I want to be honest about the tradeoffs here. A keyword-based classifier will misroute tasks. Someone asking to "review the research findings" will get the code reviewer instead of the researcher. In practice, this matters less than you would think, because the user can always override the automatic classification from the UI — the classifier is a default, not a mandate. And the alternative — using an LLM call to classify each task before the main agent even starts — adds latency, cost, and its own failure modes to every single execution.

The profile system evolved significantly since those early days. What started as a hardcoded map of four profiles became a filesystem-based registry that scans `~/.claude/skills/` directories, validates YAML configurations against a Zod schema, pairs them with SKILL.md behavioral instructions, and caches the results with a filesystem-change-detection mechanism that invalidates the cache when profiles are added or modified. The system supports runtime-specific overrides (different tool configurations for Claude Code versus Codex), smoke tests baked into each profile definition, and hot-reloading without server restart.

The key insight is that the profile *is* the agent. There is no separate "agent class" with complex initialization logic. A profile is data — a system prompt, a tool allowlist, a set of constraints — and the execution engine simply applies that data when spinning up a new session. This makes agents cheap to create, easy to test, and safe to iterate on. If a profile produces bad results, you edit a YAML file and a markdown document. You do not refactor a class hierarchy.

![Chat session querying workflow execution state](/book/images/chat-querying-workflow.png "Here's a real chat session where we queried the workflow engine to debug a routing issue. The conversational interface makes it natural to inspect system state — you just ask.")

## Fire-and-Forget Execution

The second problem I needed to solve was responsiveness. An agent task can take anywhere from thirty seconds to fifteen minutes depending on complexity, tool usage, and the number of turns the agent needs. If the API route that triggers execution blocks until the agent finishes, the HTTP request times out, the UI freezes, and the user assumes something broke.

The solution is a pattern I call fire-and-forget with structured recovery. When you click "Execute" on a task, the API returns HTTP 202 (Accepted) immediately. The actual agent work happens in a background process that the execution manager tracks. The UI polls for status updates and streams logs via Server-Sent Events. If the agent fails, the error is captured, the task status is updated to "failed," and the logs contain everything you need to diagnose what went wrong.

This is fundamentally different from how most chat-based AI interfaces work. In a chat interface, you send a message and wait for the response — it is synchronous by nature. In a task execution system, the submission and the result are decoupled. You can submit a task, navigate to a different page, close your browser, and come back later to find the results waiting for you. This decoupling is what makes it possible to run multiple agents concurrently, chain tasks into workflows, and schedule recurring executions.

<!-- filename: src/lib/agents/execution-manager.ts -->
```typescript
export async function executeTask(taskId: string): Promise<void> {
  // Update status to "running"
  await updateTaskStatus(taskId, "running");

  // Fire-and-forget: don't await the agent
  runAgent(taskId).catch(async (error) => {
    await updateTaskStatus(taskId, "failed");
    await logAgentError(taskId, error);
  });
}

async function runAgent(taskId: string): Promise<void> {
  const task = await getTask(taskId);
  const profile = getProfile(task.agentProfile ?? "general");

  const agent = new ClaudeAgent({
    systemPrompt: profile.systemPrompt,
    tools: profile.tools,
    maxTokens: profile.constraints.maxTokensPerTurn,
  });

  const result = await agent.execute(task.description);
  await updateTaskStatus(taskId, "completed");
  await saveAgentLog(taskId, result);
}
```
*Fire-and-forget execution with error recovery baked in*

The execution manager itself is deceptively simple — an in-memory `Map<string, RunningExecution>` that tracks active tasks with their abort controllers, session IDs, and metadata. But simplicity at this layer is a deliberate choice. The complexity lives in the agent session (the Claude Agent SDK handles multi-turn conversation, tool invocation, and streaming) and in the coordination layer (the database tracks state transitions, the notification table handles permission requests, the log table captures every agent action).

Three supporting systems make fire-and-forget work in practice.

**Status tracking via the database.** Every task has a status column that transitions through a well-defined state machine: planned, queued, running, paused, completed, failed, cancelled. The UI polls this column to update the task card in real time. Because the database is the single source of truth, you can have multiple browser tabs open and they will all converge on the correct state. No WebSocket server to maintain, no in-memory state to synchronize across processes.

**Log streaming via Server-Sent Events.** While the task is running, the agent writes structured log entries to the `agent_logs` table. An SSE endpoint reads these logs with a polling loop (checking for new entries every few seconds) and pushes them to the client as they appear. This gives the user a live view of what the agent is doing — which tools it is calling, what it is thinking, where it is in the task — without the overhead of a WebSocket connection. SSE is unidirectional (server to client), which is exactly the access pattern we need: the agent produces logs, the UI consumes them.

> [!tip]
> **SSE for Real-Time Logs**
> Server-Sent Events are the unsung hero of real-time AI interfaces. Unlike WebSockets, SSE connections are plain HTTP, work through proxies and CDNs, automatically reconnect on failure, and require zero client-side library code — just `new EventSource(url)`. For unidirectional streaming (which is almost always what you need for agent logs), SSE is simpler, more reliable, and more infrastructure-friendly than WebSockets.

**Abort handling for cancellation.** Each running execution stores an `AbortController` that the UI can trigger to cancel a task mid-flight. The abort signal propagates through the Agent SDK session, cleanly terminating the conversation and any in-progress tool calls. The task status transitions to "cancelled" and the partial results are preserved in the logs. This might seem like a small detail, but it is critical for trust: if a user sees an agent heading in the wrong direction, they need a way to stop it immediately, not wait for it to finish burning through tokens.

The real-world execution flow is more nuanced than the simplified code above suggests. The actual `executeClaudeTask` function in Stagent builds document context from attached files, resolves the agent profile with runtime-specific overrides, constructs an environment with the correct authentication credentials, sets up usage tracking for token accounting, processes the Agent SDK's async message stream (handling tool permission requests, extracting usage snapshots, detecting model information), and performs post-execution analysis to extract learned patterns that improve future runs. It is around 300 lines of carefully orchestrated async code — but it all rests on the same fire-and-forget foundation.

![AI Assist generating a detailed task description from a brief title](/book/images/book-reader-task-ai-assist.png "This screenshot captures the AI Assist feature in action — the user types a brief task title, and the agent generates a detailed description with acceptance criteria before execution even begins. Small touches like this make the difference between a tool that developers tolerate and one they actually enjoy using.")

## Tool Permissions

If multi-agent routing is about matching the right agent to the right task, and fire-and-forget is about making execution non-blocking, then the permission system is about making autonomy safe. This is the layer that determines whether an agent can use a particular tool without asking, needs to ask the user first, or is blocked from using the tool entirely.

The industry has explored this space with varying degrees of sophistication. LangChain's early agents had no permission model — every tool in the agent's toolkit was available unconditionally. AutoGPT added a "continuous mode" toggle that was essentially an all-or-nothing switch. CrewAI introduced task-level delegation but not tool-level permissions. The common thread is that most frameworks treat permissions as an afterthought, a boolean flag bolted on after the core execution loop is built.

I think this gets the design exactly backwards. The permission model should be the *first* thing you design, because it determines the boundary between what the system can do autonomously and what requires human judgment. Get this wrong and you either have an agent that constantly interrupts you for trivial approvals (destroying the productivity gains that justified building the system) or an agent that silently executes dangerous operations (destroying trust that is impossible to rebuild).

Stagent uses a three-tier permission cascade. When an agent wants to use a tool, the system checks three sources in order, and the first definitive answer wins.

<!-- filename: src/lib/agents/tool-permissions.ts -->
```typescript
export async function canUseTool(
  toolName: string,
  agentProfile: string
): Promise<PermissionResult> {
  // 1. Check profile constraints
  const profile = getProfile(agentProfile);
  if (profile?.constraints.requiresApproval?.includes(toolName)) {
    return { allowed: false, reason: "requires-approval" };
  }

  // 2. Check persistent permissions
  const setting = await getSetting(`tool-permission:${toolName}`);
  if (setting?.value === "always-allow") {
    return { allowed: true, reason: "persistent-permission" };
  }

  // 3. Fall through to human-in-the-loop
  return { allowed: false, reason: "needs-user-approval" };
}
```
*Three-tier permission check — profile, persistence, then human*

**Tier 1: Profile constraints.** Each agent profile defines a `canUseToolPolicy` with explicit auto-approve and auto-deny lists. The code reviewer profile might auto-approve file reading tools but require approval for file writes. The researcher profile might auto-approve web search but deny filesystem access entirely. These constraints are baked into the profile definition and cannot be overridden by the user at runtime — they represent the security boundary that the profile author (you, the developer) considers non-negotiable.

**Tier 2: Persistent permissions.** When a user clicks "Always Allow" on a tool permission request, that preference is stored in the settings table and honored for all future executions. This is the learning layer — the system remembers your preferences so you do not have to approve the same safe tools repeatedly. The settings page shows all persistent permissions and lets you revoke any of them. Over time, your permission set converges on exactly the tools you trust for autonomous use, and the system interrupts you only for genuinely novel situations.

**Tier 3: Human-in-the-loop.** If neither the profile nor persistent settings provide a definitive answer, the system pauses the agent and presents the tool call to the user for approval. This is implemented through the database polling pattern: the agent writes a notification record with the tool name and proposed input, then polls the notification table every 1.5 seconds waiting for a response. The UI renders the permission request as an inline card in the task detail view, with "Allow," "Always Allow," and "Deny" buttons. The user's decision is written back to the notification record, the agent reads it on its next poll, and execution continues.

The database-as-message-queue pattern deserves special attention because it is one of those architectural decisions that sounds wrong on paper but works beautifully in practice. The conventional wisdom is that you need WebSockets or a proper message broker for real-time bidirectional communication. But the permission exchange has a very specific access pattern: one writer (the agent), one reader (the UI), low frequency (at most a few requests per task), and a hard requirement for persistence (if the server restarts mid-task, the pending permission request must survive). A database row satisfies all of these requirements with zero additional infrastructure. The polling adds a small amount of latency (up to 1.5 seconds) that is imperceptible to the user because they need time to read and evaluate the permission request anyway.

This three-tier cascade implements what I think of as progressive autonomy in practice. A new user starts with maximum safety — every unfamiliar tool triggers a human review. As they build confidence in the system, they click "Always Allow" for tools they trust. Over time, the system becomes increasingly autonomous *on their terms*, with the autonomy boundary shaped by their actual experience rather than an abstract trust setting. It is the opposite of the "full autonomy or nothing" approach that gave early agent systems their reputation for unpredictability.

[Try: Execute a Task](/tasks)

## Lessons Learned

Building the task execution layer taught me three things that I now consider foundational to any AI-native application.

**Specialization beats generalization.** A code review agent with a focused system prompt, scoped tool access, and domain-specific constraints produces dramatically better results than a general-purpose agent asked to "review this code." The overhead of maintaining multiple profiles is trivial compared to the improvement in output quality. This holds true even when the underlying model is the same — the framing is what matters. I have seen this pattern echoed across the industry: the most successful agent deployments are not the ones with the most powerful models, but the ones with the most carefully scoped roles.

**The database is the message queue.** Every coordination problem in Stagent — status tracking, log streaming, permission requests, workflow state — uses the same SQLite database as its communication layer. No Redis, no RabbitMQ, no WebSocket server. The database is already there for persistence; using it for coordination eliminates an entire class of infrastructure complexity. This only works because our access patterns are low-frequency and our consistency requirements are modest (eventual consistency within a few seconds is fine for a human watching a task execute). For a system processing thousands of concurrent agent tasks, you would need something more sophisticated. But for the single-user and small-team use case that Stagent targets, the database-as-message-queue pattern is a genuine architectural advantage.

**Log everything.** An agent that fails silently is worse than an agent that fails loudly. Every tool call, every permission decision, every status transition is captured in the agent logs table. When something goes wrong — and it will — the logs tell you exactly what happened, in what order, with what inputs. This is not just a debugging convenience; it is a trust mechanism. Users who can inspect exactly what an agent did are far more willing to grant expanded permissions than users who have to take the system's word for it. Transparency is the currency of progressive autonomy.

There is a fourth lesson that emerged later, as the system matured: the execution layer is never finished. Every new capability — workflows that chain tasks, schedules that trigger recurring executions, learned context that improves future runs — layers on top of the same fire-and-forget foundation. The simplicity of that foundation (submit a task, track its status, stream its logs, handle its permissions) is what makes it possible to compose these higher-level abstractions without the system collapsing under its own complexity. The next chapter will show how workflows build on this foundation to orchestrate multi-step processes, but the unit of execution remains the same: a single agent, working on a single task, within well-defined boundaries.
