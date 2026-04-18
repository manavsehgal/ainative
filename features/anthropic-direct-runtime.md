---
title: Anthropic Direct Runtime
status: completed
priority: P1
milestone: post-mvp
source: ideas/direct-api-gap-analysis.md
dependencies: [provider-agnostic-tool-layer, provider-runtime-abstraction, cross-provider-profile-compatibility]
---

# Anthropic Direct Runtime

## Description

Add `anthropic-direct` as a third runtime in ainative's catalog. This runtime calls the Anthropic Messages API directly via `@anthropic-ai/sdk` instead of spawning a Claude Code subprocess. It provides sub-second first-token latency, access to prompt caching, extended thinking, server-side tools (web search, code execution, text editor), and works anywhere with just an API key — no Claude Code CLI required.

The existing `claude-code` runtime remains fully supported. Users choose per-task or per-profile which runtime to use. The `anthropic-direct` runtime is ideal for tasks that don't need file system tools, cost-sensitive workloads, and serverless/containerized deployments.

## User Story

As a ainative user, I want to run tasks via the Anthropic Messages API directly so that I get faster response times, lower costs through prompt caching, and don't need Claude Code CLI installed.

## Technical Approach

### New Files

- `src/lib/agents/runtime/anthropic-direct.ts` (~585 lines) — Implements `AgentRuntimeAdapter` interface
- `src/lib/agents/agentic-loop.ts` (~200 lines) — Shared agentic loop logic reusable by both direct runtimes

### Agentic Loop Implementation

The core loop follows the standard pattern:
1. Call `messages.create()` with system prompt, messages, tools, and `stream: true`
2. Process streaming events → map to ainative SSE event types (delta, status, done, error)
3. Check `stop_reason`:
   - `"end_turn"` → task complete, extract final response
   - `"tool_use"` → for each tool_use block:
     a. Call `handleToolPermission()` (existing HITL logic, reused as-is)
     b. If approved, execute tool handler from tool registry
     c. Append `tool_result` content block to messages
     d. Loop back to step 1
   - `"max_tokens"` → continue with follow-up call
4. Enforce `maxTurns` counter and `maxBudgetUsd` via usage tracking after each API call
5. Support `AbortController` for task cancellation

### Session Resume

- Serialize the full `messages` array (including all `tool_use`/`tool_result` pairs) to the `agent_logs` table after each turn
- On resume: reconstruct messages array from stored logs, call API with full conversation history
- No filesystem dependency — sessions survive process crashes and are portable

### Streaming Event Mapping

| Anthropic SSE Event | ainative Event |
|---------------------|---------------|
| `message_start` | `{ type: "status", phase: "running" }` |
| `content_block_delta` (text) | `{ type: "delta", content }` |
| `content_block_delta` (tool_use input) | `{ type: "status", phase: "tool_use" }` |
| `message_delta` (stop_reason) | `{ type: "done" }` or loop continues |
| Error | `{ type: "error", message }` |

### Capabilities Declaration

```typescript
{
  id: "anthropic-direct",
  label: "Anthropic Direct API",
  description: "Direct Anthropic Messages API — fast, cost-optimized, no CLI required.",
  providerId: "anthropic",
  capabilities: {
    resume: true,
    cancel: true,
    approvals: true,
    mcpServers: true,     // Via MCP connector
    profileTests: true,
    taskAssist: true,
    profileAssist: true,
    authHealthCheck: true
  }
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/agents/runtime/anthropic-direct.ts` | **New** — adapter implementation |
| `src/lib/agents/agentic-loop.ts` | **New** — shared loop logic |
| `src/lib/agents/runtime/catalog.ts` | Add `anthropic-direct` to catalog and `SUPPORTED_AGENT_RUNTIMES` |
| `src/lib/agents/runtime/index.ts` | Register adapter in `runtimeRegistry` |
| `src/lib/agents/profiles/builtins/*/profile.yaml` | Add `anthropic-direct` to `supportedRuntimes` arrays |
| `package.json` | Add `@anthropic-ai/sdk` dependency |

### Auth

- Uses `ANTHROPIC_API_KEY` from ainative settings (existing `getAuthEnv()` already supports this)
- `testConnection()` calls `GET /v1/models` to validate the key

## Acceptance Criteria

- [ ] `anthropic-direct` appears in the runtime catalog and settings UI runtime dropdown
- [ ] Tasks execute successfully via Anthropic Messages API with streaming output
- [ ] Tool use works — agent can call ainative tools and receive results across multiple turns
- [ ] Human-in-the-loop approvals work — permission requests appear in inbox, block execution until resolved
- [ ] Session resume works — paused tasks can be resumed from DB-persisted conversation state
- [ ] Task cancellation works via AbortController
- [ ] Usage tracking records correct token counts with `runtimeId: "anthropic-direct"`
- [ ] Budget enforcement stops execution when budget exceeded
- [ ] Profile instructions injected correctly as system prompt
- [ ] Auth health check validates API key via `/v1/models` endpoint
- [ ] Existing `claude-code` and `openai-codex` runtimes unaffected

## Scope Boundaries

**Included:**
- Full `AgentRuntimeAdapter` implementation for Anthropic Messages API
- Shared agentic loop module
- Streaming event mapping
- Session resume via DB persistence
- Registration in catalog, registry, and profile compatibility

**Excluded:**
- Prompt caching optimization (separate feature: `direct-runtime-prompt-caching`)
- Extended thinking, context compaction, batch API (separate feature: `direct-runtime-advanced-capabilities`)
- Smart runtime auto-selection (separate feature: `smart-runtime-router`)
- Custom file system tools for direct runtimes (can use server-side `text_editor` and `code_execution`)

## References

- Source: `ideas/direct-api-gap-analysis.md` — Section 4.1 "Anthropic Direct Runtime"
- Depends on: `provider-agnostic-tool-layer` (tool definitions in neutral format)
- Enables: `smart-runtime-router`, `direct-runtime-prompt-caching`, `direct-runtime-advanced-capabilities`
- Existing pattern: `src/lib/agents/runtime/claude.ts` (Claude SDK adapter to model after)
