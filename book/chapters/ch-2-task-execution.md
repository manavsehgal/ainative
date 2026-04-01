---
title: "Task Execution"
subtitle: "Single-Agent to Multi-Agent Task Orchestration"
chapter: 2
part: 1
readingTime: 15
lastGeneratedBy: "2026-03-31T21:00:00Z"
---

## The Problem

Every AI product demo starts the same way. A human types a prompt, the model responds, the human refines. It is the pair programming pattern — conversational, iterative, grounded in turn-by-turn feedback. And for many tasks, it works beautifully. The human stays in the loop, catches mistakes early, and steers the work toward the right outcome.

But what happens when you remove the human from the loop?

This is the question that separates chatbots from agents. A chatbot waits for your next message. An agent takes your intent and runs with it — reading files, calling tools, making decisions, recovering from errors — all without you hovering over its shoulder. The gap between those two modes is where most AI applications stumble, and it is the gap this chapter is about.

The industry has tried to close this gap several times. AutoGPT burst onto the scene in early 2023 with the promise of fully autonomous agents that could decompose goals into sub-tasks, execute them in sequence, and self-correct. It was electrifying to watch — and wildly unreliable in practice. Agents would enter infinite loops, burn through API credits on tangential research, or confidently execute the wrong plan. The core insight was sound (LLMs can drive multi-step workflows), but the execution lacked the constraints that make autonomy safe.

LangChain's agent framework took a more structured approach, introducing the concept of agent executors with explicit tool definitions and chain-of-thought prompting. CrewAI pushed further into multi-agent territory, letting you define teams of agents with distinct roles and delegation patterns. These frameworks proved that orchestration matters — but they also revealed a tension that we think is fundamental to this space: the more autonomy you grant, the more guardrails you need.

> [!warning]
> **The Autonomy Trap**
> Full autonomy without guardrails is reckless. An agent with unrestricted tool access can delete files, make network requests, or run up API bills — all while confidently reporting success. The goal is not maximum autonomy. The goal is *progressive* autonomy: start constrained, earn trust through successful executions, and expand permissions incrementally. Every system in this chapter exists to make that progression safe.

When we started building Stagent, we wanted to find the middle ground. Not the "let the agent do everything" approach that makes demos exciting and production deployments terrifying. Not the "human approves every action" approach that defeats the purpose of automation. Instead, a system where agents operate within well-defined boundaries, where the database serves as a shared coordination layer, and where humans can step in precisely when their judgment matters most.

The architecture that emerged has four layers: a multi-agent routing system that matches tasks to specialized profiles across five runtime providers, a fire-and-forget execution model that keeps the UI responsive while agents work in the background, a permission system that cascades from profile-level constraints through persistent user preferences down to real-time human approval, and an intelligence layer that gives agents memory and the ability to hand off work to one another. Each layer addresses a different failure mode we encountered while building the system, and together they form what we think of as a progressive autonomy stack.

## Multi-Agent Routing

The first lesson we learned was that a single general-purpose agent is a liability. Not because the underlying model is incapable — Claude is remarkably versatile — but because the framing matters enormously. A code review needs a different system prompt, different tool access, and different behavioral constraints than a research task. Asking one agent to be good at everything means it is optimized for nothing.

In Stagent, specialization lives in the profile system. Each profile is a YAML file paired with a SKILL.md document that together define an agent's identity: what it is good at, which tools it can access, what its behavioral constraints are, and how it should format its output. The system ships with 20 built-in profiles spanning two broad categories.

**Technical profiles** handle developer and analytical work: General, Code Reviewer, Data Analyst, DevOps Engineer, Document Writer, Researcher, Project Manager, Technical Writer, and Sweep (for proactive codebase maintenance).

**Business-function profiles** cover operational roles that turn Stagent into an AI Business Operating System: Marketing Strategist (market research, campaign planning, growth strategy), Sales Researcher (lead qualification, personalized outreach), Customer Support Agent (ticket triage, empathetic response drafting, escalation management), Financial Analyst (financial statement analysis, forecasting, investor-ready reporting), Content Creator (blog posts, social media, newsletters, conversion-focused copy), and Operations Coordinator (SOP documentation, process optimization, cross-functional coordination).

**Lifestyle profiles** round out the catalog for personal use: Wealth Manager, Health & Fitness Coach, Learning Coach, Travel Planner, and Shopping Assistant.

Users can create custom profiles by dropping a directory into `~/.claude/skills/`, and the registry picks them up on the next access — no restart required.

