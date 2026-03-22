---
title: Chat Data Layer
status: planned
priority: P0
milestone: post-mvp
source: brainstorm (2026-03-22)
dependencies: [database-schema, provider-runtime-abstraction]
---

# Chat Data Layer

## Description

Foundation tables and data access functions for the chat feature. Adds `conversations` and `chat_messages` tables to the database, with Drizzle schema definitions, bootstrap SQL for idempotent table creation, clear.ts integration for safe data reset, and a data access module with CRUD functions.

This is the first feature in the chat initiative — everything else (engine, API, UI) depends on these tables existing. The design follows stagent's established patterns: Drizzle ORM schema in `schema.ts`, idempotent CREATE TABLE in `bootstrap.ts`, FK-safe deletion in `clear.ts`, and typed data access functions in `src/lib/data/`.

## User Story

As a developer building the chat feature, I need persistent storage for conversations and messages so that chat history survives across sessions and can be queried by other chat modules.

## Technical Approach

- Add `conversations` table to `src/lib/db/schema.ts`:
  - `id` (text, PK), `projectId` (text, FK to projects, nullable), `title` (text), `runtimeId` (text — 'claude-code' | 'openai-codex-app-server'), `modelId` (text — e.g. 'claude-haiku-4-5', nullable), `status` (text — 'active' | 'archived', default 'active'), `sessionId` (text, nullable — SDK session/thread ID for resume), `contextScope` (text, nullable — JSON of which primitives are in context), `createdAt` (integer), `updatedAt` (integer)
- Add `chat_messages` table to `src/lib/db/schema.ts`:
  - `id` (text, PK), `conversationId` (text, FK to conversations), `role` (text — 'user' | 'assistant' | 'system'), `content` (text — markdown), `metadata` (text, nullable — JSON: quick access links, token counts, error info), `status` (text — 'streaming' | 'complete' | 'error', default 'complete'), `createdAt` (integer)
- Add indexes: `conversations(projectId)`, `conversations(updatedAt)`, `chat_messages(conversationId)`, `chat_messages(createdAt)`
- Add `chat_turn` to `UsageActivityType` union in `src/lib/usage/ledger.ts`
- Add both tables to `src/lib/data/clear.ts` — delete `chat_messages` before `conversations` for FK safety
- Add idempotent `CREATE TABLE IF NOT EXISTS` to `src/lib/db/bootstrap.ts` for both tables
- Create `src/lib/data/chat.ts` with typed CRUD functions:
  - `createConversation(params)` → ConversationRow
  - `listConversations(filters?)` → ConversationRow[] (sorted by updatedAt desc)
  - `getConversation(id)` → ConversationRow | null (with message count)
  - `deleteConversation(id)` → void (cascades to messages)
  - `archiveConversation(id)` → void (sets status='archived')
  - `renameConversation(id, title)` → void
  - `addMessage(params)` → ChatMessageRow
  - `getMessages(conversationId, limit?)` → ChatMessageRow[]
  - `updateMessageStatus(id, status, content?)` → void
  - `updateMessageContent(id, content)` → void (for streaming append)
- Export `ConversationRow` and `ChatMessageRow` types from schema for use by other modules

## Acceptance Criteria

- [ ] `conversations` table created with all columns and indexes
- [ ] `chat_messages` table created with all columns and indexes
- [ ] Bootstrap SQL creates both tables idempotently (no error on restart)
- [ ] `clear.ts` deletes chat data in FK-safe order (messages before conversations)
- [ ] All CRUD data access functions work correctly
- [ ] `chat_turn` activity type added to usage ledger types
- [ ] Schema types (`ConversationRow`, `ChatMessageRow`) exported for other modules
- [ ] Conversation deletion cascades to associated messages
- [ ] Conversation listing supports filtering by status and projectId

## Scope Boundaries

**Included:**
- Database tables, schema, bootstrap, indexes
- Data access CRUD functions
- clear.ts integration
- Usage ledger type addition

**Excluded:**
- API routes (chat-api-routes feature)
- Streaming logic (chat-engine feature)
- UI components (chat-ui-shell feature)
- Context building (chat-engine feature)

## References

- Source: Brainstorm session 2026-03-22
- Related features: Enables chat-engine, chat-api-routes, chat-ui-shell, chat-message-rendering, chat-input-composer
- Pattern reference: `src/lib/db/schema.ts`, `src/lib/db/bootstrap.ts`, `src/lib/data/clear.ts`
