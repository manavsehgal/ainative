---
title: Chat Conversation Persistence & Background Activity
status: pending
priority: P1
milestone: post-mvp
source: kitchen-sink-03-23.md
dependencies:
  - chat-data-layer
  - chat-ui-shell
---

# Chat Conversation Persistence & Background Activity

## Description

The chat system persists conversations and messages to the database, but the active conversation selection (`activeId`) lives only in React `useState` — navigating away from the chat view and returning resets the view to a blank state. Users lose their place in ongoing conversations.

Additionally, when chat agents spawn background tasks via `execute_task` (fire-and-forget pattern), those tasks continue running server-side independently of the SSE connection, but the chat UI provides zero visibility into their progress. Users who navigate to other views and return have no indication that background work completed or is still running.

This feature addresses both gaps: persist the active conversation across navigation and surface background subagent activity with a resilient indicator.

## User Stories

As a user, I want to navigate between views without losing my active conversation, so I can multitask across Stagent without losing context.

As a user, I want to see when background tasks spawned from my chat are still running, so I know work is happening even when I switch to other views and return.

## Technical Approach

### Part 1: Conversation Persistence

**URL search param (primary):** When a conversation is selected, update the URL to `/chat?c=<conversationId>` via `router.replace()` (no navigation, just URL update). The Server Component in `page.tsx` reads `searchParams.c` and passes it as `initialActiveId` to `ChatShell`.

**localStorage fallback:** Reuse `usePersistedState` hook from `src/hooks/use-persisted-state.ts` (same pattern as `board-context-persistence`). Key: `stagent-active-chat`. On mount, resolution priority: URL param > localStorage > null (empty state).

**Graceful fallback:** If the persisted conversation ID no longer exists in the database (deleted or archived), fall back to null (empty state) instead of showing an error. The conversation list already handles this — just clear the stale ID.

### Part 2: Background Subagent Activity Indicator

**How subagents work today:**
- Chat agent calls `execute_task` tool (`src/lib/chat/tools/task-tools.ts:192-229`)
- `executeTaskWithAgent()` fires and forgets — returns 202, execution continues via `execution-manager.ts` in-memory Map
- Chat SSE stream aborts when user navigates away (browser closes fetch → `signal.aborted`), but spawned tasks keep running
- Task status updates go to the `tasks` table; execution events go to `agent_logs`

**Activity indicator design:**
- After a chat message that includes a tool result from `execute_task`, extract the spawned `taskId` from the tool response
- Track spawned task IDs per conversation (store in conversation metadata or derive from message content)
- Show a persistent activity bar/chip below the chat input showing: "1 task running" / "2 tasks running" with a spinner
- Poll task status via `/api/tasks/[id]` at ~5s intervals for running tasks (lightweight — just status field)
- When task completes, update indicator: "Task completed: [title]" with success/failure badge
- Completed task results can be shown as a system message appended to the conversation

**Navigation resilience:**
- The activity indicator state derives from DB (task status), not from React state
- When user returns to chat and conversation is restored (Part 1), re-query spawned task statuses
- Show what happened while away: "While you were away: 2 tasks completed, 1 failed"
- Running tasks continue to show spinner until complete

### Key Architecture Facts

- Task execution is fire-and-forget: `executeTaskWithAgent()` spawns independently, stored in `execution-manager.ts` in-memory Map
- Chat SSE aborts on navigation but spawned tasks keep running server-side
- Message `status` field tracks streaming state but NOT background task state
- `agent_logs` table has task execution events that can be polled for detailed progress
- `tasks` table `status` field is the simplest poll target (queued → running → completed/failed)

## Key Files

| File | Purpose |
|------|---------|
| `src/app/chat/page.tsx` | Read `searchParams.c`, pass `initialActiveId` to ChatShell |
| `src/components/chat/chat-shell.tsx` | Wire `usePersistedState`, sync `activeId` to URL, activity indicator state |
| `src/hooks/use-persisted-state.ts` | Reuse existing hook for localStorage persistence |
| `src/lib/chat/tools/task-tools.ts` | Reference — `execute_task` tool returns taskId in response |
| `src/lib/agents/execution-manager.ts` | Reference — in-memory tracking of running tasks |
| `src/components/chat/chat-activity-indicator.tsx` | New — renders running/completed task status bar |

## Acceptance Criteria

- [ ] Active conversation ID persisted in URL search param (`?c=<id>`) on selection
- [ ] Navigating away and returning restores the same conversation with messages visible
- [ ] localStorage fallback persists active conversation across page reload
- [ ] Stale/deleted conversation IDs gracefully fall back to empty state
- [ ] Sidebar conversation list highlights the restored active conversation
- [ ] Background task activity indicator visible when subagent tasks are running
- [ ] Activity indicator survives navigation to other views and shows on return
- [ ] Completed background tasks show results (success/failure) when user returns to chat
- [ ] Running tasks show spinner with count ("N tasks running")
- [ ] Activity state derives from DB polling, not React ephemeral state

## Scope Boundaries

**Included:**
- URL param + localStorage persistence for active conversation
- Background task activity indicator (poll-based)
- "While you were away" summary on return
- Graceful fallback for deleted conversations

**Excluded:**
- Conversation pinning or favorites
- Multi-tab conversation sync (WebSocket)
- Deep-link to specific message within conversation
- Real-time streaming reconnection (resuming aborted SSE)
- Task progress percentage (just status: running/completed/failed)
- Notification badges on sidebar for background completions

## References

- Source: `kitchen-sink-03-23.md` — Issue #1 (Chat Conversation Persistence on Navigation)
- Pattern: `board-context-persistence` feature — `usePersistedState` hook
- Related: `chat-data-layer` — conversations and messages DB schema
- Related: `chat-ui-shell` — ChatShell component architecture
- Related: `chat-engine` — SSE streaming and side-channel patterns