> [!info]
> **Agent Profiles: Specialization Through Configuration**
> Each profile defines a complete agent persona: domain expertise, allowed tools, MCP server connections, permission policies, output format, and behavioral instructions via SKILL.md. Built-in profiles ship with the app and are copied to the user's home directory on first run. Users can customize existing profiles or create entirely new ones — the system hot-reloads changes without restart. Profiles are cross-provider: the same definition works on all five runtimes (Claude Code SDK, Codex App Server, Anthropic Direct, OpenAI Direct, and Ollama), with optional runtime-specific overrides.

Here is what a profile looks like in practice. The code reviewer auto-approves read-only tools (Read, Grep, Glob) but requires approval for Bash commands, caps execution at 20 turns, and includes smoke tests that verify the profile produces expected output keywords:

<!-- filename: src/lib/agents/profiles/builtins/code-reviewer/profile.yaml -->
```yaml
id: code-reviewer
name: Code Reviewer
version: "1.0.0"
domain: work
tags: [security, code-quality, owasp, review, audit, bug, vulnerability]
supportedRuntimes: [claude-code, openai-codex-app-server]

allowedTools:
  - Read
  - Grep
  - Glob
  - Bash

canUseToolPolicy:
  autoApprove: [Read, Grep, Glob]
  autoDeny: []

maxTurns: 20
outputFormat: structured-findings

tests:
  - task: "Review the auth middleware for security issues"
    expectedKeywords: [OWASP, injection, authentication, vulnerability]
  - task: "Check this function for performance problems"
    expectedKeywords: [performance, allocation, complexity, optimization]
```
*The code reviewer profile — scoped tools, bounded turns, and built-in smoke tests*

The `AgentProfile` type captures everything the execution engine needs:

<!-- filename: src/lib/agents/profiles/types.ts -->
```typescript
export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  domain: string;
  tags: string[];
  /** Full content of the SKILL.md file (system prompt + behavioral instructions) */
  skillMd: string;
  allowedTools?: string[];
  mcpServers?: Record<string, unknown>;
  canUseToolPolicy?: CanUseToolPolicy;
  maxTurns?: number;
  outputFormat?: string;
  version?: string;
  author?: string;
  tests?: ProfileSmokeTest[];
  supportedRuntimes: AgentRuntimeId[];
  /** Preferred runtime for auto-routing. When set, suggestRuntime() prefers this. */
  preferredRuntime?: AgentRuntimeId;
  runtimeOverrides?: Partial<Record<AgentRuntimeId, ProfileRuntimeOverride>>;
  /** Per-runtime capability overrides (model, extended thinking, server tools). */
  capabilityOverrides?: Partial<Record<AgentRuntimeId, ProfileRuntimeCapabilityOverride>>;
}
```
*The profile type — from tool policies and runtime overrides to capability-level control per provider*

The `capabilityOverrides` field is a recent addition that deserves attention. It lets a profile declare per-runtime settings like model selection, extended thinking parameters, and server-side tools. A financial-analyst profile might request `claude-opus-4` via Anthropic Direct with extended thinking enabled for deep analysis, while defaulting to a lighter model on Ollama for local quick-checks. This makes profiles not just behavior-portable but performance-tunable across providers.

The profile registry has evolved from a simple hardcoded map into a filesystem-based scanner with cache invalidation:

<!-- filename: src/lib/agents/profiles/registry.ts -->
```typescript
let profileCache: Map<string, AgentProfile> | null = null;
let profileCacheSignature: string | null = null;

function getSkillsDirectorySignature(): string {
  if (!fs.existsSync(SKILLS_DIR)) return "missing";

  const entries = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const signatureParts: string[] = [];
  for (const entry of entries) {
    const dir = path.join(SKILLS_DIR, entry.name);
    const yamlPath = path.join(dir, "profile.yaml");
    const skillPath = path.join(dir, "SKILL.md");

    signatureParts.push(entry.name);
    if (fs.existsSync(yamlPath)) {
      const stats = fs.statSync(yamlPath);
      signatureParts.push(`yaml:${stats.mtimeMs}:${stats.size}`);
    }
    if (fs.existsSync(skillPath)) {
      const stats = fs.statSync(skillPath);
      signatureParts.push(`skill:${stats.mtimeMs}:${stats.size}`);
    }
  }
  return signatureParts.join("|");
}
```
*Filesystem-based profile loading with mtime-based cache invalidation — edit a YAML file, and the next execution picks it up*

