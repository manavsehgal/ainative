# Handoff: `chat-conversation-branches` Phase 2 (UI + Claude smoke) shipped — net-new planned-spec roster empty again

**Created:** 2026-05-03 (build session — `chat-conversation-branches` Phase 2)
**Status:** Working tree has uncommitted edits across ~22 files (12 new + ~10 modified). Ready for a single Phase 2 commit.
**Predecessor:** Phase 1 handoff archived at `.archive/handoff/2026-05-03-chat-conversation-branches-phase-1.md` (Phase 1 was committed as `4b080ccd` earlier today).

---

## TL;DR for the next agent

1. **Phase 2 is fully done end-to-end except one structural deferral.** All 6 of 7 Phase 2 ACs landed with file:line evidence and a real Claude smoke run. AC #6 (Ollama smoke) is deferred with a written rationale in the spec — Ollama is not exposed as a chat-model option today (only at the agent-runtime layer for tasks/workflows). The spec is now `status: completed`. Plan at `docs/superpowers/plans/2026-05-03-chat-conversation-branches-phase-2.md`.

2. **Smoke caught a real client-side bug — fixed and codified as DD-9.** Optimistic user messages keep their `crypto.randomUUID()` id forever after `sendMessage`; only the assistant id is reconciled to the server's id via SSE `done`. So when `restoreLatestRewoundPair` returned server-assigned ids, the optimistic clear by id matched only the assistant. Fix: refetch messages after rewind/redo POST. One extra round-trip, robust against future state drift. Caught only because the smoke run actually drove the keybindings — unit tests structurally couldn't have caught it (they don't simulate the streaming-handshake id-assignment lifecycle).

3. **The net-new planned-spec roster is empty again.** Same options as the predecessor handoff — pick a P1 in-progress closeout (`upgrade-session`, `workflow-document-pool`), do roadmap-vs-spec drift cleanup, or pick up something net-new from grooming. No spec-frontmatter `status: planned` features remain in `features/`.

   **Recommended next:** `upgrade-session` was on the predecessor's "in-progress closeouts" list. Otherwise, a 30-minute roadmap-vs-spec drift reconciliation pass would clear up the spec frontmatter staleness predecessors flagged.

4. **CLAUDE.md runtime-registry smoke gate did not trigger this session.** No imports added/removed under `src/lib/agents/runtime/` or `claude-agent.ts`. The Phase 2 work is purely above the runtime layer — chat-input keybinding, provider state, dialog component, three thin API routes. Smoke ran against Claude anyway because spec AC #5 required it (different smoke gate — spec-driven, not runtime-cycle-driven).

---

## What landed this session

Uncommitted in working tree (~22 files):

### New API routes + tests (8 files)

- `src/app/api/chat/branching/flag/route.ts` + `__tests__/route.test.ts` — GET → `{ enabled }`. 3 tests.
- `src/app/api/chat/conversations/[id]/branches/route.ts` + `__tests__/route.test.ts` — GET → `{ family }`. 3 tests.
- `src/app/api/chat/conversations/[id]/rewind/route.ts` + `__tests__/route.test.ts` — POST `{ assistantMessageId }` → `{ rewoundUserContent }`. 4 tests.
- `src/app/api/chat/conversations/[id]/redo/route.ts` + `__tests__/route.test.ts` — POST → `{ restoredMessageIds }`. 4 tests.

### New components + tests (4 files)

- `src/components/chat/branch-action-button.tsx` + `__tests__/branch-action-button.test.tsx` — hover button + dialog. 3 tests.
- `src/components/chat/branches-tree-dialog.tsx` + `__tests__/branches-tree-dialog.test.tsx` — indented tree. 4 tests.

### New tests (component-side coverage)

- `src/components/chat/__tests__/chat-message-branching.test.tsx` — branch button + rewound rendering. 4 tests.
- `src/components/chat/__tests__/chat-input-rewind.test.tsx` — ⌘Z / ⌘⇧Z keybindings. 4 tests.

### Modified files

- `src/lib/data/chat.ts` — added `getConversationFamily(conversationId)` (root walk + BFS-down).
- `src/lib/data/__tests__/branching.test.ts` — added 4 family tests.
- `src/components/chat/chat-session-provider.tsx` — added `branchingEnabled` state + flag fetch; added `rewindLastTurn`, `restoreLastRewoundPair`, `branchConversation` actions; refetch-after-mutation pattern (DD-9 fix).
- `src/components/chat/__tests__/chat-session-provider.test.tsx` — extended Consumer probe with `branchingEnabled`; added 2 flag-fetch tests.
- `src/components/chat/chat-message.tsx` — rewound placeholder rendering; branch button gated on flag + assistant + completed.
- `src/components/chat/__tests__/chat-message-extension-fallback.test.tsx` — added `useChatSession` mock (now required since chat-message reads from session).
- `src/components/chat/chat-input.tsx` — moved `handleInput` declaration above `handleKeyDown`; added ⌘Z / ⌘⇧Z handlers.
- `src/components/chat/conversation-list.tsx` — added `branchingEnabled`/`hasRelatives`/`onViewBranches` props; "View branches" dropdown item.
- `src/components/chat/chat-shell.tsx` — `hasRelatives` derived from conversations; `branchesDialogId` state; renders `BranchesTreeDialog`.
- `features/chat-conversation-branches.md` — Phase 2 ACs flipped (1 deferred); 4 new design decisions (DD-7..DD-10); Verification section appended.
- `features/roadmap.md` — `chat-conversation-branches` row `in-progress` → `completed`.
- `features/changelog.md` — Phase 2 entry prepended above Phase 1.
- `HANDOFF.md` — this file.
- `.archive/handoff/2026-05-03-chat-conversation-branches-phase-1.md` — predecessor archived.
- `docs/superpowers/plans/2026-05-03-chat-conversation-branches-phase-2.md` — implementation plan.

### Net effect on roadmap

| Status | Before | After |
|---|---|---|
| in-progress | 1 | 0 |
| completed (P3) | n | n+1 |

### Test surface verified

- 29 new tests across 8 new test files; 4 added to existing `branching.test.ts`; 2 added to existing `chat-session-provider.test.tsx`. Total Phase 2: ~35 net-new tests.
- `npx vitest run src/lib/db src/lib/data src/lib/chat src/app/api/chat src/components/chat` — **437/437 pass across 57 files** (zero regressions in the touched-module sweep).
- `npx tsc --noEmit` — **clean project-wide** (zero errors).
- **Claude smoke (2026-05-03):** branched a Claude `claude-opus-4-6` conversation; verified prefix reconstruction (model answered "Yellow" given a branch with no other context), ⌘Z rewound + composer pre-fill, ⌘⇧Z restored both messages, tree dialog rendered + navigation worked, linear-conversation regression check clean.

---

## Patterns reinforced this session

- **Smoke-test budget pays off even when the runtime-registry gate doesn't trigger.** The gate is for module-load cycles in agent runtime modules — none touched here. But the spec required cross-runtime smoke for behavior-correctness reasons (does branching reach the model?). Running the smoke caught a client-side staleness bug (DD-9) that 437 unit tests didn't surface, because unit tests don't simulate the SSE `done`-event id-reconciliation lifecycle. Lesson: when a feature crosses optimistic-state + server-state boundaries, smoke isn't optional even if module imports look safe.

- **Refetch-after-mutation > id-based optimistic clears for persisted chat state.** Tried optimistic-by-id first; tripped on a pre-existing client-side id staleness in `sendMessage`. Refetch converges client to DB truth in one round-trip and is robust against future state drift. The cost (extra GET) is negligible for chat where users naturally pause between turns.

- **Replace-not-invent for UI patterns.** Spec said "conversation detail sheet with Branches tab"; codebase had no such sheet. Reused the existing row dropdown menu pattern (Rename/Delete + new "View branches" item → opens a Dialog). Same user value, no one-off pattern. Codified as DD-7. Pattern: when a spec assumes a UI affordance that doesn't exist, scope-challenge it before building the affordance from scratch.

- **Server-side flag exposure via tiny GET route, not `NEXT_PUBLIC_*`.** Keeps the env var server-only. Matches the existing one-shot fetch pattern (`/api/settings/chat`, `/api/chat/models`). Codified as DD-8. Useful pattern for any feature with a runtime flag whose flip-state should not be visible to all clients regardless of the flag's value.

- **Keybindings scoped to the input that owns them, not `window`.** `⌘Z` is registered on the textarea's `onKeyDown` — fires only when the composer has focus. Matches spec intent and avoids hijacking OS undo elsewhere on the page (e.g., when editing the conversation title or typing in a form). Codified as DD-10.

---

## How to commit this session's work

```
git add features/chat-conversation-branches.md \
        features/roadmap.md \
        features/changelog.md \
        src/lib/data/chat.ts \
        src/lib/data/__tests__/branching.test.ts \
        src/app/api/chat/branching/flag/route.ts \
        src/app/api/chat/branching/flag/__tests__/route.test.ts \
        src/app/api/chat/conversations/\[id\]/branches/route.ts \
        src/app/api/chat/conversations/\[id\]/branches/__tests__/route.test.ts \
        src/app/api/chat/conversations/\[id\]/rewind/route.ts \
        src/app/api/chat/conversations/\[id\]/rewind/__tests__/route.test.ts \
        src/app/api/chat/conversations/\[id\]/redo/route.ts \
        src/app/api/chat/conversations/\[id\]/redo/__tests__/route.test.ts \
        src/components/chat/chat-session-provider.tsx \
        src/components/chat/__tests__/chat-session-provider.test.tsx \
        src/components/chat/branch-action-button.tsx \
        src/components/chat/__tests__/branch-action-button.test.tsx \
        src/components/chat/branches-tree-dialog.tsx \
        src/components/chat/__tests__/branches-tree-dialog.test.tsx \
        src/components/chat/chat-message.tsx \
        src/components/chat/__tests__/chat-message-branching.test.tsx \
        src/components/chat/__tests__/chat-message-extension-fallback.test.tsx \
        src/components/chat/chat-input.tsx \
        src/components/chat/__tests__/chat-input-rewind.test.tsx \
        src/components/chat/conversation-list.tsx \
        src/components/chat/chat-shell.tsx \
        docs/superpowers/plans/2026-05-03-chat-conversation-branches-phase-2.md \
        HANDOFF.md \
        .archive/handoff/2026-05-03-chat-conversation-branches-phase-1.md
git commit -m "feat(chat): ship chat-conversation-branches Phase 2 (UI + Claude smoke)"
```

Single bisectable commit captures the full Phase 2 close-out — 3 new API routes + tests, 2 new components + tests, 2 new component-test files, provider extension, ChatMessage rewound rendering, ChatInput keybindings, ConversationList "View branches" item, ChatShell wiring, spec ACs flipped, roadmap row updated, changelog entry, plan, handoff archive + new handoff. Per CLAUDE.md commit style: `feat(chat)` is correct because the user-visible feature is the chat branching surface.

---

*End of handoff. Three reasonable next moves:*

1. ***P1 in-progress closeout — `upgrade-session`*** (was on predecessor's list): dedicated session sheet, upgrade history, abort confirmation, dev-server restart banner.
2. ***P1 in-progress closeout — `workflow-document-pool`*** (also on predecessor's list).
3. ***Roadmap-vs-spec drift reconciliation*** (~30 min): predecessor noted `composed-app-auto-inference-hardening` specifically; my session confirms others may have drifted (spec frontmatter `in-progress` while roadmap row says `planned`). Would improve later signal for the planned-spec grep heuristic.

*If picking a roadmap option: skim the predecessor handoff for the recommended closeout sequence.*
