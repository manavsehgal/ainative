---
title: "Task Execution"
subtitle: "Single-Agent to Multi-Agent Task Orchestration"
chapter: 2
part: 1
readingTime: 15
lastGeneratedBy: "2026-03-25T03:03:33.295Z"
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

When we started building Stagent, we wanted to find the middle ground. Not the "let the agent do everything" approach that makes demos exciting and production deployments terrifying. Not the "human approves every action" approach that defeats the purpose of automation. Instead, a system where agents operate within well-defined boundaries, where the database serves as a shared coordination layer, and where humans can step in precisely when their judgment matters most.

The architecture that emerged has three layers: a multi-agent routing system that matches tasks to specialized profiles, a fire-and-forget execution model that keeps the UI responsive while agents work in the background, and a permission system that cascades from profile-level constraints through persistent user preferences down to real-time human approval. Each layer addresses a different failure mode we encountered while building the system, and together they form what we think of as a progressive autonomy stack.

## Multi-Agent Routing

The first lesson we learned was that a single general-purpose agent is a liability. Not because the underlying model is incapable — Claude is remarkably versatile — but because the framing matters enormously. A code review needs a different system prompt, different tool access, and different behavioral constraints than a research task. Asking one agent to be good at everything means it is optimized for nothing.

This is a pattern the industry is converging on. CrewAI calls them "agents with roles." LangChain introduced "agent types." Microsoft's AutoGen has "conversable agents" with distinct system messages. The terminology varies, but the insight is the same: specialization through prompt engineering and tool scoping produces dramatically better results than general-purpose agents with kitchen-sink tool access.

In Stagent, specialization lives in the profile system. Each profile is a YAML file paired with a SKILL.md document that together define an agent's identity: what it is good at, which tools it can access, what its behavioral constraints are, and how it should format its output. The system ships with fourteen built-in profiles — General, Code Reviewer, Data Analyst, DevOps Engineer, Document Writer, Researcher, Project Manager, Technical Writer, Wealth Manager, Health & Fitness Coach, Learning Coach, Travel Planner, Shopping Assistant, and Sweep — but users can create their own by dropping a new directory into `~/.claude/skills/`.

> [!info]
> **Agent Profiles: Specialization Through Configuration**
> Each profile defines a complete agent persona: domain expertise, allowed tools, MCP server connections, permission policies, output format, and behavioral instructions via SKILL.md. Built-in profiles ship with the app and are copied to the user's home directory on first run. Users can customize existing profiles or create entirely new ones — the system hot-reloads changes without restart. Profiles are cross-provider: the same definition works on both Claude (Agent SDK) and Codex (App Server) runtimes, with optional runtime-specific overrides.

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

The profile registry has evolved significantly since the early days of hardcoded maps. What started as a simple four-profile `Map` became a filesystem-based scanner that reads `~/.claude/skills/*/profile.yaml`, validates each file against a Zod schema, pairs it with a SKILL.md behavioral document, and caches the results with filesystem-change-detection that invalidates the cache when profiles are added or modified:

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

function ensureLoaded(): Map<string, AgentProfile> {
  ensureBuiltins();
  const signature = getSkillsDirectorySignature();
  if (!profileCache || profileCacheSignature !== signature) {
    profileCache = scanProfiles();
    profileCacheSignature = signature;
  }
  return profileCache;
}
```
*Filesystem-based profile loading with mtime-based cache invalidation*

The routing decision — which profile handles a given task — uses auto-detect classification. The task classifier analyzes the task content and selects the best-fit profile from the registry. The user can always override the automatic classification from the UI; the classifier is a default, not a mandate.

The key insight is that the profile *is* the agent. There is no separate "agent class" with complex initialization logic. A profile is data — a YAML configuration, a SKILL.md system prompt, an allowed tool list, a set of constraints — and the execution engine simply applies that data when spinning up a new session. This makes agents cheap to create, easy to test, and safe to iterate on. If a profile produces bad results, you edit a YAML file and a markdown document. You do not refactor a class hierarchy.

The `AgentProfile` type captures everything the execution engine needs to know:

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
  source?: string;
  tests?: ProfileSmokeTest[];
  supportedRuntimes: AgentRuntimeId[];
  runtimeOverrides?: Partial<Record<AgentRuntimeId, ProfileRuntimeOverride>>;
}
```
*The profile type — everything from tool policies to runtime-specific overrides*

Profiles also support cross-provider compatibility. The same profile works on both Claude Code (via the Agent SDK) and Codex App Server (via WebSocket JSON-RPC), with optional `runtimeOverrides` that tailor instructions or tool lists per provider. The general profile, for example, ships with a Codex-specific instruction override:

