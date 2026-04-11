---
title: Task Runtime Stagent MCP Injection
status: planned
priority: P0
milestone: post-mvp
source: handoff/bug-task-execution-missing-stagent-mcp.md
dependencies: [agent-integration, chat-engine]
---

# Task Runtime Stagent MCP Injection

## Description

Wire the in-process stagent MCP server into the Claude Agent SDK runtime entry points (`executeClaudeTask` and `resumeClaudeTask`) so that scheduled and manual task executions have reliable access to `mcp__stagent__*` tools — tables, notifications, row CRUD, and everything else the stagent tool registry exposes.

Today, only the chat engine injects `createStagentMcpServer` into its agent session. The `openai-direct` and `anthropic-direct` runtimes inject the equivalent `createToolServer()` directly. The `claude-code` runtime path — which is what schedules and manual task runs actually hit — skips the injection entirely, relying on profile-defined `mcpServers`/`allowedTools`. Because profiles don't (and shouldn't) hard-code stagent, scheduled agents silently report "No stagent table MCP tools are available in this session" on any step that needs table access. The News Sentinel, Price Monitor, and Daily Briefing schedules have all hit this in production.

This is a wiring gap, not a design question. The server factory, the permission gate, and the reference implementation all already exist — they just need to be called from two more sites.

## User Story

As a Stagent operator running a scheduled agent that reads or writes tables (News Sentinel, Price Monitor, Daily Briefing), I want the agent to reliably access stagent table tools so that my scheduled runs don't silently skip table operations with "No stagent table MCP tools are available."

## Technical Approach

- **Inject at executeClaudeTask.** In `src/lib/agents/claude-agent.ts` at the MCP merge point (~line 492), call `createStagentMcpServer(task.projectId)` from `src/lib/chat/stagent-tools.ts` and merge it into `mergedMcpServers` under the `stagent` key, ahead of profile/browser/external servers:
  ```ts
  const stagentServer = createStagentMcpServer(task.projectId);
  const profileMcpServers = ctx.payload?.mcpServers ?? {};
  const mergedMcpServers = {
    stagent: stagentServer,
    ...profileMcpServers,
    ...browserServers,
    ...externalServers,
  };
  ```
- **Inject at resumeClaudeTask.** Apply the same injection in `resumeClaudeTask` (~line 611). Workflow step execution and session resumption go through this path.
- **Conditionally merge `mcp__stagent__*` into `allowedTools`.** The current code at `claude-agent.ts:511` only passes `allowedTools` to the SDK when the profile set one: `...(ctx.payload?.allowedTools && { allowedTools: ctx.payload.allowedTools })`. Profiles without an explicit allowlist rely on the `claude_code` preset's default tool surface (Bash/Read/Write/etc.) — unconditionally passing `allowedTools: ["mcp__stagent__*"]` would restrict them to ONLY stagent and break the preset. The correct behavior:
  ```ts
  const profileAllowedTools = ctx.payload?.allowedTools;
  const allowedTools = profileAllowedTools
    ? ["mcp__stagent__*", ...profileAllowedTools]
    : undefined; // fall through to preset defaults
  ```
  When the profile has no allowlist, the SDK still surfaces stagent tools because they are registered via `mcpServers.stagent`. When the profile has an allowlist, we merge stagent in so the profile doesn't accidentally strip it.
- **Permission gating is already correct and does not need changes.** The task path already routes `canUseTool` through `handleToolPermission(taskId, toolName, input, ctx.canUseToolPolicy)` at both `claude-agent.ts:520` and `:640`. Its permission model is per-profile `autoApprove`/`autoDeny` plus saved user patterns plus notification-based approval — any stagent tool not explicitly auto-approved by a profile will fall through to "create notification and wait," which is the safe default. The chat engine's inline `PERMISSION_GATED_TOOLS` switch is a chat-specific shortcut and must NOT be ported — the per-profile policy is the right model for task execution.
- **No schema changes, no DB migration, no frontend changes.** This is pure runtime wiring.

## Acceptance Criteria

- [ ] `executeClaudeTask` calls `createStagentMcpServer(task.projectId)` and includes it in `mergedMcpServers` under the `stagent` key.
- [ ] `resumeClaudeTask` does the same.
- [ ] When the profile has an explicit `allowedTools`, `mcp__stagent__*` is prepended so stagent tools survive the filter.
- [ ] When the profile has no `allowedTools`, the SDK option is still omitted (preset defaults preserved) and stagent tools are reachable via `mcpServers` registration.
- [ ] Permission-gated stagent tools (`execute_task`, `delete_workflow`) still route through `handleToolPermission` via the existing per-profile `canUseToolPolicy` — a profile that does not auto-approve them creates an approval notification.
- [ ] Existing `src/lib/agents/__tests__/claude-agent.test.ts` tests still pass.
- [ ] New unit tests assert that the SDK `query` call receives `mcpServers.stagent` on both `executeClaudeTask` and `resumeClaudeTask`, and that `allowedTools` prepends `mcp__stagent__*` only when the profile provided its own allowlist.
- [ ] Chat engine behavior is unchanged (no edits to `src/lib/chat/engine.ts`).

## Scope Boundaries

**Included:**
- Claude-code runtime injection at `executeClaudeTask` and `resumeClaudeTask`
- `mcp__stagent__*` allowedTools merge (conditional on profile already setting an allowlist)
- Test coverage asserting the wiring is present on both paths

**Excluded:**
- Refactoring the stagent tool registry itself
- Adding new stagent tools
- Lifting `PERMISSION_GATED_TOOLS` out of `src/lib/chat/engine.ts` into a shared constant — the task path already has the correct (per-profile) permission model and should not be retrofitted with the chat engine's inline switch
- Rewiring the `openai-direct` / `anthropic-direct` runtimes (they already inject stagent tools via `createToolServer`)
- Adding wildcard support to `canUseToolPolicy.autoApprove` (separate follow-up if profiles need to auto-approve groups of stagent tools)

## References

- Source: `handoff/bug-task-execution-missing-stagent-mcp.md`
- `src/lib/chat/engine.ts:280-315` — reference implementation (chat engine MCP injection)
- `src/lib/chat/stagent-tools.ts:70-133` — `createToolServer` / `createStagentMcpServer` factories
- `src/lib/agents/claude-agent.ts:492-513` — `executeClaudeTask` MCP merge point (current, broken)
- `src/lib/agents/claude-agent.ts:606-633` — `resumeClaudeTask` MCP merge point (current, broken)
- `src/lib/agents/runtime/openai-direct.ts:19`, `src/lib/agents/runtime/anthropic-direct.ts:18` — parity runtimes that already do this
- Related features: `chat-engine.md`, `agent-integration.md`, `scheduled-prompt-loops.md`
- **TDR follow-up:** once this ships, propose a new `agent-system` TDR — "All runtime entry points must inject the in-process stagent MCP server and `mcp__stagent__*` allowlist consistently" — to codify the pattern and prevent regression in future runtime additions.
