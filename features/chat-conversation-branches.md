---
title: Chat — Conversation Branches & Undo/Redo
status: in-progress
priority: P3
milestone: post-mvp
source: chat-advanced-ux.md §5 (split during grooming, 2026-04-14)
dependencies:
  - chat-conversation-persistence
  - chat-data-layer
data-layer-shipped: 2026-05-03
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

**Phase 1 — data layer (shipped 2026-05-03):**

- [x] Schema migration adds `parentConversationId` + `branchedFromMessageId` to conversations, `rewoundAt` to messages; both via `addColumnIfMissing` + CREATE TABLE — `src/lib/db/schema.ts:567-602`, `src/lib/db/bootstrap.ts:478-512`, `src/lib/db/bootstrap.ts:354-364`
- [x] `bin/cli.ts` bootstrap seeds CREATE TABLE correctly for new installs (CLI runs the same `bootstrapAinativeDatabase` — bootstrap test pins fresh-DB column presence at `src/lib/db/__tests__/bootstrap.test.ts:57-79`)
- [x] Child conversation's context includes prefix messages from ancestor chain — `getMessagesWithAncestors` at `src/lib/data/chat.ts:362-437` walks ancestors with rowid-based branch-point cutoff; `buildTier1` at `src/lib/chat/context-builder.ts:177-209` consumes it transparently
- [x] Rewound messages excluded from context builder (visible to user, invisible to agent) — `markPairRewound` + `restoreLatestRewoundPair` at `src/lib/data/chat.ts:444-548`; ancestor walk filters `WHERE rewoundAt IS NULL`; verified at `src/lib/chat/__tests__/context-builder-branching.test.ts:84-106`
- [x] Depth cap (8) returns a truncation notice on degenerate chains — `MAX_BRANCH_DEPTH=8` at `src/lib/data/chat.ts:21`; synthetic system note injected at `src/lib/chat/context-builder.ts:201-208`; covered by `src/lib/chat/__tests__/context-builder-branching.test.ts:108-130`
- [x] Existing linear conversations behave identically — no parent → ancestor walk degenerates to a single-conv read; verified at `src/lib/chat/__tests__/context-builder-branching.test.ts:30-49`
- [x] Feature flag `chat.branching.enabled` default off — `isBranchingEnabled()` at `src/lib/chat/branching/flag.ts:21`; canonical-true-only check pinned at `src/lib/chat/branching/__tests__/flag.test.ts`
- [x] POST `/api/chat/conversations` accepts `parentConversationId` + `branchedFromMessageId` with strict pair validation — `src/app/api/chat/conversations/route.ts:46-90`

**Phase 2 — UI + cross-runtime smoke (deferred):**

- [ ] "Branch from here" action on assistant messages creates a child conversation
- [ ] Tree view renders on detail sheet when conversation has relatives; hidden otherwise
- [ ] Clicking a tree node navigates to that conversation
- [ ] `⌘Z` marks last turn rewound, pre-fills composer; `⌘⇧Z` restores
- [ ] Smoke test: branch on Claude, continue, verify full prefix reconstruction
- [ ] Smoke test: branch on Ollama, continue, verify full prefix reconstruction
- [ ] Existing linear conversations render as single-node trees with no UI regression

## Design Decisions (2026-05-03 — Phase 1)

**DD-1. Phased ship: data layer now, UI deferred.** The spec ACs span schema + data + UI + cross-runtime smoke — a 2-3 day surface. The previous handoff scoped this for "a contained chat-data-layer change" and the project's prior pattern (see `composed-app-manifest-authoring-tools` DD-1) supports shipping the standalone foundation with UI deferred when the standalone is itself reusable. The data layer landing is fully tested and gated behind a default-off feature flag (`AINATIVE_CHAT_BRANCHING`) so it's safe to ship without UI: existing linear conversations behave identically; new schema columns are nullable; ancestor walk degenerates to a single-conversation read for non-branched conversations. Spec stays `status: in-progress` to reflect that UI is the next ship.

**DD-2. Branch-point cutoff uses SQLite rowid, not createdAt.** The schema's `chat_messages.createdAt` uses Drizzle `mode: "timestamp"` which rounds to seconds. Same-second insertions can't be ordered reliably by timestamp (caught by tests). SQLite's implicit `rowid` is monotonically assigned at INSERT, unique per row, and exactly the property the cutoff needs ("at-or-before this message in insertion order"). The ancestor walk uses `sql\`rowid <= (SELECT rowid FROM chat_messages WHERE id = …)\`` for the cutoff and `ORDER BY rowid` for output ordering. Production chat naturally spans seconds, so this matches createdAt ordering in practice; for tight test loops it produces correct results too.

**DD-3. `rewoundAt` uses `timestamp_ms`, not `timestamp`.** Pair-marking writes the same timestamp to both messages in a (user, assistant) pair, and `restoreLatestRewoundPair` identifies the most-recent pair by exact timestamp match. Two rewind actions can fire well within the same second; `mode: "timestamp"` (seconds) would collapse them into one pair. `rewoundAt` is a brand-new column with no existing data, so the millisecond precision is safe to choose without a migration. Other datetime columns retain seconds resolution to avoid touching legacy data.

**DD-4. Replace, don't merge, on `markPairRewound` and `restoreLatestRewoundPair`.** Both functions update entire `(user, assistant)` pairs atomically. Partial-pair states ("user rewound, assistant live") would confuse the UI and the agent. The spec frames undo as a turn-level operation, so the data layer enforces turn-level atomicity.

**DD-5. Self-referential FKs declared at the SQL level only, not in Drizzle column refs.** `parent_conversation_id` (self-FK) and `branched_from_message_id` (forward-ref FK to chat_messages) work fine as plain TEXT columns at the SQLite level; the validation that "parent exists" + "branchedFrom belongs to parent" lives in the API route. This matches the existing pattern in this schema (`active_skill_id` has no `.references()` either) and avoids Drizzle's circular-typeref complexity.

**DD-6. Synthetic system note for depth-cap truncation.** When the branch chain exceeds `MAX_BRANCH_DEPTH=8`, the context builder prepends a `role: "system"` note ("…branch ancestry exceeded 8 levels — older context has been truncated. The user is aware."). This is a Tier 1 (history) injection rather than a Tier 0 (system prompt) addition because the note should land at the start of conversation context, not in the persistent system identity.

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