<!-- filename: src/lib/agents/profiles/builtins/general/profile.yaml -->
```yaml
id: general
name: General
version: "1.0.0"
domain: work
tags: [general, default, task, help, assistant]
supportedRuntimes: [claude-code, openai-codex-app-server]

runtimeOverrides:
  openai-codex-app-server:
    instructions: |
      You are the default Stagent operator profile for Codex App Server.
      Stay pragmatic, execute the requested work directly, and prefer
      concise operational updates.

maxTurns: 30
```
*Cross-provider profiles — same identity, runtime-tailored behavior*

![Chat session querying workflow execution state](/book/images/chat-querying-workflow.png "Here's a real chat session where we queried the workflow engine to debug a routing issue. The conversational interface makes it natural to inspect system state — you just ask.")

## Fire-and-Forget Execution

The second problem we needed to solve was responsiveness. An agent task can take anywhere from thirty seconds to fifteen minutes depending on complexity, tool usage, and the number of turns the agent needs. If the API route that triggers execution blocks until the agent finishes, the HTTP request times out, the UI freezes, and the user assumes something broke.

The solution is a pattern we call fire-and-forget with structured recovery. When you click "Execute" on a task, the API returns HTTP 202 (Accepted) immediately. The actual agent work happens in a background process that the execution manager tracks. The UI polls for status updates and streams logs via Server-Sent Events. If the agent fails, the error is captured, the task status is updated to "failed," and the logs contain everything you need to diagnose what went wrong.

This is fundamentally different from how most chat-based AI interfaces work. In a chat interface, you send a message and wait for the response — it is synchronous by nature. In a task execution system, the submission and the result are decoupled. You can submit a task, navigate to a different page, close your browser, and come back later to find the results waiting for you. This decoupling is what makes it possible to run multiple agents concurrently, chain tasks into workflows, and schedule recurring executions.

The execution manager itself is deceptively simple — an in-memory `Map<string, RunningExecution>` that tracks active tasks with their abort controllers, session IDs, and metadata:

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

Simplicity at this layer is deliberate. The complexity lives in the agent session (the Claude Agent SDK handles multi-turn conversation, tool invocation, and streaming) and in the coordination layer (the database tracks state transitions, the notification table handles permission requests, the log table captures every agent action).

The real execution flow in `executeClaudeTask` orchestrates all of these concerns. It builds document context from attached files, resolves the agent profile with runtime-specific overrides, constructs an environment with the correct authentication credentials, sets up usage tracking for token accounting, processes the Agent SDK's async message stream, and performs post-execution pattern extraction for self-improvement:

<!-- filename: src/lib/agents/claude-agent.ts -->
```typescript
export async function executeClaudeTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error(`Task ${taskId} not found`);
  const usageState = createTaskUsageState(task);

  const abortController = new AbortController();
  const agentProfileId = task.agentProfile ?? "general";

  setExecution(taskId, {
    abortController,
    sessionId: null,
    taskId,
    startedAt: new Date(),
  });

  try {
    await prepareTaskOutputDirectory(taskId, { clearExisting: true });
    const ctx = await buildTaskQueryContext(task, agentProfileId);

    const authEnv = await getAuthEnv();
    const response = query({
      prompt: ctx.userPrompt,
      options: {
        abortController,
        includePartialMessages: true,
        cwd: ctx.cwd,
        env: buildClaudeSdkEnv(authEnv),
        systemPrompt: ctx.systemInstructions
          ? { type: "preset", preset: "claude_code", append: ctx.systemInstructions }
          : { type: "preset", preset: "claude_code" },
        maxTurns: ctx.maxTurns,
        maxBudgetUsd: DEFAULT_MAX_BUDGET_USD,
        ...(ctx.payload?.allowedTools && { allowedTools: ctx.payload.allowedTools }),
        ...(ctx.payload?.mcpServers && { mcpServers: ctx.payload.mcpServers }),
        canUseTool: async (toolName: string, input: Record<string, unknown>) => {
          return handleToolPermission(taskId, toolName, input, ctx.canUseToolPolicy);
        },
      },
    });

    await processAgentStream(taskId, task.title, response, abortController, agentProfileId, usageState);

    // Fire-and-forget pattern extraction for self-improvement
    analyzeForLearnedPatterns(taskId, agentProfileId).catch((err) => {
      console.error("[self-improvement] pattern extraction failed:", err);
    });
  } catch (error: unknown) {
    await handleExecutionError(taskId, task.title, error, abortController, agentProfileId, usageState);
  } finally {
    clearPermissionCache(taskId);
    removeExecution(taskId);
  }
}
```
*The full execution flow — profile resolution, SDK query, stream processing, and cleanup*

