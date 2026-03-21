# Use Claude Code features in the SDK

Load project instructions, skills, hooks, and other Claude Code features into your SDK agents.

---

The Agent SDK is built on the same foundation as Claude Code, which means your SDK agents have access to the same filesystem-based features: project instructions (`CLAUDE.md` and rules), skills, hooks, and more.

By default, the SDK loads no filesystem settings. Your agent runs in isolation mode with only what you pass programmatically. To load CLAUDE.md, skills, or filesystem hooks, set `settingSources` to tell the SDK where to look.

## Enable Claude Code features with settingSources

The setting sources option (`setting_sources` in Python, `settingSources` in TypeScript) controls which filesystem-based settings the SDK loads.

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage

async for message in query(
    prompt="Help me refactor the auth module",
    options=ClaudeAgentOptions(
        setting_sources=["user", "project"],
        allowed_tools=["Read", "Edit", "Bash"],
    ),
):
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if hasattr(block, "text"):
                print(block.text)
    if isinstance(message, ResultMessage) and message.subtype == "success":
        print(f"\nResult: {message.result}")
```

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Help me refactor the auth module",
  options: {
    settingSources: ["user", "project"],
    allowedTools: ["Read", "Edit", "Bash"]
  }
})) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") console.log(block.text);
    }
  }
  if (message.type === "result" && message.subtype === "success") {
    console.log(`\nResult: ${message.result}`);
  }
}
```

| Source | What it loads | Location |
|:-------|:-------------|:---------|
| `"project"` | Project CLAUDE.md, `.claude/rules/*.md`, project skills, project hooks, project `settings.json` | `<cwd>/.claude/` and each parent directory up to the filesystem root |
| `"user"` | User CLAUDE.md, `~/.claude/rules/*.md`, user skills, user settings | `~/.claude/` |
| `"local"` | CLAUDE.local.md (gitignored), `.claude/settings.local.json` | `<cwd>/` |

To match the full Claude Code CLI behavior, use `["user", "project", "local"]`.

> **Note:** The `cwd` option determines where the SDK looks for project settings. Auto memory (`~/.claude/projects//memory/`) is a CLI-only feature and is never loaded by the SDK.

## Project instructions (CLAUDE.md and rules)

`CLAUDE.md` files and `.claude/rules/*.md` files give your agent persistent context about your project.

### CLAUDE.md load locations

| Level | Location | When loaded |
|:------|:---------|:------------|
| Project (root) | `<cwd>/CLAUDE.md` or `<cwd>/.claude/CLAUDE.md` | `settingSources` includes `"project"` |
| Project rules | `<cwd>/.claude/rules/*.md` | `settingSources` includes `"project"` |
| Project (parent dirs) | `CLAUDE.md` files in directories above `cwd` | `settingSources` includes `"project"`, loaded at session start |
| Project (child dirs) | `CLAUDE.md` files in subdirectories of `cwd` | `settingSources` includes `"project"`, loaded on demand |
| Local (gitignored) | `<cwd>/CLAUDE.local.md` | `settingSources` includes `"local"` |
| User | `~/.claude/CLAUDE.md` | `settingSources` includes `"user"` |
| User rules | `~/.claude/rules/*.md` | `settingSources` includes `"user"` |

All levels are additive. You can also inject context directly via `systemPrompt` without using CLAUDE.md files.

## Skills

Skills are markdown files that give your agent specialized knowledge and invocable workflows. Unlike `CLAUDE.md` (which loads every session), skills load on demand.

```python
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

async for message in query(
    prompt="Review this PR using our code review checklist",
    options=ClaudeAgentOptions(
        setting_sources=["user", "project"],
        allowed_tools=["Skill", "Read", "Grep", "Glob"],
    ),
):
    if isinstance(message, ResultMessage) and message.subtype == "success":
        print(message.result)
```

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Review this PR using our code review checklist",
  options: {
    settingSources: ["user", "project"],
    allowedTools: ["Skill", "Read", "Grep", "Glob"]
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

Skills must be created as filesystem artifacts (`.claude/skills/<name>/SKILL.md`).

## Hooks

The SDK supports two ways to define hooks:

- **Filesystem hooks:** shell commands defined in `settings.json`, loaded when `settingSources` includes the relevant source.
- **Programmatic hooks:** callback functions passed directly to `query()`.

```python
from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher, ResultMessage

async def audit_bash(input_data, tool_use_id, context):
    command = input_data.get("tool_input", {}).get("command", "")
    if "rm -rf" in command:
        return {"decision": "block", "reason": "Destructive command blocked"}
    return {}

async for message in query(
    prompt="Refactor the auth module",
    options=ClaudeAgentOptions(
        setting_sources=["project"],
        hooks={
            "PreToolUse": [
                HookMatcher(matcher="Bash", hooks=[audit_bash]),
            ]
        },
    ),
):
    if isinstance(message, ResultMessage) and message.subtype == "success":
        print(message.result)
```

```typescript
import { query, type HookInput, type HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";

const auditBash = async (input: HookInput): Promise<HookJSONOutput> => {
  if (input.hook_event_name !== "PreToolUse") return {};
  const toolInput = input.tool_input as { command?: string };
  if (toolInput.command?.includes("rm -rf")) {
    return { decision: "block", reason: "Destructive command blocked" };
  }
  return {};
};

for await (const message of query({
  prompt: "Refactor the auth module",
  options: {
    settingSources: ["project"],
    hooks: {
      PreToolUse: [{ matcher: "Bash", hooks: [auditBash] }]
    }
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

### When to use which hook type

| Hook type | Best for |
|:----------|:---------|
| **Filesystem** (`settings.json`) | Sharing hooks between CLI and SDK sessions. Fires in main agent and subagents. |
| **Programmatic** (callbacks in `query()`) | Application-specific logic; returning structured decisions. Scoped to main session only. |

## Choose the right feature

| You want to... | Use | SDK surface |
|:----------------|:----|:------------|
| Set project conventions your agent always follows | CLAUDE.md | `settingSources: ["project"]` |
| Give the agent reference material it loads when relevant | Skills | `settingSources` + `allowedTools: ["Skill"]` |
| Run a reusable workflow (deploy, review, release) | User-invocable skills | `settingSources` + `allowedTools: ["Skill"]` |
| Delegate an isolated subtask to a fresh context | Subagents | `agents` parameter + `allowedTools: ["Agent"]` |
| Run deterministic logic on tool calls | Hooks | `hooks` parameter with callbacks, or shell scripts via `settingSources` |
| Give Claude structured tool access to an external service | MCP | `mcpServers` parameter |