The routing decision — which profile handles a given task — uses auto-detect classification. The task classifier analyzes the task content and selects the best-fit profile from the registry. The user can always override the automatic classification from the UI; the classifier is a default, not a mandate.

## Five Runtime Providers

A profile defines *what* an agent does. A runtime defines *how* it runs. Stagent supports five runtime adapters, each with distinct capabilities:

<!-- filename: src/lib/agents/runtime/catalog.ts -->
```typescript
export const SUPPORTED_AGENT_RUNTIMES = [
  "claude-code",
  "openai-codex-app-server",
  "anthropic-direct",
  "openai-direct",
  "ollama",
] as const;
```

**Claude Code** (Agent SDK) is the primary runtime — full approvals, session resume, MCP server passthrough, and the richest tool ecosystem. **OpenAI Codex App Server** connects via WebSocket JSON-RPC for sandboxed code execution. **Anthropic Direct** and **OpenAI Direct** provide lightweight API access for simpler tasks that do not need tool use. **Ollama** is the newest addition — a local runtime that connects to Ollama-managed models running on your own hardware, enabling fully offline agent execution with zero API costs.

The runtime catalog declares capabilities for each provider: which ones support resume, cancel, approvals, MCP servers, profile tests, and auth health checks. The profile's `supportedRuntimes` field intersects with available runtimes to determine which providers can execute a given task. When `preferredRuntime` is set on a profile, the auto-router honors that preference.

## Fire-and-Forget Execution

The second problem we needed to solve was responsiveness. An agent task can take anywhere from thirty seconds to fifteen minutes depending on complexity, tool usage, and the number of turns the agent needs. If the API route that triggers execution blocks until the agent finishes, the HTTP request times out, the UI freezes, and the user assumes something broke.

The solution is a pattern we call fire-and-forget with structured recovery. When you click "Execute" on a task, the API returns HTTP 202 (Accepted) immediately. The actual agent work happens in a background process that the execution manager tracks. The UI polls for status updates and streams logs via Server-Sent Events.

The execution manager itself is deceptively simple — an in-memory `Map<string, RunningExecution>` that tracks active tasks:

<!-- filename: src/lib/agents/execution-manager.ts -->
```typescript
interface RunningExecution {
  abortController: AbortController;
  sessionId: string | null;
  taskId: string;
  startedAt: Date;
  interrupt?: () => Promise<void>;
  cleanup?: () => Promise<void>;
  metadata?: Record<string, unknown>;
}

const executions = new Map<string, RunningExecution>();

export function getExecution(taskId: string): RunningExecution | undefined {
  return executions.get(taskId);
}

export function setExecution(taskId: string, execution: RunningExecution): void {
  executions.set(taskId, execution);
}

export function removeExecution(taskId: string): void {
  executions.delete(taskId);
}
```
*The entire execution manager — simplicity at this layer is a deliberate choice*

Simplicity at this layer is deliberate. The complexity lives in the agent session (the SDK handles multi-turn conversation, tool invocation, and streaming) and in the coordination layer (the database tracks state transitions, the notification table handles permission requests, the log table captures every agent action).

Three supporting systems make fire-and-forget work in practice.

**Status tracking via the database.** Every task has a status column that transitions through a well-defined state machine: planned, queued, running, paused, completed, failed, cancelled. The UI polls this column to update the task card in real time. Because the database is the single source of truth, you can have multiple browser tabs open and they will all converge on the correct state.

**Log streaming via Server-Sent Events.** While the task is running, the agent writes structured log entries to the `agent_logs` table — every tool start, every stream event, every completion or error. An SSE endpoint reads these logs with a polling loop and pushes them to the client as they appear.

> [!tip]
> **SSE for Real-Time Logs**
> Server-Sent Events are the unsung hero of real-time AI interfaces. Unlike WebSockets, SSE connections are plain HTTP, work through proxies and CDNs, automatically reconnect on failure, and require zero client-side library code — just `new EventSource(url)`. For unidirectional streaming (which is almost always what you need for agent logs), SSE is simpler, more reliable, and more infrastructure-friendly than WebSockets.

**Abort handling for cancellation.** Each running execution stores an `AbortController` that the UI can trigger to cancel a task mid-flight. The abort signal propagates through the Agent SDK session, cleanly terminating the conversation and any in-progress tool calls.

The system also supports **session resume**. If a task fails or is interrupted, the Agent SDK session ID is persisted in the database. The `resumeClaudeTask` function picks up where the agent left off, passing the saved session ID back to the SDK's `resume` option. A resume counter prevents infinite retry loops.

