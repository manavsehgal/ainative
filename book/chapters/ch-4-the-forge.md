---
title: "The Forge"
subtitle: "Task Execution at Scale"
chapter: 4
part: 2
readingTime: 16
lastGeneratedBy: "2026-04-18T17:10:00.000Z"
relatedDocs: ["agent-intelligence", "profiles", "monitoring"]
relatedJourney: "work-use"
---

## The Execution Problem

There is a moment in every AI-native team's journey where the novelty of "an agent wrote code" wears off and the real question lands: how do we run fifty of these at once?

A single-agent CLI is a powerful tool. You open a terminal, describe what you want, and watch the agent work. For a solo developer on a side project, this is transformative. But for a team shipping production software — where a sprint might contain forty tasks across eight projects, each requiring different expertise and different levels of trust — a single terminal session does not scale. You cannot sit in front of a screen babysitting each agent through each task, one at a time, eight hours a day.

The execution problem is not about making agents smarter. It is about making agent work parallel, asynchronous, and observable. It is about building the forge — the place where raw tasks, refined by the intake pipeline, are heated, hammered, and shaped into finished work product at industrial scale.

> [!case-study]
> **Stripe's Minions: 1,300+ PRs Per Week**
> In February 2026, Alistair Gray from Stripe's engineering tools team shared numbers that made the industry stop and recalculate. Stripe's internal agent system — which they call Minions — was producing over 1,300 pull requests per week, fully unattended, one-shot execution. "In a world where developer attention is constrained," Gray wrote, "unattended agents allow parallelization." The key word is "unattended." These agents are not pair-programming with humans. They receive a task, execute it, produce a PR, and move on. The human reviews the output, not the process. Stripe proved that the execution bottleneck was not agent capability — models were already good enough — but the infrastructure to dispatch, monitor, and collect results from hundreds of concurrent agent sessions.

The machine that builds machines needs a forge that never sleeps, that can run dozens of tasks simultaneously, and that reports back clearly when work is done — or when something goes wrong.

## Fire-and-Forget

`ainative-business`'s execution model is built on a simple but powerful pattern: fire-and-forget with async observation. When a task is ready for execution, the client sends a POST request and immediately receives an HTTP 202 Accepted response. The server acknowledges the request and begins execution in the background. The client is free to navigate away, start other tasks, or close the browser entirely.

```typescript
// Building with ainative: Multi-runtime task execution
const task = await fetch("/api/tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Refactor authentication module for OAuth 2.1",
    projectId: "proj-8f3a-4b2c",
    assignedAgent: "claude-code",
    agentProfile: "code-reviewer",
    priority: 1,
  }),
}).then((r) => r.json());

// Fire-and-forget — server returns 202, execution runs in background
const { sessionId } = await fetch(`/api/tasks/${task.id}/execute`, {
  method: "POST",
}).then((r) => r.json());

// Stream logs in real-time
const logs = new EventSource(`/api/tasks/${task.id}/logs`);
logs.onmessage = (event) => {
  const entry = JSON.parse(event.data);
  if (entry.type === "tool_use") {
    console.log(`Agent using: ${entry.tool}`);
  } else if (entry.type === "result") {
    console.log("Task complete:", entry.output);
    logs.close();
  }
};
```

This pattern — HTTP 202 for dispatch, Server-Sent Events for observation — is deliberately low-tech. We chose it over WebSockets because SSE is simpler to implement, works through proxies and load balancers without special configuration, and automatically reconnects on network interruption. The execution manager does not need bidirectional communication with the client. It needs to send a stream of log entries. SSE does exactly that.

The execution manager in `src/lib/agents/execution-manager.ts` is the heart of the forge. When it receives an execute request, it resolves the task's project, loads the associated agent profile, assembles document context, determines the target runtime, and spawns the agent process. It writes log entries to the `agent_logs` table as execution progresses, and SSE clients polling that table receive updates in near-real-time.

