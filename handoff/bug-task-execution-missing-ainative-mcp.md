---
title: "Bug: Task/Schedule Execution Missing ainative MCP Server"
audience: ainative-base
status: proposed
source_branch: wealth-mgr
handoff_reason: The in-process ainative MCP server is only wired into the chat engine, not the task/workflow execution path. This causes intermittent "No ainative table MCP tools available" errors during scheduled and manual task execution.
---

# Bug: Task/Schedule Execution Missing ainative MCP Server

## Summary

Agents running via task execution (`executeClaudeTask`) and workflow step execution (`resumeClaudeTask`) have **no access to ainative MCP tools** (tables, notifications, etc.). The in-process ainative MCP server is created and injected only in the chat engine path, but completely absent from the task execution path.

This causes schedule-fired agents (News Sentinel, Price Monitor, etc.) to fail silently on any step that requires `mcp__stagent__*` tools — they report "No ainative table MCP tools are available in this session" and skip table operations entirely.

## Root Cause

### Chat engine (works) — `src/lib/chat/engine.ts` lines 278–314

```typescript
// Creates in-process MCP server ✅
const stagentServer = createStagentMcpServer(conversation.projectId, ...);

// Injects it alongside browser + external servers ✅
mcpServers: { ainative: stagentServer, ...browserServers, ...externalServers },
allowedTools: ["mcp__stagent__*", ...browserToolPatterns, ...externalToolPatterns],
```

### Task execution (broken) — `src/lib/agents/claude-agent.ts` lines 487–514

```typescript
// Only merges profile + browser + external servers ❌ No ainative server
const profileMcpServers = ctx.payload?.mcpServers ?? {};
const mergedMcpServers = { ...profileMcpServers, ...browserServers, ...externalServers };

// No ainative server in the merge ❌
mcpServers: mergedMcpServers,
// No mcp__stagent__* in allowedTools ❌
...(ctx.payload?.allowedTools && { allowedTools: ctx.payload.allowedTools }),
```

The same gap exists in `resumeClaudeTask` (lines 606–633) which handles workflow step execution and session resumption.

## Why It Appears Intermittent

The `claude_code` preset gives the agent access to Claude Code's built-in tools (Bash, Read, Write, etc.). When `cwd` is set to the workspace directory, the agent may occasionally discover MCP servers through Claude Code's own config discovery (e.g., if a user-level `~/.claude/.mcp.json` happens to include relevant servers, or if the runtime environment varies between firings). But the ainative server is never in those external configs — it's an in-process server that must be explicitly created and injected.

## Affected Code Paths

| Path | File | Lines | Status |
|------|------|-------|--------|
| Chat streaming | `src/lib/chat/engine.ts` | 278–314 | ✅ Has ainative MCP |
| Task execution | `src/lib/agents/claude-agent.ts` | `executeClaudeTask` ~487–514 | ❌ Missing |
| Task resume | `src/lib/agents/claude-agent.ts` | `resumeClaudeTask` ~606–633 | ❌ Missing |
| OpenAI direct | `src/lib/agents/runtime/openai-direct.ts` | Uses `createToolServer` | ✅ Has ainative tools |
| Anthropic direct | `src/lib/agents/runtime/anthropic-direct.ts` | Uses `createToolServer` | ✅ Has ainative tools |

Note: The OpenAI and Anthropic direct runtimes already use `createToolServer()` to inject ainative tools. Only the `claude-code` runtime (Claude Agent SDK) path is missing it.

## Proposed Fix

### 1. Inject ainative MCP server in `executeClaudeTask`

In `src/lib/agents/claude-agent.ts`, after the browser/external MCP merge (~line 492), create and inject the ainative MCP server the same way the chat engine does:

```typescript
// NEW: Create in-process ainative MCP server for table/CRUD access
const stagentServer = createStagentMcpServer(task.projectId);

const profileMcpServers = ctx.payload?.mcpServers ?? {};
const mergedMcpServers = {
  ainative: stagentServer,  // ← inject ainative server
  ...profileMcpServers,
  ...browserServers,
  ...externalServers,
};
```

### 2. Same fix in `resumeClaudeTask`

Apply the identical pattern in the resume path (~line 611).

### 3. Add `mcp__stagent__*` to allowedTools

The chat engine explicitly allows `mcp__stagent__*` in its `allowedTools`. The task execution path should do the same — either:
- Always include `"mcp__stagent__*"` in the allowed tools array, OR
- Merge it with profile-defined `allowedTools` so profiles can still restrict tool access

Suggested approach:

```typescript
const baseAllowedTools = ["mcp__stagent__*"];
const profileAllowedTools = ctx.payload?.allowedTools ?? [];
const allowedTools = [...baseAllowedTools, ...profileAllowedTools];
```

### 4. Wire canUseTool permission gating

The chat engine gates dangerous ainative tools (`execute_task`, `delete_workflow`, etc.) through `canUseTool`. The task execution path should apply the same permission set so that an agent running a schedule can't recursively execute tasks without approval. The existing `handleToolPermission` function is already in place — just ensure the ainative tool names are included in its policy.

## Impact

- **All schedules** that reference `mcp__stagent__*` tools in their prompts (News Sentinel, Price Monitor, Daily Briefing, etc.) will gain reliable table access
- **Workflow steps** that need to read/write tables will work consistently
- **No breaking changes** — this adds capabilities that were always intended but never wired

## Testing

1. Fire a schedule that reads a table (e.g., News Sentinel with divergence check)
2. Verify the agent can access `mcp__stagent__query_table`, `mcp__stagent__add_rows`, etc.
3. Verify permission-gated tools (e.g., `execute_task`) still require approval
4. Verify existing chat engine behavior is unchanged
5. Run existing `claude-agent.test.ts` tests — they should still pass since the mock structure is the same

## Related

- `src/lib/chat/ainative-tools.ts` — `createStagentMcpServer()` factory (already exists, just needs to be called)
- `src/lib/chat/engine.ts` — reference implementation of correct MCP injection
- Handoff: `table-enrich-context-approval-noise.md` — related MCP tool access during enrichment