**Usage tracking** runs alongside every execution. The system extracts token counts and model information from the SDK's stream messages, then writes a ledger entry on completion. This feeds the Cost & Usage dashboard, giving visibility into how much each task, workflow, or schedule costs across all five providers.

## Agent Intelligence: Memory and Handoffs

The execution engine described above handles a single agent running a single task. But production AI systems need two additional capabilities: agents that remember what they learned, and agents that can delegate work to each other.

### Episodic Memory

Stagent's episodic memory system gives agents persistent factual knowledge that survives across task executions. Distinct from behavioral learned context (which adjusts how an agent approaches work), episodic memory captures what an agent discovers — facts, decisions, outcomes, and patterns.

<!-- filename: src/lib/db/schema.ts (agent_memory table) -->
```typescript
export const agentMemory = sqliteTable("agent_memory", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  category: text("category", {
    enum: ["fact", "preference", "pattern", "outcome"],
  }).notNull(),
  content: text("content").notNull(),
  confidence: integer("confidence").default(700).notNull(), // 0-1000 scale
  sourceTaskId: text("source_task_id").references(() => tasks.id),
  tags: text("tags"), // JSON array
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" }),
  accessCount: integer("access_count").default(0).notNull(),
  decayRate: integer("decay_rate").default(10).notNull(), // per-day decay in thousandths
  status: text("status", {
    enum: ["active", "decayed", "archived", "rejected"],
  }).default("active").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```
*Episodic memory schema — confidence scoring, time-based decay, and four memory categories*

Each memory entry has a confidence score on a 0-1000 scale, a decay rate that reduces relevance over time, and a category (fact, preference, pattern, or outcome). When a new task executes, the system retrieves only memories relevant to the current context, filtered by profile and weighted by confidence after applying time-based decay. Older memories gradually lose weight, keeping the context window focused on current knowledge without losing historical information entirely.

The practical impact is significant. A financial-analyst profile that researches a company once can recall that research in future tasks without re-doing the work. A customer-support-agent profile that learns a client's preference for concise responses remembers that preference across tickets. Memory access counts help identify which knowledge is most frequently useful, informing what to prioritize and what to let decay.

A memory browser UI lets operators inspect, edit, and delete stored memories — maintaining human oversight over what agents "know."

### Async Handoffs

The second intelligence capability is agent-to-agent handoffs. When one agent discovers work that falls outside its expertise, it can hand that work off to another profile through an asynchronous message bus:

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
    status: request.requiresApproval ? "pending" : "accepted",
    requiresApproval: request.requiresApproval ?? false,
    chainDepth,
    createdAt: now,
  });
}
```
*The handoff bus — governance-gated delegation between agent profiles*

Governance gates prevent the most common failure modes of multi-agent systems. Chain depth limits prevent infinite handoff loops (agent A hands to B, which hands to C, which hands back to A). Self-handoff is blocked. Handoff requests surface in the human inbox for approval before the receiving agent begins work — maintaining the progressive autonomy principle even in agent-to-agent communication. Configurable handoff policies determine which profiles can hand off to which, and under what conditions.

This enables emergent workflows: a researcher discovers a code issue and hands it off to the code-reviewer. A content-creator drafts marketing copy and hands it to the marketing-strategist for review. These workflows are not pre-built — they emerge from agent judgment, constrained by governance rules.

## Tool Permissions

If multi-agent routing is about matching the right agent to the right task, and fire-and-forget is about making execution non-blocking, then the permission system is about making autonomy safe. Stagent uses a three-tier permission cascade. When an agent wants to use a tool, the system checks three sources in order, and the first definitive answer wins:

**Tier 1: Profile constraints.** Each agent profile defines a `canUseToolPolicy` with explicit auto-approve and auto-deny lists. These constraints are the fastest check — no database I/O, just an in-memory array lookup.

**Tier 2: Persistent permissions.** When a user clicks "Always Allow" on a tool permission request, that preference is stored in the settings table. The permission system supports pattern-based matching — not just blanket tool approval, but granular constraints like `Bash(command:git *)` that allow Bash only when the command starts with "git."

**Tier 3: Human-in-the-loop.** If neither the profile nor persistent settings provide a definitive answer, the system pauses the agent and presents the tool call to the user for approval via the database polling pattern.

> [!lesson]
> **Permission deduplication matters.** During development, we discovered that agents sometimes request the same tool with identical inputs multiple times in rapid succession. Without deduplication, this would flood the user with redundant permission popups. The system now caches in-flight and settled permission responses per-task, keyed by `taskId::toolName::JSON(input)`. If a duplicate request arrives while one is pending, it shares the same Promise.

## Multi-Channel Delivery

Task results do not have to stay inside Stagent. The delivery channel system routes output to external platforms:

<!-- filename: src/lib/channels/registry.ts -->
```typescript
const adapters: Record<string, ChannelAdapter> = {
  slack: slackAdapter,
  telegram: telegramAdapter,
  webhook: webhookAdapter,
};

