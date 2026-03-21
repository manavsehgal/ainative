# How the agent loop works

Understand the message lifecycle, tool execution, context window, and architecture that power your SDK agents.

---

The Agent SDK lets you embed Claude Code's autonomous agent loop in your own applications. The SDK is a standalone package that gives you programmatic control over tools, permissions, cost limits, and output. You don't need the Claude Code CLI installed to use it.

When you start an agent, the SDK runs the same execution loop that powers Claude Code: Claude evaluates your prompt, calls tools to take action, receives the results, and repeats until the task is complete. This page explains what happens inside that loop so you can build, debug, and optimize your agents effectively.

## The loop at a glance

Every agent session follows the same cycle:

1. **Receive prompt.** Claude receives your prompt, along with the system prompt, tool definitions, and conversation history. The SDK yields a `SystemMessage` with subtype `"init"` containing session metadata.
2. **Evaluate and respond.** Claude evaluates the current state and determines how to proceed. It may respond with text, request one or more tool calls, or both. The SDK yields an `AssistantMessage` containing the text and any tool call requests.
3. **Execute tools.** The SDK runs each requested tool and collects the results. Each set of tool results feeds back to Claude for the next decision. You can use hooks to intercept, modify, or block tool calls before they run.
4. **Repeat.** Steps 2 and 3 repeat as a cycle. Each full cycle is one turn. Claude continues calling tools and processing results until it produces a response with no tool calls.
5. **Return result.** The SDK yields a final `AssistantMessage` with the text response (no tool calls), followed by a `ResultMessage` with the final text, token usage, cost, and session ID.

## Turns and messages

A turn is one round trip inside the loop: Claude produces output that includes tool calls, the SDK executes those tools, and the results feed back to Claude automatically. This happens without yielding control back to your code. Turns continue until Claude produces output with no tool calls, at which point the loop ends and the final result is delivered.

Consider what a full session might look like for the prompt "Fix the failing tests in auth.ts".

1. **Turn 1:** Claude calls `Bash` to run `npm test`. The SDK yields an `AssistantMessage` with the tool call, executes the command, then yields a `UserMessage` with the output (three failures).
2. **Turn 2:** Claude calls `Read` on `auth.ts` and `auth.test.ts`. The SDK returns the file contents and yields an `AssistantMessage`.
3. **Turn 3:** Claude calls `Edit` to fix `auth.ts`, then calls `Bash` to re-run `npm test`. All three tests pass. The SDK yields an `AssistantMessage`.
4. **Final turn:** Claude produces a text-only response with no tool calls: "Fixed the auth bug, all three tests pass now." The SDK yields a final `AssistantMessage` with this text, then a `ResultMessage` with the same text plus cost and usage.

You can cap the loop with `max_turns` / `maxTurns`, which counts tool-use turns only. You can also use `max_budget_usd` / `maxBudgetUsd` to cap turns based on a spend threshold.

## Message types

As the loop runs, the SDK yields a stream of messages. The five core types are:

- **`SystemMessage`:** session lifecycle events. The `subtype` field distinguishes them: `"init"` is the first message (session metadata), and `"compact_boundary"` fires after compaction.
- **`AssistantMessage`:** emitted after each Claude response, including the final text-only one. Contains text content blocks and tool call blocks from that turn.
- **`UserMessage`:** emitted after each tool execution with the tool result content sent back to Claude. Also emitted for any user inputs you stream mid-loop.
- **`StreamEvent`:** only emitted when partial messages are enabled. Contains raw API streaming events (text deltas, tool input chunks).
- **`ResultMessage`:** the last message, always. Contains the final text result, token usage, cost, and session ID.

### Handle messages

