---
title: Chat session lost when switching sidebar views mid-stream
audience: ainative-base
status: proposed
source_branch: main
handoff_reason: Primary chat regression — reproducible across all runtimes — client-side architecture bug, not a runtime/model issue.
---

# Chat session lost when switching sidebar views mid-stream

## Summary

When a chat conversation is streaming (or waiting on the first response), switching
to another sidebar view (Dashboard, Projects, Workflows, etc.) and navigating back
to `/chat` causes the entire conversation's turn history to disappear and/or be
replaced with errors. The stream also stops mid-response, forcing the user to
repeatedly ask "continue" — with no guarantee that prior context survives.

Previously this worked: the user could switch away, let the stream finish in the
background, and come back to a complete conversation. The regression has been
observable for "the last few releases — maybe longer than the last couple of days."

## User-facing symptoms

- Starting a chat, sending a prompt, and navigating to a different sidebar view
  while the assistant is mid-response causes the assistant message to stop
  streaming immediately.
- On return to `/chat`, previously-visible turn responses are **gone** or
  replaced with an error card.
- User has to repeatedly send "continue" to try to pick up the thread, often
  without success — context is lost even when individual turns resume.
- Reproduces across both Claude (Anthropic SDK) and GPT (Codex App Server)
  runtimes. **Not model-specific** — both runtimes are affected identically.
- Stream cutoff telemetry added in `chat-stream-resilience-telemetry` (commit
  89316c4) was designed to measure exactly this scenario. The feature's
  escalation trigger says: *"If telemetry shows >1% of streams terminating
  with unexpected codes during normal use, file a follow-up."* The user's
  report IS that evidence.

## Why this belongs in base

The affected code paths are all in base ainative:

- `src/components/chat/chat-shell.tsx` — component holding all chat state
- `src/app/layout.tsx` — root layout where provider should be hoisted
- `src/app/chat/page.tsx` — route-level page that unmounts on navigation
- `src/lib/chat/engine.ts`, `src/lib/chat/reconcile.ts` — server-side stream
  finalization (already correct — the bug is purely client-side)

No domain clone has overridden any of these. The fix lands once in main and
every clone inherits it.

## Root cause

### 1. Chat state lives inside a route-level component, not a layout provider

`ChatShell` (`src/components/chat/chat-shell.tsx:31-41`) holds every piece of
chat-domain state in local `useState` hooks:

```tsx
const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
const [activeId, setActiveId] = useState<string | null>(null);
const [messages, setMessages] = useState<ChatMessageRow[]>([]);
const [isStreaming, setIsStreaming] = useState(false);
const [abortController, setAbortController] = useState<AbortController | null>(null);
```

`ChatShell` is rendered from `src/app/chat/page.tsx`, which is a child route of
the root layout. In Next.js App Router, navigating to a sibling route unmounts
`{children}` — so clicking Dashboard in the sidebar (via `<Link href="/dashboard">`)
destroys `ChatShell` and takes all of its state with it.

### 2. Streaming runs in a callback without a `useEffect` cleanup

`handleSend` (`chat-shell.tsx:269-443`) opens `fetch().body.getReader()` and runs
a `while (true) { reader.read() }` loop as an async callback invoked from a user
gesture — **not inside a `useEffect`**. That means:

- React has no cleanup hook tied to the stream.
- When `ChatShell` unmounts mid-stream, the reader loop becomes an orphaned
  promise. Every `setMessages` it issues thereafter is a no-op on a dead component.
- The `AbortController` is stored in component state (line 36), so it also dies —
  nothing calls `controller.abort()` on unmount, but nothing consumes the stream
  either. Partial assistant text is streamed into the void.
- Server-side, `finalizeStreamingMessage()` in `src/lib/chat/engine.ts` runs in
  a `finally` block and salvages partial content into the DB — so the **DB row
  is correct** — but the client state is gone.

### 3. Error path wipes all prior turns

`handleSelectConversation` (`chat-shell.tsx:142-166`) has:

```ts
} catch {
  setMessages([]);
}
```

and the initial-mount restore effect (lines 61-64) has:

```ts
.catch(() => setMessages([]));
```