export async function sendToChannels(
  channelIds: string[],
  message: ChannelMessage
): Promise<ChannelDeliveryResult[]> {
  if (channelIds.length === 0) return [];
  const configs = await db
    .select()
    .from(channelConfigs)
    .where(inArray(channelConfigs.id, channelIds));
  // ... send to each enabled channel
}
```
*Three channel adapters — Slack, Telegram, and webhook — with bidirectional chat support*

Schedules and heartbeats can specify delivery channels, so results flow directly to the team's communication tool. Bidirectional support means Slack and Telegram are not just output channels — you can send messages back through them, triggering new tasks or continuing conversations. Inbound polling via `conversations.history` (Slack) and `getUpdates` (Telegram) makes the channels a two-way interface to the entire agent system.

## Chat as a Conversational Task Interface

Chat provides a conversational alternative to the task board for creating and managing tasks. The tool catalog organizes workspace capabilities into five categories — Explore, Create, Debug, Automate, and Smart Picks — with multi-provider model selection across all five runtimes. @ mentions inject document context directly into prompts, while slash commands offer quick access to tools and actions. Tasks created through chat land in the same governed pipeline as board-created tasks, flowing through the same fire-and-forget execution, the same permission cascade, and the same log streaming infrastructure described above.

[Try: Execute a Task](/tasks)

## Lessons Learned

Building the task execution layer taught us five things that we now consider foundational to any AI-native application.

**Specialization beats generalization.** A code review agent with a focused SKILL.md prompt, scoped tool access via YAML, and domain-specific constraints produces dramatically better results than a general-purpose agent asked to "review this code." This holds even when the underlying model is the same; the framing is what matters. The addition of business-function profiles (marketing-strategist, financial-analyst, etc.) validated this principle beyond engineering — the same specialization advantage applies to sales outreach, customer support, and financial analysis.

**Five runtimes are better than one.** Early versions of Stagent ran everything through Claude Code. Adding Codex App Server, Anthropic Direct, OpenAI Direct, and Ollama did not just provide fallback options — it changed how we think about task routing. Simple summarization tasks route to lightweight API calls. Complex code analysis goes to Claude Code with full tool access. Cost-sensitive recurring heartbeats can run on local Ollama models. The profile's `preferredRuntime` and `capabilityOverrides` make this routing transparent and configurable.

**The database is the message queue.** Every coordination problem in Stagent — status tracking, log streaming, permission requests, handoff governance, usage accounting — uses the same SQLite database as its communication layer. No Redis, no RabbitMQ, no WebSocket server. For the single-user and small-team use case that Stagent targets, the database-as-message-queue pattern is a genuine architectural advantage.

**Memory must decay.** Our first implementation of episodic memory stored everything at equal weight forever. The context window filled with stale facts, and agents spent tokens reasoning over outdated information. Adding confidence-based decay and relevance filtering transformed memory from a liability into an asset. The decay rate is tunable per-memory, and the memory browser gives humans oversight over what agents retain.

**Build safety nets into the stream processor.** Early in development, we encountered a class of failures where the agent stream would end without producing a final result — the agent would exhaust its turn limit, and the task would sit in "running" status forever. The fix was a safety net: if no result frame was received, the task is automatically marked as failed with a diagnostic message. Similarly, abort handling checks for cancellation before writing results, preventing race conditions. These defensive patterns cost almost nothing to implement but prevent the most frustrating class of user experience failures.

There is a sixth lesson that emerged later, as the system matured: the execution layer is never finished. Every new capability — workflows that chain tasks, schedules that trigger recurring executions, episodic memory that accumulates knowledge, handoffs that delegate between profiles, channels that deliver results externally — layers on top of the same fire-and-forget foundation. The simplicity of that foundation (submit a task, track its status, stream its logs, handle its permissions) is what makes it possible to compose these higher-level abstractions without the system collapsing under its own complexity.