Three supporting systems make fire-and-forget work in practice.

**Status tracking via the database.** Every task has a status column that transitions through a well-defined state machine: planned, queued, running, paused, completed, failed, cancelled. The UI polls this column to update the task card in real time. Because the database is the single source of truth, you can have multiple browser tabs open and they will all converge on the correct state. No WebSocket server to maintain, no in-memory state to synchronize across processes.

**Log streaming via Server-Sent Events.** While the task is running, the agent writes structured log entries to the `agent_logs` table — every tool start, every stream event, every completion or error. An SSE endpoint reads these logs with a polling loop and pushes them to the client as they appear. This gives the user a live view of what the agent is doing without the overhead of a WebSocket connection.

> [!tip]
> **SSE for Real-Time Logs**
> Server-Sent Events are the unsung hero of real-time AI interfaces. Unlike WebSockets, SSE connections are plain HTTP, work through proxies and CDNs, automatically reconnect on failure, and require zero client-side library code — just `new EventSource(url)`. For unidirectional streaming (which is almost always what you need for agent logs), SSE is simpler, more reliable, and more infrastructure-friendly than WebSockets.

**Abort handling for cancellation.** Each running execution stores an `AbortController` that the UI can trigger to cancel a task mid-flight. The abort signal propagates through the Agent SDK session, cleanly terminating the conversation and any in-progress tool calls. The task status transitions to "cancelled" and the partial results are preserved in the logs. The stream processor checks for abort throughout:

<!-- filename: src/lib/agents/claude-agent.ts -->
```typescript
// Handle result — skip if task was cancelled mid-stream
if (message.type === "result" && "result" in raw) {
  if (abortController.signal.aborted) {
    await finalizeTaskUsage(usageState, "cancelled");
    return;
  }
  receivedResult = true;
  // ... save result, notify, log, scan outputs
}

// Safety net: if stream ended without a result frame, fail the task
// instead of leaving it stuck in "running" forever
if (!receivedResult) {
  const errorDetail = turnCount > 0
    ? `Agent exhausted its turn limit (${turnCount} turns used) without producing a final result.`
    : "Agent stream ended without producing a result";
  // ... mark failed, notify
}
```
*Abort-aware stream processing with a safety net for incomplete executions*

The system also supports **session resume**. If a task fails or is interrupted, the Agent SDK session ID is persisted in the database. The `resumeClaudeTask` function picks up where the agent left off, passing the saved session ID back to the SDK's `resume` option. This avoids repeating expensive work — the agent resumes its conversation with full context of prior turns. A resume counter prevents infinite retry loops, and session expiry is detected gracefully.

**Usage tracking** runs alongside every execution. The system extracts token counts and model information from the SDK's stream messages, then writes a ledger entry on completion. This feeds the cost and usage dashboard, giving users visibility into how much each task, workflow, or schedule costs across providers.

![AI Assist generating a detailed task description from a brief title](/book/images/book-reader-task-ai-assist.png "This screenshot captures the AI Assist feature in action — the user types a brief task title, and the agent generates a detailed description with acceptance criteria before execution even begins. Small touches like this make the difference between a tool that developers tolerate and one they actually enjoy using.")

## Tool Permissions

If multi-agent routing is about matching the right agent to the right task, and fire-and-forget is about making execution non-blocking, then the permission system is about making autonomy safe. This is the layer that determines whether an agent can use a particular tool without asking, needs to ask the user first, or is blocked from using the tool entirely.

The industry has explored this space with varying degrees of sophistication. LangChain's early agents had no permission model — every tool in the agent's toolkit was available unconditionally. AutoGPT added a "continuous mode" toggle that was essentially an all-or-nothing switch. CrewAI introduced task-level delegation but not tool-level permissions. The common thread is that most frameworks treat permissions as an afterthought, a boolean flag bolted on after the core execution loop is built.

We think this gets the design exactly backwards. The permission model should be the *first* thing you design, because it determines the boundary between what the system can do autonomously and what requires human judgment. Get this wrong and you either have an agent that constantly interrupts you for trivial approvals (destroying the productivity gains that justified building the system) or an agent that silently executes dangerous operations (destroying trust that is impossible to rebuild).

Stagent uses a three-tier permission cascade. When an agent wants to use a tool, the system checks three sources in order, and the first definitive answer wins:

