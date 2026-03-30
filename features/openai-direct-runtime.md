---
title: OpenAI Direct Runtime
status: planned
priority: P1
milestone: post-mvp
source: ideas/direct-api-gap-analysis.md
dependencies: [provider-agnostic-tool-layer, provider-runtime-abstraction, cross-provider-profile-compatibility]
---

# OpenAI Direct Runtime

## Description

Add `openai-direct` as a fourth runtime in Stagent's catalog. This runtime calls the OpenAI Responses API directly via the `openai` TypeScript SDK instead of spawning a Codex App Server subprocess. It provides sub-second first-token latency, access to server-side tools (web search, code interpreter, file search, image generation), and works anywhere with just an API key — no Codex binary required.

The existing `openai-codex-app-server` runtime remains fully supported. The `openai-direct` runtime is ideal for data analysis tasks (code interpreter), research (web search), document processing (file search), and creative tasks (image generation).

## User Story

As a Stagent user, I want to run tasks via the OpenAI Responses API directly so that I can access code interpreter, file search, and image generation capabilities without needing the Codex CLI installed.

## Technical Approach

### New Files

- `src/lib/agents/runtime/openai-direct.ts` (~420 lines) — Implements `AgentRuntimeAdapter` interface

### Responses API Integration

The OpenAI Responses API supports a server-side agentic loop — the API can execute built-in tools internally without client round-trips. For Stagent's custom tools, the client-side loop pattern is used:

1. Call `responses.create()` with instructions, input, tools (Stagent tools as `function` type + built-in tools), and `stream: true`
2. Process streaming events → map to Stagent SSE event types
3. Check response output items:
   - `message` → extract text, emit as delta events
   - `function_call` → execute Stagent tool handler after HITL check, send `function_call_output`
   - Built-in tool results (web_search, code_interpreter) → emit as delta events (server-side execution, no client action needed)
4. Use `previous_response_id` for session continuity
5. Enforce turn limits and budget via usage tracking

### Built-in Server Tools

| OpenAI Tool | Stagent Use Case | Configuration |
|-------------|-----------------|---------------|
| `web_search_preview` | Research profile tasks | `{ type: "web_search_preview" }` |
| `code_interpreter` | Data analysis, computation | `{ type: "code_interpreter" }` |
| `file_search` | Document retrieval, RAG | `{ type: "file_search", vector_store_ids }` |
| `image_generation` | Creative tasks | `{ type: "image_generation" }` |

Server-side tools execute within the API — no client-side approval needed (the API handles them). Stagent logs their usage for monitoring.

### Streaming Event Mapping

| OpenAI SSE Event | Stagent Event |
|------------------|---------------|
| `response.created` | `{ type: "status", phase: "running" }` |
| `response.output_item.added` (message) | Begin new content block |
| `response.content_part.delta` | `{ type: "delta", content }` |
| `response.output_item.added` (function_call) | `{ type: "status", phase: "tool_use" }` |
| `response.completed` | `{ type: "done" }` |
| Error | `{ type: "error", message }` |

### Capabilities Declaration

```typescript
{
  id: "openai-direct",
  label: "OpenAI Direct API",
  description: "Direct OpenAI Responses API — server-side tools, code interpreter, image generation.",
  providerId: "openai",
  capabilities: {
    resume: true,         // previous_response_id
    cancel: true,         // AbortController
    approvals: true,      // HITL for Stagent tools (not server-side tools)
    mcpServers: true,     // Responses API MCP support (Beta)
    profileTests: true,
    taskAssist: true,
    profileAssist: false, // Not implemented initially
    authHealthCheck: true
  }
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/agents/runtime/openai-direct.ts` | **New** — adapter implementation |
| `src/lib/agents/runtime/catalog.ts` | Add `openai-direct` to catalog and `SUPPORTED_AGENT_RUNTIMES` |
| `src/lib/agents/runtime/index.ts` | Register adapter in `runtimeRegistry` |
| `src/lib/agents/profiles/builtins/*/profile.yaml` | Add `openai-direct` to `supportedRuntimes` where appropriate |
| `package.json` | Add `openai` SDK dependency |

### Auth

- Uses `OPENAI_API_KEY` from Stagent settings (existing `getAuthEnv()` pattern)
- `testConnection()` calls `GET /v1/models` to validate the key

## Acceptance Criteria

- [ ] `openai-direct` appears in the runtime catalog and settings UI runtime dropdown
- [ ] Tasks execute successfully via OpenAI Responses API with streaming output
- [ ] Stagent custom tools work — function calls dispatched to tool handlers with HITL approval
- [ ] Server-side built-in tools work — web_search, code_interpreter results streamed back
- [ ] Session resume works via `previous_response_id`
- [ ] Task cancellation works via AbortController
- [ ] Usage tracking records correct token counts with `runtimeId: "openai-direct"`
- [ ] Budget enforcement stops execution when budget exceeded
- [ ] Profile instructions injected as `instructions` parameter
- [ ] Auth health check validates API key
- [ ] Existing `claude-code` and `openai-codex` runtimes unaffected
- [ ] Model selection works — user can choose GPT-5.4, GPT-4.1, GPT-4.1-mini, etc.

## Scope Boundaries

**Included:**
- Full `AgentRuntimeAdapter` implementation for OpenAI Responses API
- Streaming event mapping
- Server-side tool integration (web_search, code_interpreter, file_search, image_generation)
- Session resume via `previous_response_id`
- Registration in catalog, registry, and profile compatibility

**Excluded:**
- Rewriting the existing `openai-codex-app-server` adapter
- File search vector store management UI (future feature)
- Smart runtime auto-selection (separate feature)
- Image generation preview/gallery UI (future feature)

## References

- Source: `ideas/direct-api-gap-analysis.md` — Section 4.2 "OpenAI Direct Runtime"
- Depends on: `provider-agnostic-tool-layer` (tool definitions in neutral format)
- Reuses: `src/lib/agents/agentic-loop.ts` (shared loop from `anthropic-direct-runtime`)
- Enables: `smart-runtime-router`
- Existing pattern: `src/lib/agents/runtime/openai-codex.ts` (Codex adapter to reference)
