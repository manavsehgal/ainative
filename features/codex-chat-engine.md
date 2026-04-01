---
title: Codex Chat Engine
status: completed
priority: P1
milestone: post-mvp
source: retrospective — code exists without spec (2026-03-31)
dependencies: [chat-engine, openai-codex-app-server, provider-runtime-abstraction]
---

# Codex Chat Engine

## Description

A parallel chat streaming engine that connects the chat interface to the OpenAI Codex App Server runtime. While `chat-engine` handles Claude SDK streaming, this module implements the equivalent pipeline for Codex: message persistence, context building, entity detection, usage metering, budget enforcement, and real-time SSE streaming — all routed through the Codex App Server WebSocket JSON-RPC client.

This is a critical piece of the multi-runtime chat architecture. Without it, chat conversations could only run on the Claude SDK runtime. The Codex chat engine enables users to chat with OpenAI models via the same UI, sharing conversation persistence and context injection infrastructure.

## User Story

As a user with an OpenAI API key configured, I want to chat using OpenAI models through the same interface so that I can compare model capabilities and choose the best runtime per conversation.

## Technical Approach

- **Streaming via Codex App Server**: Uses `CodexAppServerClient` (WebSocket JSON-RPC) for streaming responses, not direct OpenAI API calls
- **Shared infrastructure**: Reuses `buildChatContext()`, `detectEntities()`, `deduplicateByEntityId()`, `getWorkspaceContext()` from the shared chat module
- **Message lifecycle**: Creates user message → streams assistant response → updates message content/status → persists to DB
- **Usage metering**: Extracts `UsageSnapshot` from Codex responses, merges incrementally, records to usage ledger
- **Budget enforcement**: Calls `enforceBudgetGuardrails()` to check spend limits before execution
- **Permission bridge**: Integrates `createSideChannel()` and `emitSideChannelEvent()` for tool approval flows
- **Provider detection**: Uses `getProviderForRuntime()` to determine when to route to Codex vs Claude engine

### Key Files

- `src/lib/chat/codex-engine.ts` — Main streaming engine
- `src/lib/agents/runtime/codex-app-server-client.ts` — WebSocket JSON-RPC client
- `src/lib/chat/context-builder.ts` — Shared context assembly
- `src/lib/chat/types.ts` — `ChatStreamEvent` types and provider detection

## Acceptance Criteria

- [x] Chat messages route to Codex engine when runtime is set to `codex-app-server`
- [x] Streaming responses display in real-time via SSE
- [x] Message persistence (user + assistant) in same conversation table as Claude messages
- [x] Entity detection and context injection work identically to Claude engine
- [x] Usage metering records Codex token consumption to the usage ledger
- [x] Budget guardrails enforce spend limits before Codex execution
- [x] Workspace context (cwd, git branch, project) injected into system prompt

## Scope Boundaries

**Included:**
- Codex App Server WebSocket streaming integration
- Message persistence and conversation state management
- Usage metering and budget enforcement for Codex
- Shared context builder integration

**Excluded:**
- Direct OpenAI API streaming (covered by `openai-direct-runtime`)
- Codex App Server binary management (covered by `openai-codex-app-server`)
- Chat UI rendering (covered by `chat-message-rendering`)

## References

- Related features: `chat-engine` (Claude equivalent), `openai-codex-app-server` (runtime adapter), `provider-runtime-abstraction` (runtime catalog)
- Source: Retrospective spec — code implemented during chat initiative, no prior spec existed
