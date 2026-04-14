---
title: Chat — Conversation Branches & Undo/Redo
status: planned
priority: P3
milestone: post-mvp
source: chat-advanced-ux.md §5 (split during grooming, 2026-04-14)
dependencies:
  - chat-conversation-persistence
  - chat-data-layer
---

# Chat — Conversation Branches & Undo/Redo

## Description

Today chat is linear: one conversation, one message chain. When an agent goes down a wrong path, the user either abandons the conversation or lives with the clutter. This feature introduces lightweight **branching**:

- "Branch from here" on any assistant message → creates a child conversation whose prefix is up to that message (inclusive)
- The conversation tree is visible as a compact view in the conversation detail sheet
- `⌘Z` at the chat input when the last turn was an assistant response → marks that turn as rewound (hidden) and re-presents the user's last input pre-filled for editing; `⌘⇧Z` redoes

Branches are forward-only in v1 — no merging. Existing conversations are trivially single-node trees.

## User Story

As a user whose agent just produced a 2000-word response I don't want to discard but also don't want to build on, I want to branch a fresh conversation from my earlier message — keeping the full history accessible in the tree view — so I can explore a different direction without losing context.

## Technical Approach

### Schema extension

`conversations` table gains two nullable columns:

```typescript
parentConversationId: text("parent_conversation_id").references(() => conversations.id),
branchedFromMessageId: text("branched_from_message_id").references(() => messages.id)
```

Both added via `addColumnIfMissing` in `bootstrap.ts` AND the CREATE TABLE block (per MEMORY.md gotcha).

Messages already reference conversation. For branching, child conversations **do not duplicate** prefix messages — they reference the parent. The context-builder loads the prefix by walking `parent → parent.parent → …` up to the branch point.

### Context builder change

`src/lib/chat/context-builder.ts` gains a `loadConversationContext(conversationId)` that:

1. Walks ancestors collecting `(parentId, branchedFromMessageId)` pairs
2. For each ancestor: loads messages WHERE `createdAt ≤ branchedFromMessage.createdAt`
3. Appends the current conversation's messages
4. Returns the flattened list

Bounded depth (say 8 levels) to prevent pathological chains. Exceeds budget → return a truncation notice rather than infinite recursion.

### Branch UX

On any assistant message in the chat stream, hover reveals an action menu with "Branch from here." Click:

1. Prompts for an optional branch title (defaults to `{parent title} — branch`)
2. `POST /api/chat/conversations` with `{ parentConversationId, branchedFromMessageId, title }`
3. Navigates to the new conversation

### Tree view

Conversation detail sheet (right-side) gains a `Branches` tab (only when the conversation has siblings, a parent, or children). Renders a compact indented tree:

```
● Parent title          [open]
  ◆ You are here        (current)
  ◆ Sibling branch      [open]
    ◆ Nested branch     [open]
```

Plain DOM tree, no D3 or canvas. Clicking a node opens that conversation.

### Undo / redo

Per-conversation in-memory stack (no persistence — ephemeral). When the last message is an assistant response and the user presses `⌘Z`:

1. Mark that assistant message + the preceding user message as `rewoundAt: <timestamp>` (new column)
2. Re-populate the composer with the rewound user message text
3. Cursor-focused input at end

Rewound messages render as collapsed gray placeholders with "Rewound · click to restore." `⌘⇧Z` restores the most recent rewound pair.

Rewound messages are excluded from context builder injection (filtered `WHERE rewoundAt IS NULL`). This is the cheap trick that makes undo feel free — no actual delete, just a hidden flag.

### Cross-runtime implications

Every current runtime consumes the context-builder output; they don't need changes. But verify smoke on Claude + Codex + Ollama that rewound + branched contexts are correctly reconstructed (per MEMORY.md smoke-test-budget rule for runtime-registry-adjacent changes).

## Acceptance Criteria

- [ ] Schema migration adds `parentConversationId` + `branchedFromMessageId` to conversations, `rewoundAt` to messages; both via `addColumnIfMissing` + CREATE TABLE
- [ ] `bin/cli.ts` bootstrap seeds CREATE TABLE correctly for new installs
- [ ] "Branch from here" action on assistant messages creates a child conversation
- [ ] Child conversation's context includes prefix messages from ancestor chain
- [ ] Tree view renders on detail sheet when conversation has relatives; hidden otherwise
- [ ] Clicking a tree node navigates to that conversation
- [ ] `⌘Z` marks last turn rewound, pre-fills composer; `⌘⇧Z` restores
- [ ] Rewound messages excluded from context builder (visible to user, invisible to agent)
- [ ] Depth cap (8) returns a truncation notice on degenerate chains
- [ ] Smoke test: branch on Claude, continue, verify full prefix reconstruction
- [ ] Smoke test: branch on Ollama, continue, verify full prefix reconstruction
- [ ] Existing linear conversations render as single-node trees with no UI regression
- [ ] Feature flag `chat.branching.enabled` default off; flip on after v1 validation

## Scope Boundaries

**Included:**
- Branching schema + context walk
- Compact tree view on detail sheet
- `⌘Z` / `⌘⇧Z` rewind/redo
- Feature flag

**Excluded:**
- Branch merging / squashing (forward-only in v1)
- Full-page tree visualization
- Cross-conversation copy/paste
- Persistent undo history across page reloads
- Collaborative branching (not a multi-user product)

## References

- Split from: [chat-advanced-ux](chat-advanced-ux.md) §5 — largest of the 5 sub-features by design surface
- Existing code: `src/lib/chat/context-builder.ts`, `src/lib/db/schema.ts` (conversations + messages), `src/components/chat/`
- MEMORY.md cross-references: `addColumnIfMissing` + CREATE TABLE ordering; runtime-registry-adjacent smoke-test budget