On remount after navigating back to `/chat`, if the messages fetch has any
hiccup (timing race with dev-server SSR, transient network, browser coalescing
of rapid nav requests), these catches wipe the entire visible turn history even
though the DB has the full conversation. That's the "all prior turns replaced
with errors" symptom.

### 4. Why it used to work and doesn't now

The underlying pattern (local state, streaming in a callback) has existed for
some time, so an earlier version likely used a different navigation pattern —
either a state-preserving parallel route, a layout-level chat panel, or a
softer sidebar nav that kept `ChatShell` mounted. The recent commit `6547ccf`
made `layout.tsx` async (SSR theme cookie resolution), which may have changed
Suspense boundaries enough to amplify the remount cost. The fix below is
architecturally correct regardless of which exact commit tipped it — the
current pattern is wrong because it binds streaming lifecycle to view lifecycle.

## Proposed fix

### 1. Hoist chat session state to a layout-level provider

Create `src/components/chat/chat-session-provider.tsx` — a React context
provider that holds:

- `conversations`, `activeId`, `messagesByConversation` (keyed so multiple
  conversations can be open without clobbering each other)
- `streamingState: { conversationId, assistantMsgId, abortController, startedAt } | null`
- `modelId`, `availableModels`

And exposes actions:

- `sendMessage(conversationId, content, mentions, modelId)` — starts fetch +
  reader loop **inside the provider**, updates provider state on each
  delta/status/done event. AbortController is provider-local.
- `stopStreaming()`, `selectConversation(id)`, `createConversation(...)`,
  `deleteConversation(...)`, `renameConversation(...)`, `setActiveModelId(...)`

Wire the provider into `src/app/layout.tsx` around `<main>{children}</main>`.
Because layout providers persist across child route changes in Next.js App
Router, the provider's state survives sidebar navigation. The streaming fetch
and reader loop survive too.

### 2. ChatShell becomes a thin view

`src/components/chat/chat-shell.tsx` drops its useState block and instead calls
`useChatSession()`. All callbacks become thin wrappers over session actions.
It retains only view-local state (mobile sheet open, hover preview).

### 3. Fix the "all turns disappear" bug

`selectConversation` in the provider must **not** clear existing messages on
fetch failure. On error: leave the current messages as-is, surface a
non-blocking toast. Same for the initial-mount restore path.

### 4. Preserve existing server-side behavior

`finalizeStreamingMessage()` and `reconcileStreamingMessages()` already handle
salvage correctly. No server changes needed. The provider does not add a resume
protocol — that remains a future follow-up if telemetry ever shows the need.

## Non-goals

- SSE resume protocol (`lastEventId` replay) — remains deferred
- Web Worker isolation for SSE reader — remains deferred
- Changing server-side chat engine, reconcile, or telemetry semantics
- Changing conversation list UI, message rendering, or input composer

## Acceptance criteria

- Starting a chat, sending a prompt that streams for 5-10s, navigating to
  `/dashboard` for 10s, and returning to `/chat` shows the assistant message
  **complete or still filling in live** — never empty, never an error card
- Repeating the above five times in rapid succession loses zero turns
- `handleSelectConversation` failing to load messages **does not clear** the
  existing visible messages
- Stop button still works (provider's AbortController aborts cleanly)
- Works identically on both Claude and GPT runtimes
- `npm test` passes, `npx tsc --noEmit` clean
- Diagnostic endpoint `GET /api/diagnostics/chat-streams` shows zero
  `stream.abandoned` events in the nav-during-streaming scenario

## Suggested tests

### Provider unit tests

- `sendMessage` starts a stream and updates state on each delta event
- Unmounting the consumer component does not abort the in-flight stream
- Remounting the consumer sees the provider's current state (including any
  partial streaming message)
- `selectConversation` fetch failure preserves existing messages for that
  conversation
- `stopStreaming` aborts the fetch and transitions the assistant message to
  `error`/`complete` state as appropriate

### Regression tests

- A mock `ChatShell` consumer that mounts, triggers `sendMessage`, unmounts
  before `done`, and remounts, sees the final complete assistant message

## Notes

This is the follow-up the `chat-stream-resilience-telemetry` feature
anticipated. The telemetry codes (`stream.abandoned`, `client.stream.user-abort`,
`stream.aborted.client`) from commit 89316c4 and the timing fix in a131402
stay in place and become the primary signal that the provider-based fix
is working in production.
