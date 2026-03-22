---
title: Chat API Routes
status: completed
priority: P0
milestone: post-mvp
source: brainstorm (2026-03-22)
dependencies: [chat-data-layer, chat-engine]
---

# Chat API Routes

## Description

REST API endpoints for chat operations: conversation CRUD and message sending with SSE streaming. Follows stagent's existing API patterns (Zod validation, NextResponse, proper status codes).

The key innovation is the message-send endpoint which returns an SSE stream — unlike the existing log streaming that polls the DB at 500ms intervals, chat uses a `TransformStream` bridge that pipes SDK events directly to the SSE response for near-zero latency token delivery. Messages are persisted to DB as a side effect for reconnection recovery.

## User Story

As the chat UI, I need API endpoints to create conversations, send messages, and receive streaming responses so that the frontend can be a thin client.

## Technical Approach

### Conversation CRUD
- `POST /api/chat/conversations` — Create conversation
  - Body: `{ projectId?: string, runtimeId: string, modelId?: string, title?: string }`
  - Validates runtimeId against available runtimes
  - Auto-generates title from first message if not provided (updated after first response)
  - Returns 201 with conversation object
- `GET /api/chat/conversations` — List conversations
  - Query params: `status?`, `projectId?`, `limit?` (default 50)
  - Returns conversations sorted by updatedAt desc
- `GET /api/chat/conversations/[id]` — Get conversation with messages
  - Returns conversation + all messages
- `PATCH /api/chat/conversations/[id]` — Update conversation
  - Body: `{ title?: string, status?: 'active' | 'archived', modelId?: string }`
- `DELETE /api/chat/conversations/[id]` — Delete conversation
  - Cascades to all messages

### Message Send + SSE Stream
- `POST /api/chat/conversations/[id]/messages` — Send user message
  - Body: `{ content: string }`
  - Insert user message to DB
  - Call `ChatEngine.sendMessage()` which returns async iterable
  - Bridge to SSE via `TransformStream`:
    ```
    data: {"type":"delta","content":"token text"}
    data: {"type":"delta","content":"more text"}
    data: {"type":"done","quickAccess":[{type,id,label,href},...]}
    data: {"type":"error","message":"..."}
    ```
  - Keepalive comment (`: keepalive\n\n`) every 15s
  - Clean abort on client disconnect via `request.signal`
  - Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

### Message History (Reconnection)
- `GET /api/chat/conversations/[id]/messages` — Fetch message history
  - Query params: `after?` (timestamp for fetching missed messages after SSE drop)
  - Returns messages sorted by createdAt asc

### Suggested Prompts
- `GET /api/chat/suggested-prompts` — Context-aware suggested prompts
  - Query params: `projectId?`
  - Calls `buildSuggestedPrompts()` from chat engine
  - Returns 4-6 prompt objects: `{ category, text, icon }`

### Validation
- Zod schemas for all request bodies
- Conversation existence check on all /[id] routes
- Runtime availability check on conversation creation

## Acceptance Criteria

- [ ] All CRUD endpoints work with proper Zod validation
- [ ] SSE streaming delivers tokens progressively with <100ms latency per chunk
- [ ] Keepalive pings every 15s prevent connection timeout
- [ ] Client disconnect cleanly aborts SDK call (no zombie streams)
- [ ] Message history endpoint supports `after` param for reconnection
- [ ] Suggested prompts endpoint returns context-aware prompts
- [ ] Error responses follow existing API conventions (proper status codes, JSON error bodies)
- [ ] Conversation creation validates runtimeId against available runtimes
- [ ] Delete cascades to messages

## Scope Boundaries

**Included:**
- REST endpoints for conversation CRUD
- SSE streaming for message responses
- Zod validation, error handling
- Reconnection support via message history
- Suggested prompts endpoint

**Excluded:**
- WebSocket support (SSE is sufficient for unidirectional streaming)
- File upload in chat (use Documents feature)
- Authentication changes (uses existing app auth patterns)

## References

- Source: Brainstorm session 2026-03-22
- Related features: Depends on chat-data-layer, chat-engine. Enables chat-ui-shell, chat-message-rendering, chat-input-composer
- Pattern reference: `src/app/api/logs/stream/route.ts` (SSE pattern), `src/app/api/tasks/route.ts` (CRUD pattern)