Why not WebSockets? Because our database is already a message queue. The `notifications` table acts as a lightweight pub-sub system. The execution manager writes events. The client polls for them. This reuses infrastructure we already have rather than introducing a new communication protocol with its own failure modes, connection management, and scaling characteristics. Simple systems have fewer bugs.

## Multi-Runtime Dispatch

Not every task should run on the same model. A code review task benefits from Claude's deep reasoning. A quick text transformation might be fine on a local Ollama instance at zero cost. A task requiring web search might route through OpenAI's tools. The forge needs to be runtime-agnostic.

`ainative-business` supports five execution runtimes:

**Claude Code SDK**: The primary runtime for complex coding tasks. Uses the `@anthropic-ai/claude-agent-sdk` with a subprocess model — the execution manager spawns a Claude Code process with the task prompt, project context, and tool permissions. The `canUseTool` callback implements a database polling pattern where the agent pauses when it wants to use a tool, writes a notification, and waits for human approval (or auto-approval based on the profile's `canUseToolPolicy`).

**Anthropic Direct API**: For tasks that do not need filesystem access or tool use — summarization, analysis, text generation. Calls the Anthropic Messages API directly, avoiding the overhead of spawning a subprocess. Faster startup, lower resource usage, but no tool capabilities.

**OpenAI Direct API**: Same pattern as Anthropic Direct, but routing through OpenAI's API. Useful for tasks where GPT models have specific strengths or when diversifying model risk.

**Codex App Server**: OpenAI's Codex runtime, integrated via a WebSocket JSON-RPC client in `src/lib/agents/runtime/codex-app-server-client.ts`. Provides a sandboxed execution environment with its own tool ecosystem. The integration is bidirectional — `ainative-business` can dispatch tasks to Codex and receive structured results.

**Ollama (Local)**: For privacy-sensitive tasks or high-volume low-stakes work. Runs entirely on local hardware with no data leaving the machine. The trade-off is capability — local models are smaller and less capable — but for certain task categories, the cost and privacy benefits dominate.

The task's `assignedAgent` field determines which runtime handles execution. The profile's `supportedRuntimes` array declares which runtimes a given behavioral profile can work with. The execution manager validates the combination before dispatch: a task assigned to `ollama` with a profile that only supports `claude-code` will fail fast with a clear error rather than silently producing poor results.

> [!case-study]
> **Ramp Inspect: "Effectively Free to Run"**
> Ramp's engineering team reported in January 2026 that over 30% of their merged pull requests came from their agent system, Inspect. But the number that caught our attention was the cost characterization: "Sessions are fast to start and effectively free to run." Ramp deployed Inspect across multiple channels — Slack, Chrome extension, web interface, VS Code — so agents met developers where they already worked. The multi-channel approach mirrors our multi-runtime strategy: the right execution environment for the right task. Ramp did not force all agent work through a single interface. They built adapters for every context where developers needed help. The result was adoption that felt organic rather than mandated.

## Profile-Based Routing

Assigning a task to a runtime is half the routing problem. The other half is behavioral: how should the agent approach this specific task?

This is where agent profiles earn their keep. A profile is not just a system prompt — it is a complete behavioral specification. It declares allowed tools, auto-approval policies, maximum conversation turns, domain tags, and test cases. When a task executes, its `agentProfile` field determines which profile governs the agent's behavior.

`ainative-business` ships with a task classifier that can automatically select profiles based on task content. The classifier examines the task title and description, matches against profile domain tags, and suggests the best fit. A task titled "Review authentication changes for security issues" routes to the `code-reviewer` profile. A task titled "Research competitor pricing models" routes to the `researcher` profile. A task titled "Write API documentation for the payments module" routes to the `document-writer` profile.

The classifier is a convenience, not a constraint. Users can always override the suggested profile. The goal is reducing friction — when a user creates twenty tasks in a batch, they should not have to manually select a profile for each one. The classifier handles the common cases; the user handles the exceptions.

This separation of runtime (where the agent runs) from profile (how the agent behaves) is a critical architectural decision. It means we can change execution infrastructure without touching behavioral configuration, and we can refine agent behavior without changing deployment topology. The forge's physical layout is independent of the blueprints the smiths follow.

## The Permission Callback

Speed without safety is recklessness. The forge runs hot, but it has safeguards.

The `canUseTool` pattern is `ainative-business`'s primary safety mechanism for agent execution. When an agent wants to use a tool — read a file, write to disk, execute a shell command, make an API call — the execution manager intercepts the request. It checks the agent's profile to determine the approval policy for that specific tool.

Three outcomes are possible:

1. **Auto-approve**: The tool is in the profile's `autoApprove` list. The agent proceeds without human intervention. Read-only tools like `Read`, `Grep`, and `Glob` are typically auto-approved for all profiles.

2. **Auto-deny**: The tool is in the profile's `autoDeny` list. The agent is told it cannot use this tool. This is useful for constraining agents to their lane — a `researcher` profile might auto-deny `Write` and `Bash` to prevent it from modifying the codebase.

3. **Human approval**: The tool is in neither list. The execution manager writes a notification to the database and the agent pauses. The human sees a pending approval in the UI, reviews the tool call and its arguments, and approves or denies. The agent resumes.

This is progressive autonomy in practice. A new profile starts with most tools requiring human approval. As trust builds — as you observe the agent making good decisions with a particular tool — you move tools from the human-approval category to auto-approve. The "Always Allow" button in the UI persists this decision to the settings table, so the choice carries across sessions.

> [!case-study]
> **Harvey Spectre: System-Triggered Agents**
> Harvey, the AI legal platform, described an evolution that resonated with our own trajectory. "Much of what it does is no longer triggered by a human prompt. It is triggered by the system monitoring the company." This is the logical endpoint of fire-and-forget execution: agents that do not wait for human instruction at all. They respond to system events — a new contract uploaded, a compliance deadline approaching, a regulatory change detected. The permission callback becomes even more important in this context. When no human initiates the task, the safety guardrails encoded in profiles and tool policies are the primary check on agent behavior. Harvey's insight is that system-triggered agents require stricter, more thoughtful permission design than human-triggered ones.

The permission callback is implemented via database polling rather than WebSockets, which might seem like an odd choice for a real-time interaction. But it has a crucial advantage: crash recovery. If the server restarts mid-execution, the pending tool approval sits in the database waiting. When the agent process resumes, it finds the notification and continues. A WebSocket connection would have been lost, requiring complex reconnection and state recovery logic.

## The Economics of the Forge

The forge reshapes not just how work gets done, but what it costs. The numbers emerging from production deployments are striking.

Agent execution costs range from $0.03 to $0.25 per minute, depending on the model and task complexity. A senior software engineer costs $3 to $6.50 per minute in loaded compensation. That is a 15-100x cost differential. Devin, the autonomous coding agent, reported a 67% merge rate on its tasks and reached $73M in annual recurring revenue — demonstrating market validation for paid agent execution at scale. Y Combinator's Winter 2025 batch included startups where 25% of companies reported that 95% of their code was AI-generated.

These cost differentials are not static — they are accelerating. Hundreds of billions of dollars in datacenter investment are expanding global compute capacity while driving down the marginal cost of inference. Algorithmic efficiency gains — roughly half an order of magnitude per year, according to Aschenbrenner's analysis of the GPT-2-to-GPT-4 trajectory — mean that each dollar of compute buys more capable agent-minutes than the year before. The Ralph Wiggum loop that completed a $50,000 contract for $297 in API costs will be cheaper and more capable next year. For practitioners making infrastructure investments today, this means the economic case for agent execution strengthens on a predictable curve. The forge you build now will run more work, at higher quality, for less money, with each generation of models.

But the economics are not uniformly positive. A study of open-source projects using AI agents found that while PR volume increased by 98%, review times increased by 91%. The forge can produce work faster than the review pipeline can consume it. This is the new bottleneck: not generation, but verification. Not writing code, but reading it.

> [!case-study]
> **Devin and the Verification Gap**
> Devin's 67% merge rate sounds impressive until you ask: what happens to the other 33%? Those rejected PRs still consumed reviewer attention. They still created notification noise. They still occupied space in the review queue. At scale — hundreds of PRs per week — the rejected fraction becomes a significant burden. This is the verification gap: the delta between what agents can produce and what humans can validate. `ainative-business`'s approach to this gap is twofold. First, structured logging: every tool call, every file read, every decision is recorded in `agent_logs`, creating a reviewable audit trail. Second, profile-based constraints: by limiting what each agent can do (a code-reviewer cannot write code, a researcher cannot modify files), we reduce the surface area of each review. A PR from a tightly constrained agent is easier to verify than one from an unconstrained agent.

## ainative Today

The forge is operational. Here is the current state:

**Execution Manager**: The core execution pipeline in `src/lib/agents/execution-manager.ts` handles task dispatch, agent spawning, log collection, and result recording. It supports all five runtimes with a unified dispatch interface.

**Claude Code SDK Integration**: The primary runtime uses `@anthropic-ai/claude-agent-sdk` with subprocess spawning. The SDK environment is carefully isolated — we strip `ANTHROPIC_API_KEY` from the subprocess environment when running in OAuth mode to avoid burning paid API credits instead of using Max subscription tokens. This was a hard-won lesson documented in our project memory.

**SSE Log Streaming**: Real-time log streaming via Server-Sent Events on `GET /api/tasks/[id]/logs`. The endpoint uses a ReadableStream with a poll loop against the `agent_logs` table. Clients receive structured log entries as they are written.

**Profile Registry**: Twenty built-in profiles spanning technical and business domains. The registry in `src/lib/agents/profiles/` provides type-safe profile loading, validation, and test execution. Profiles declare supported runtimes, tool policies, and behavioral smoke tests.

**Tool Permission Persistence**: The "Always Allow" button persists tool approval decisions to the settings table. A permission pre-check runs before each tool call, checking for stored approvals before falling back to the notification-based human approval flow.

**Agent Logs Table**: Every execution writes structured logs — tool calls with arguments, model responses, errors, and final results. The logs table is the forge's black box recorder, enabling post-execution review and debugging.

**Profile Environment Sync**: The forge now extends beyond manually curated profiles. An opt-in auto-promote feature scans the local environment — specifically skills discovered in `~/.claude/skills/` — and automatically promotes them into the profile registry. This closes a gap where useful skills existed on disk but were invisible to the routing and dispatch system. The environment scanner feeds the forge without manual intervention, so new capabilities surface as soon as they are installed rather than waiting for a human to wire them in.

## Roadmap Vision

The forge today handles task-at-a-time execution. The roadmap extends it toward continuous, autonomous operation:

**Persistent Agent Sessions**: Today, each task execution spawns a fresh agent process. The agent reads the codebase, builds context, executes, and terminates. For sequences of related tasks, this cold-start overhead is wasteful. Persistent sessions would keep an agent alive across multiple tasks, maintaining codebase understanding and reducing redundant file reads.

**Sandbox Environments**: Production codebases deserve production-grade isolation. Sandboxed execution environments — containers, VMs, or lightweight namespaces — would let agents run with real filesystem access but without the ability to affect the host system. This is particularly important for auto-approved tool policies where agents write code without human review of each file operation.

**Execution Budgets**: Hard limits on per-task resource consumption — token count, wall-clock time, API cost. When the budget is exhausted, the agent must produce whatever result it has, even if incomplete. This prevents runaway sessions and makes cost predictable.

**Result Quality Scoring**: Automated evaluation of agent outputs against task acceptance criteria. Did the PR pass CI? Do the tests cover the requirements? Does the code match the project's style? Quality scores feed back into profile selection, creating a learning loop where the system routes tasks to profiles that produce the best results for that task type.

The forge's ultimate trajectory is toward a system where dispatching work to an agent feels no different from assigning it to a teammate — fire and forget, with confidence that the work will get done, that problems will surface quickly, and that the cost is predictable. We are not there yet. But the foundation is in place, and the path is clear.