<!-- filename: src/lib/agents/claude-agent.ts -->
```typescript
async function handleToolPermission(
  taskId: string,
  toolName: string,
  input: Record<string, unknown>,
  canUseToolPolicy?: CanUseToolPolicy
): Promise<ToolPermissionResponse> {
  const isQuestion = toolName === "AskUserQuestion";

  // Layer 1: Profile-level canUseToolPolicy — fastest check, no I/O
  if (!isQuestion && canUseToolPolicy) {
    if (canUseToolPolicy.autoApprove?.includes(toolName)) {
      return buildAllowedToolPermissionResponse(input);
    }
    if (canUseToolPolicy.autoDeny?.includes(toolName)) {
      return { behavior: "deny", message: `Profile policy denies ${toolName}` };
    }
  }

  // Layer 2: Saved user permissions — skip notification for pre-approved tools
  if (!isQuestion) {
    const { isToolAllowed } = await import("@/lib/settings/permissions");
    if (await isToolAllowed(toolName, input)) {
      return buildAllowedToolPermissionResponse(input);
    }
  }

  // Layer 3: Database polling — ask the user
  const notificationId = crypto.randomUUID();
  await db.insert(notifications).values({
    id: notificationId,
    taskId,
    type: "permission_required",
    title: `Permission required: ${toolName}`,
    body: JSON.stringify(input).slice(0, 1000),
    toolName,
    toolInput: JSON.stringify(input),
    createdAt: new Date(),
  });

  return waitForToolPermissionResponse(notificationId);
}
```
*Three-tier permission cascade — profile policy, persistent preferences, then human approval*

**Tier 1: Profile constraints.** Each agent profile defines a `canUseToolPolicy` with explicit auto-approve and auto-deny lists. The code reviewer profile auto-approves `Read`, `Grep`, and `Glob` but requires approval for `Bash`. The researcher profile might auto-approve web search but deny filesystem access entirely. These constraints are the fastest check — no database I/O, just an in-memory array lookup — and they represent the security boundary that the profile author considers non-negotiable.

**Tier 2: Persistent permissions.** When a user clicks "Always Allow" on a tool permission request, that preference is stored in the settings table and honored for all future executions. The permission system supports pattern-based matching — not just blanket tool approval, but granular constraints like `Bash(command:git *)` that allow Bash only when the command starts with "git":

<!-- filename: src/lib/settings/permissions.ts -->
```typescript
export function matchesPermission(
  toolName: string,
  input: Record<string, unknown>,
  pattern: string
): boolean {
  const parenIdx = pattern.indexOf("(");

  // No constraint — bare tool name match
  if (parenIdx === -1) {
    return pattern === toolName;
  }

  const patternTool = pattern.slice(0, parenIdx);
  if (patternTool !== toolName) return false;

  // Parse constraint: "key:glob)"
  const constraint = pattern.slice(parenIdx + 1, -1);
  const colonIdx = constraint.indexOf(":");
  if (colonIdx === -1) return false;

  const key = constraint.slice(0, colonIdx);
  const glob = constraint.slice(colonIdx + 1);
  const inputValue = String(input[key] ?? "");

  if (glob.endsWith("*")) {
    return inputValue.startsWith(glob.slice(0, -1));
  }
  return inputValue === glob;
}
```
*Pattern-based permission matching — granular control beyond simple allow/deny*

This means "Always Allow" is not a blunt instrument. A user can approve `Read` blanket (safe — it is read-only) while constraining `Bash` to specific command prefixes. The settings page shows all persistent permissions and lets you revoke any of them.

**Tier 3: Human-in-the-loop.** If neither the profile nor persistent settings provide a definitive answer, the system pauses the agent and presents the tool call to the user for approval. This is implemented through the database polling pattern: the agent writes a notification record with the tool name and proposed input, then polls the notification table every 1.5 seconds waiting for a response. The UI renders the permission request as an inline card in the task detail view, with "Allow," "Always Allow," and "Deny" buttons:

<!-- filename: src/lib/agents/claude-agent.ts -->
```typescript
async function waitForToolPermissionResponse(
  notificationId: string
): Promise<ToolPermissionResponse> {
  const deadline = Date.now() + 55_000;
  const pollInterval = 1500;

  while (Date.now() < deadline) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId));

    if (notification?.response) {
      const parsed = JSON.parse(notification.response);
      const validated = toolPermissionResponseSchema.safeParse(parsed);
      if (validated.success) return validated.data;
      return { behavior: "deny", message: "Invalid response format" };
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return { behavior: "deny", message: "Permission request timed out" };
}
```
*Database polling for permission responses — 55-second timeout with 1.5-second intervals*

