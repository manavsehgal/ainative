---
title: Bidirectional Channel Chat
status: planned
priority: P1
milestone: post-mvp
source: features/multi-channel-delivery.md
dependencies: [multi-channel-delivery, chat-engine]
---

# Bidirectional Channel Chat

## Description

Enable users to chat with Stagent agents directly from Slack, Telegram, or any webhook-integrated channel. Phase 1 (multi-channel-delivery) established outbound-only delivery. This feature closes the loop — inbound messages from channels are routed to the existing chat engine, agent responses are sent back to the same thread, and multi-turn conversations are maintained across messages.

The key insight is that the chat engine's `sendMessage()` async generator is already runtime-agnostic (Claude SDK, Codex, Ollama). A new Channel Gateway layer consumes this generator synchronously (accumulating streaming deltas into complete messages) and routes responses back through channel adapters. No duplication of the engine.

This transforms Stagent from "another dashboard" into "AI that lives where I work" — solo founders and teams can interact with any agent profile (wealth-manager, content-creator, etc.) from their messaging app of choice.

## User Story

As a solo founder, I want to chat with my Stagent agents directly in Slack or Telegram, so that I can get AI assistance without switching to the browser dashboard.

## Technical Approach

### Channel Gateway (Core Orchestrator)

New file: `src/lib/channels/gateway.ts`

Bridges inbound channel messages to the existing chat engine:

1. Receives inbound message from webhook route
2. Resolves channel binding (maps channel + thread to a conversation)
3. Creates conversation on first message (auto-bind)
4. Calls `sendMessage()` from existing chat engine
5. Accumulates `delta` events into complete response
6. Sends complete response back to channel thread via `sendReply()`
7. Handles permission requests by sending approve/deny prompts to channel

### Channel Bindings (Data Model)

New table: `channel_bindings` — maps a channel config + external thread to a Stagent conversation.

```
channel_bindings
  id                TEXT PK
  channelConfigId   TEXT FK → channel_configs.id
  conversationId    TEXT FK → conversations.id
  externalThreadId  TEXT          -- Slack thread_ts / Telegram thread
  runtimeId         TEXT NOT NULL -- Which runtime to use
  modelId           TEXT          -- Which model
  profileId         TEXT          -- Optional agent profile
  status            TEXT          -- active | paused | archived
  pendingRequestId  TEXT          -- Set when awaiting permission response
  UNIQUE(channelConfigId, externalThreadId)
```

New column on `channel_configs`: `direction TEXT DEFAULT 'outbound'` — preserves backward compatibility.

### Extended ChannelAdapter Interface

Add optional methods (backward-compatible):

- `parseInbound(rawBody, headers)` — extract message from platform payload
- `verifySignature(rawBody, headers, config)` — validate webhook authenticity
- `sendReply(message, config, threadId)` — reply in thread (distinct from fire-and-forget `send()`)

### Inbound Webhook Routes

- `POST /api/channels/inbound/telegram` — receives Telegram Bot API updates, verifies via secret token
- `POST /api/channels/inbound/slack` — receives Slack Events API callbacks, handles URL verification challenge, verifies `x-slack-signature`
- `POST /api/channels/inbound/webhook` — generic webhook with HMAC signature validation

### Telegram Adapter Upgrades

- `parseInbound()`: extract text, chatId, messageId from Telegram update
- `sendReply()`: use `sendMessage` API with `reply_to_message_id` for threading
- Webhook registration: call `setWebhook` API when direction set to `bidirectional`
- Filter bot's own messages (`from.is_bot`) to prevent loops

### Slack Adapter Upgrades

- `parseInbound()`: extract text, channel, thread_ts from Slack event
- `verifySignature()`: HMAC-SHA256 with signing secret
- `sendReply()`: use `chat.postMessage` API with Bot Token + `thread_ts` (incoming webhooks can't thread)
- Respond 200 immediately (Slack 3-second requirement), process async
- New config fields: `botToken`, `signingSecret`, `slackChannelId`

### Concurrency Control

Per-conversation turn lock prevents overlapping agent turns. If user sends a message while agent is processing, gateway replies with "Still processing, please wait."

### Permission Handling

When chat engine emits `permission_request`:
1. Gateway sends formatted prompt to channel ("Reply 'approve' or 'deny'")
2. Sets `pendingRequestId` on binding
3. Next inbound message parsed as permission response (keyword matching)
4. Calls `resolvePendingRequest()` from existing permission-bridge.ts
5. Stream unblocks and continues

## Acceptance Criteria

- [ ] Telegram: user sends message to bot, receives agent response in same chat
- [ ] Telegram: second message continues the same conversation (multi-turn)
- [ ] Telegram: bot does not respond to its own messages (loop prevention)
- [ ] Slack: user sends message in channel, receives threaded response
- [ ] Slack: URL verification challenge handled correctly during setup
- [ ] Slack: signature verification rejects spoofed requests
- [ ] Slack: response returned within 3-second requirement (200 first, process async)
- [ ] Webhook: generic inbound with HMAC signature validation works
- [ ] Permission request appears in channel with approve/deny instructions
- [ ] "approve" reply unblocks agent and continues processing
- [ ] Channel config direction toggle (outbound/bidirectional) in settings UI
- [ ] Existing outbound-only delivery continues to work unchanged
- [ ] Budget guardrails enforced on channel-initiated conversations (via chat engine)
- [ ] Channel bindings viewable in settings (which conversations are bound to which channels)

## Scope Boundaries

**Included:**
- Inbound message reception for Slack, Telegram, and generic webhook
- Chat engine integration via Channel Gateway
- Channel-to-conversation binding with thread mapping
- Multi-turn conversations across channel messages
- Permission handling via channel replies
- Turn locking (one turn at a time per conversation)
- Settings UI: direction toggle, webhook URL display

**Excluded:**
- Rich interactive components (Slack Block Kit buttons, Telegram inline keyboards) — future enhancement
- File/image attachment handling from channels — future enhancement
- Multiple conversations per channel (only thread-based separation) — future enhancement
- Email as inbound channel — separate feature
- Channel-based workflow triggering (only chat conversations) — future enhancement
- Typing indicators while agent processes — nice-to-have, not MVP

## References

- Source: `features/multi-channel-delivery.md` — Phase 2 (bidirectional) was explicitly deferred
- Chat engine: `src/lib/chat/engine.ts` — `sendMessage()` async generator
- Permission bridge: `src/lib/chat/permission-bridge.ts` — `createPendingRequest/resolvePendingRequest`
- Channel adapters: `src/lib/channels/` — existing adapter pattern
- Related features: multi-channel-delivery (Phase 1, outbound), chat-engine (conversation management)
