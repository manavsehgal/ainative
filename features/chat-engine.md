---
title: Chat Engine
status: completed
priority: P0
milestone: post-mvp
source: brainstorm (2026-03-22)
dependencies: [chat-data-layer, provider-runtime-abstraction, multi-agent-routing]
---

# Chat Engine

## Description

Server-side orchestration layer that builds progressive context from ainative primitives, invokes the appropriate runtime SDK (Claude or Codex), normalizes streaming events, persists messages, detects entity references for quick access links, and generates context-aware suggested prompts.

This is the brain of the chat feature. It abstracts over both runtimes behind a unified `ChatStreamEvent` interface, manages token budgets across 5 context tiers, and provides the entity detection that powers the Quick Access navigation pills in the UI.

The engine uses a non-agentic pattern by default (single-turn completions, no tool use, `maxTurns: 1`) adapted from the existing `runMetaCompletion` in `src/lib/agents/runtime/claude.ts`. This keeps chat fast and cheap (~$0.001/turn with Haiku 4.5).

## User Story

As a user chatting with ainative, I want responses that understand my projects, tasks, and documents so that I get contextually relevant answers without having to explain my setup.

## Technical Approach

### Core Engine (`src/lib/chat/engine.ts`)
- Main `sendMessage(conversationId, userMessage, options?)` function
- Accepts user message + conversation context, builds progressive context, calls SDK, returns async iterable of `ChatStreamEvent`
- `ChatStreamEvent` type: `{type: 'delta' | 'done' | 'error', content?: string, quickAccess?: QuickAccessLink[], metadata?: object}`
- Selects runtime based on conversation's `runtimeId`
- Persists assistant message to DB as content streams (status: streaming → complete/error)
- Tracks usage in ledger with `chat_turn` activity type
- Enforces budget guardrails before each turn (reuse `src/lib/usage/budget.ts`)

### Progressive Context Builder (`src/lib/chat/context-builder.ts`)
- 5-tier system with strict token budgets:
  - **Tier 0** (always, <500 tokens): system time, active project name/status, workspace cwd, runtime identity, user settings
  - **Tier 1** (conversation, <8K tokens): sliding window of last N messages from conversation history. When conversation exceeds window, summarize older messages via a lightweight meta-completion
  - **Tier 2** (project, <5K tokens): project description + workingDirectory, active tasks (name + status, last 10), active workflows (name + status, last 5), linked documents (names only), active schedules (name + next fire)
  - **Tier 3** (on-demand, <10K tokens): full entity detail when user mentions a specific task/workflow/document by name or ID. Triggered by entity detection on the user message
  - **Tier 4** (document, <30K tokens): full document content on explicit reference. Reuses existing `buildDocumentContext()` from `src/lib/documents/context-builder.ts` with truncation
- Total budget ceiling: ~53K input tokens

### Entity Detector (`src/lib/chat/entity-detector.ts`)
- Scans assistant response text for references to ainative primitives
- Returns `QuickAccessLink[]`: `{type, id, label, href}` for project/task/workflow/document/schedule
- Detection strategy: regex patterns + DB lookup
  - Match task/project/workflow names against an in-memory entity index
  - Entity index built from recent DB state (loaded once per conversation, refreshed on switch)
- Used both for Tier 3 context injection (on user message) and Quick Access pill generation (on assistant response)

### Suggested Prompts (`src/lib/chat/suggested-prompts.ts`)
- Server-side function, no AI call — pure template interpolation from DB state
- Queries: recent projects, failed tasks, active workflows, recent documents
- Returns 4-6 categorized prompts:
  - Project-aware: "What's the status of [project name]?"
  - Task-aware: "Why did [failed task] fail?"
  - Document-aware: "Summarize [recent document]"
  - System: "What can you help me with?"
- Called by the chat page Server Component on load

### Runtime Adapters
- **Claude**: Adapt `runMetaCompletion` pattern — `query()` with `maxTurns: 1`, no tools, streaming via AsyncIterable. Extract `content_block_delta` events for token delivery
- **Codex**: Use `CodexAppServerClient` — `thread/start` + `turn/start`, listen for `item/agentMessage/delta` notifications. Normalize to ChatStreamEvent

### Model Selection
- Default model: Claude Haiku 4.5 (from `chat_default_model` setting, falls back to haiku)
- Model passed to SDK call based on conversation's `modelId` field
- Available models with cost tiers:
  - Haiku 4.5 — Fast, $ (default)
  - Sonnet 4.6 — Balanced, $$
  - Opus 4.6 — Best, $$$
  - GPT-4o-mini — Fast, $ (if Codex available)
  - GPT-4o — Balanced, $$ (if Codex available)

## Acceptance Criteria

- [ ] Context builder produces tiered context within token budgets
- [ ] Engine streams responses from Claude SDK with progressive token delivery
- [ ] Engine streams responses from Codex App Server with progressive token delivery
- [ ] Entity detector identifies project, task, workflow, and document references in responses
- [ ] Suggested prompts reflect current DB state (failed tasks, active projects, recent documents)
- [ ] Messages persisted to DB as they stream (status transitions: streaming → complete/error)
- [ ] Usage tracked in ledger with `chat_turn` activity type
- [ ] Budget guardrails enforced before each chat turn
- [ ] Conversation history sliding window prevents context overflow
- [ ] Error states handled: SDK connection failure, rate limit (429 with backoff), empty response, session expired
- [ ] Model selection respects conversation modelId and settings default

## Scope Boundaries

**Included:**
- Context building (5 tiers), SDK invocation, streaming normalization
- Entity detection, suggested prompts, message persistence, usage tracking
- Budget enforcement, error handling, model selection

**Excluded:**
- UI components (chat-ui-shell, chat-message-rendering, chat-input-composer)
- API routes (chat-api-routes)
- Agentic mode / tool use (future feature)
- Semantic search / embeddings / RAG

## References

- Source: Brainstorm session 2026-03-22
- Related features: Depends on chat-data-layer. Enables chat-api-routes
- Pattern reference: `src/lib/agents/runtime/claude.ts` (runMetaCompletion), `src/lib/documents/context-builder.ts` (buildDocumentContext), `src/lib/usage/ledger.ts`, `src/lib/usage/budget.ts`