The database-as-message-queue pattern deserves special attention because it is one of those architectural decisions that sounds wrong on paper but works beautifully in practice. The conventional wisdom is that you need WebSockets or a proper message broker for real-time bidirectional communication. But the permission exchange has a very specific access pattern: one writer (the agent), one reader (the UI), low frequency (at most a few requests per task), and a hard requirement for persistence (if the server restarts mid-task, the pending permission request must survive). A database row satisfies all of these requirements with zero additional infrastructure. The polling adds a small amount of latency (up to 1.5 seconds) that is imperceptible to the user because they need time to read and evaluate the permission request anyway.

The chat interface uses a different mechanism — an in-memory `AsyncQueue` and `Promise`-based permission bridge — because chat conversations are synchronous and short-lived, making database persistence unnecessary. But for task execution, where the agent might run for minutes and the user might navigate away, the database polling pattern is the right choice.

> [!lesson]
> **Permission deduplication matters.** During development, we discovered that agents sometimes request the same tool with identical inputs multiple times in rapid succession. Without deduplication, this would flood the user with redundant permission popups. The system now caches in-flight and settled permission responses per-task, keyed by `taskId::toolName::JSON(input)`. If a duplicate request arrives while one is pending, it shares the same Promise. If the same request was already settled, the cached response is returned instantly.

This three-tier cascade implements what we think of as progressive autonomy in practice. A new user starts with maximum safety — every unfamiliar tool triggers a human review. As they build confidence in the system, they click "Always Allow" for tools they trust, optionally with pattern constraints. Over time, the system becomes increasingly autonomous *on their terms*, with the autonomy boundary shaped by their actual experience rather than an abstract trust setting.

[Try: Execute a Task](/tasks)

## Lessons Learned

Building the task execution layer taught us four things that we now consider foundational to any AI-native application.

**Specialization beats generalization.** A code review agent with a focused SKILL.md prompt, scoped tool access via YAML, and domain-specific constraints produces dramatically better results than a general-purpose agent asked to "review this code." The overhead of maintaining multiple profiles is trivial compared to the improvement in output quality — each profile is just two files in a directory. This holds true even when the underlying model is the same; the framing is what matters. We have seen this pattern echoed across the industry: the most successful agent deployments are not the ones with the most powerful models, but the ones with the most carefully scoped roles.

**The database is the message queue.** Every coordination problem in Stagent — status tracking, log streaming, permission requests, workflow state, usage accounting — uses the same SQLite database as its communication layer. No Redis, no RabbitMQ, no WebSocket server. The database is already there for persistence; using it for coordination eliminates an entire class of infrastructure complexity. This only works because our access patterns are low-frequency and our consistency requirements are modest (eventual consistency within a few seconds is fine for a human watching a task execute). For a system processing thousands of concurrent agent tasks, you would need something more sophisticated. But for the single-user and small-team use case that Stagent targets, the database-as-message-queue pattern is a genuine architectural advantage.

**Log everything.** An agent that fails silently is worse than an agent that fails loudly. Every tool call, every permission decision, every status transition is captured in the agent logs table. When something goes wrong — and it will — the logs tell you exactly what happened, in what order, with what inputs. This is not just a debugging convenience; it is a trust mechanism. Users who can inspect exactly what an agent did are far more willing to grant expanded permissions than users who have to take the system's word for it. Transparency is the currency of progressive autonomy. The monitoring dashboard at `/monitor` aggregates all agent activity into a single real-time feed, making it easy to spot errors, trace execution paths, and build confidence in the system.

**Build safety nets into the stream processor.** Early in development, we encountered a class of failures where the agent stream would end without producing a final result — the agent would exhaust its turn limit or encounter an SDK error, and the task would sit in "running" status forever. The fix was a safety net at the end of the stream processor: if no result frame was received, the task is automatically marked as failed with a diagnostic message that tells the user what happened. Similarly, abort handling checks for cancellation before writing results, preventing race conditions where a cancelled task appears to complete. These defensive patterns cost almost nothing to implement but prevent the most frustrating class of user experience failures.

There is a fifth lesson that emerged later, as the system matured: the execution layer is never finished. Every new capability — workflows that chain tasks, schedules that trigger recurring executions, learned context that feeds back into future runs, session resume that avoids repeating expensive work — layers on top of the same fire-and-forget foundation. The simplicity of that foundation (submit a task, track its status, stream its logs, handle its permissions) is what makes it possible to compose these higher-level abstractions without the system collapsing under its own complexity. The next chapter will show how document processing builds on this foundation to transform unstructured input into structured knowledge, but the unit of execution remains the same: a single agent, working on a single task, within well-defined boundaries.