```python
from claude_agent_sdk import query, AssistantMessage, ResultMessage

async for message in query(prompt="Summarize this project"):
    if isinstance(message, AssistantMessage):
        print(f"Turn completed: {len(message.content)} content blocks")
    if isinstance(message, ResultMessage):
        if message.subtype == "success":
            print(message.result)
        else:
            print(f"Stopped: {message.subtype}")
```

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({ prompt: "Summarize this project" })) {
  if (message.type === "assistant") {
    console.log(`Turn completed: ${message.message.content.length} content blocks`);
  }
  if (message.type === "result") {
    if (message.subtype === "success") {
      console.log(message.result);
    } else {
      console.log(`Stopped: ${message.subtype}`);
    }
  }
}
```

## Tool execution

Tools give your agent the ability to take action.

### Built-in tools

| Category | Tools | What they do |
|:---------|:------|:-------------|
| **File operations** | `Read`, `Edit`, `Write` | Read, modify, and create files |
| **Search** | `Glob`, `Grep` | Find files by pattern, search content with regex |
| **Execution** | `Bash` | Run shell commands, scripts, git operations |
| **Web** | `WebSearch`, `WebFetch` | Search the web, fetch and parse pages |
| **Discovery** | `ToolSearch` | Dynamically find and load tools on-demand |
| **Orchestration** | `Agent`, `Skill`, `AskUserQuestion`, `TodoWrite` | Spawn subagents, invoke skills, ask the user, track tasks |

Beyond built-in tools, you can:

- **Connect external services** with MCP servers (databases, browsers, APIs)
- **Define custom tools** with custom tool handlers
- **Load project skills** via setting sources for reusable workflows

### Tool permissions

- **`allowed_tools` / `allowedTools`** auto-approves listed tools.
- **`disallowed_tools` / `disallowedTools`** blocks listed tools, regardless of other settings.
- **`permission_mode` / `permissionMode`** controls what happens to tools that aren't covered by allow or deny rules.

You can scope individual tools with rules like `"Bash(npm:*)"` to allow only specific commands.

### Parallel tool execution

Read-only tools (`Read`, `Glob`, `Grep`, and MCP tools marked as read-only) can run concurrently. Tools that modify state (`Edit`, `Write`, `Bash`) run sequentially to avoid conflicts.

## Control how the loop runs

### Turns and budget

| Option | What it controls | Default |
|:-------|:----------------|:--------|
| Max turns (`max_turns` / `maxTurns`) | Maximum tool-use round trips | No limit |
| Max budget (`max_budget_usd` / `maxBudgetUsd`) | Maximum cost before stopping | No limit |

### Effort level

| Level | Behavior | Good for |
|:------|:---------|:---------|
| `"low"` | Minimal reasoning, fast responses | File lookups, listing directories |
| `"medium"` | Balanced reasoning | Routine edits, standard tasks |
| `"high"` | Thorough analysis | Refactors, debugging |
| `"max"` | Maximum reasoning depth | Multi-step problems requiring deep analysis |

### Permission mode

| Mode | Behavior |
|:-----|:---------|
| `"default"` | Tools not covered by allow rules trigger your approval callback |
| `"acceptEdits"` | Auto-approves file edits, other tools follow default rules |
| `"plan"` | No tool execution; Claude produces a plan for review |
| `"dontAsk"` (TypeScript only) | Never prompts. Pre-approved tools run, everything else denied |
| `"bypassPermissions"` | Runs all allowed tools without asking. Use only in isolated environments |

### Model

Set `model` explicitly (e.g., `model="claude-sonnet-4-6"`) to pin a specific model.

## The context window

Everything accumulates: the system prompt, tool definitions, conversation history, tool inputs, and tool outputs. Content that stays the same across turns is automatically prompt cached.

### What consumes context

| Source | When it loads | Impact |
|:-------|:-------------|:-------|
| **System prompt** | Every request | Small fixed cost |
| **CLAUDE.md files** | Session start | Full content in every request (prompt-cached) |
| **Tool definitions** | Every request | Each tool adds its schema |
| **Conversation history** | Accumulates over turns | Grows with each turn |
| **Skill descriptions** | Session start | Short summaries; full content loads only when invoked |

### Automatic compaction

When the context window approaches its limit, the SDK automatically compacts the conversation by summarizing older history. The SDK emits a `SystemMessage` with subtype `"compact_boundary"` when this happens.

Persistent rules belong in CLAUDE.md rather than in the initial prompt, because CLAUDE.md content is re-injected on every request.

### Keep context efficient

- **Use subagents for subtasks.** Each subagent starts with a fresh conversation.
- **Be selective with tools.** Use `ToolSearch` to load tools on demand.
- **Watch MCP server costs.** Each MCP server adds all its tool schemas to every request.
- **Use lower effort for routine tasks.**

## Sessions and continuity

Capture the session ID from `ResultMessage.session_id` to resume later. When you resume, the full context from previous turns is restored.

## Handle the result

| Result subtype | What happened | `result` field available? |
|:------------|:-------------|:-------------------------:|
| `success` | Claude finished the task normally | Yes |
| `error_max_turns` | Hit the `maxTurns` limit | No |
| `error_max_budget_usd` | Hit the `maxBudgetUsd` limit | No |
| `error_during_execution` | An error interrupted the loop | No |
| `error_max_structured_output_retries` | Structured output validation failed after retries | No |

All result subtypes carry `total_cost_usd`, `usage`, `num_turns`, and `session_id`.

## Hooks

| Hook | When it fires | Common uses |
|:-----|:-------------|:------------|
| `PreToolUse` | Before a tool executes | Validate inputs, block dangerous commands |
| `PostToolUse` | After a tool returns | Audit outputs, trigger side effects |
| `UserPromptSubmit` | When a prompt is sent | Inject additional context into prompts |
| `Stop` | When the agent finishes | Validate the result, save session state |
| `SubagentStart` / `SubagentStop` | When a subagent spawns or completes | Track parallel task results |
| `PreCompact` | Before context compaction | Archive full transcript |

## Full example

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

async def run_agent():
    session_id = None
    async for message in query(
        prompt="Find and fix the bug causing test failures in the auth module",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],
            setting_sources=["project"],
            max_turns=30,
            effort="high",
        ),
    ):
        if isinstance(message, ResultMessage):
            session_id = message.session_id
            if message.subtype == "success":
                print(f"Done: {message.result}")
            elif message.subtype == "error_max_turns":
                print(f"Hit turn limit. Resume session {session_id} to continue.")
            elif message.subtype == "error_max_budget_usd":
                print("Hit budget limit.")
            else:
                print(f"Stopped: {message.subtype}")
            if message.total_cost_usd is not None:
                print(f"Cost: ${message.total_cost_usd:.4f}")

asyncio.run(run_agent())
```

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

let sessionId: string | undefined;
for await (const message of query({
  prompt: "Find and fix the bug causing test failures in the auth module",
  options: {
    allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep"],
    settingSources: ["project"],
    maxTurns: 30,
    effort: "high"
  }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
  if (message.type === "result") {
    if (message.subtype === "success") {
      console.log(`Done: ${message.result}`);
    } else if (message.subtype === "error_max_turns") {
      console.log(`Hit turn limit. Resume session ${sessionId} to continue.`);
    }
    console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
  }
}
```

## Next steps

- [Quickstart](/docs/en/agent-sdk/quickstart) — get the SDK installed and running
- [Use Claude Code features](/docs/en/agent-sdk/claude-code-features) — load CLAUDE.md, skills, and hooks
- [Streaming](/docs/en/agent-sdk/streaming-output) — show live text and tool calls
- [Permissions](/docs/en/agent-sdk/permissions) — lock down tool access
- [Subagents](/docs/en/agent-sdk/subagents) — offload isolated work
