# Handoff: `chat-conversation-branches` Phase 1 (data layer) shipped — net-new P3 spec roster is empty

**Created:** 2026-05-03 (build session — `chat-conversation-branches` Phase 1)
**Status:** Working tree has uncommitted edits across 8 modified files + 4 new files (1 module + 4 test files). 12 files total. Ready to commit.
**Predecessor:** previous handoff was the `composed-app-manifest-authoring-tools` build session (committed in `712fe62c`, pushed to `origin/main`).

---

## TL;DR for the next agent

1. **Real build session, Phase 1 of 2.** All 8 data-layer ACs shipped with file:line evidence; 7 UI/cross-runtime smoke ACs explicitly deferred to Phase 2. Spec moved `planned` → `in-progress` (NOT `completed`) — half the ACs remain. Per CLAUDE.md commit style: `feat(chat)` is correct because the visible end-product (after Phase 2) is a chat-runtime feature.

2. **The net-new spec roster is now empty.** Every spec in `features/` is either `completed`, `in-progress` (gap-closure work), or `deferred`. There are no fully-planned greenfield specs left. The next session has 3 reasonable shapes:

   | Option | Scope | Why pick |
   |---|---|---|
   | **Phase 2 of `chat-conversation-branches`** | UI: Branch action, tree tab, ⌘Z/⌘⇧Z, cross-runtime smoke | Closes the spec we just half-finished. Data layer is fully tested + waiting; flag is wired. |
   | **An in-progress P1 closeout** | `upgrade-session` (dedicated session sheet, upgrade history, abort confirmation, dev-server restart banner) OR `workflow-document-pool` | Highest priority work. `upgrade-session` was on the predecessor's "in-progress closeouts" list. |
   | **Roadmap drift cleanup** | Reconcile spec frontmatter vs roadmap rows for the 4 in-progress drift cases (predecessor noted `composed-app-auto-inference-hardening` specifically) | Cheap meta-work that improves later signal. Could be a 30-minute warm-up before a bigger ship. |

   **Recommended next:** Phase 2 of `chat-conversation-branches`, while the data layer is fresh. The flag is in place; the data layer is fully tested; the only missing piece is UI wiring. Cross-runtime smoke is one quick run on each of Claude / Codex / Ollama once the UI is in.

3. **CLAUDE.md runtime-registry smoke gate did not trigger this session.** The chat tools register through the existing `defineTool` pattern via `ainative-tools.ts`. The only runtime-graph touch is `context-builder.ts` swapping `getMessages` for `getMessagesWithAncestors` — same module, same call shape, no imports added/removed under `src/lib/agents/runtime/` or `claude-agent.ts`. Smoke is reasonable to skip until Phase 2 lands UI changes.

4. **Two follow-ups worth tracking** (both honest, both deferred from this session):
   - **Phase 2 UI work** — see the spec's deferred-AC list at `features/chat-conversation-branches.md` "Phase 2 — UI + cross-runtime smoke (deferred)". Components needed: hover action menu on `chat-message.tsx`, branches tab on conversation detail sheet, ⌘Z/⌘⇧Z keybindings on `chat-input.tsx`, rewound-message render component. Possible new data-layer primitive: `getConversationTreeRoot(id)` for the tree view (deferred until UI shows it's actually needed).
   - **Roadmap-vs-spec status drift** — predecessor noted this for `composed-app-auto-inference-hardening` (spec says `in-progress`, roadmap row says `planned`). My run confirms this affects others too — the roadmap shows 8 `| planned |` entries but several of those are spec-frontmatter `in-progress`. Worth a 30-min reconciliation pass.

---

## What landed this session

Uncommitted in working tree (12 files):

- `src/lib/db/schema.ts` — added 2 columns to `conversations` (`parentConversationId` + `branchedFromMessageId`) and 1 column to `chatMessages` (`rewoundAt`, mode `timestamp_ms`). Added `idx_conversations_parent_id` index.
- `src/lib/db/bootstrap.ts` — CREATE TABLE blocks for both tables updated with the new columns + index. `addColumnIfMissing` ALTERs added for legacy DB upgrade path. Caught a real bug mid-session: separate `CREATE INDEX` outside the CREATE TABLE block ran before the table existed on fresh DBs (because addColumnIfMissing precedes CREATE TABLE in bootstrap order — the documented MEMORY.md gotcha). Fixed by keeping the CREATE INDEX only inline in the CREATE TABLE block.
- `src/lib/db/__tests__/bootstrap.test.ts` — 2 new tests: fresh-DB column presence, legacy-DB upgrade via addColumnIfMissing. Existing migration-recovery test still green.
- `src/lib/data/chat.ts` — extended `CreateConversationInput` + `createConversation` with parent fields. Added `MAX_BRANCH_DEPTH=8`, `getMessagesWithAncestors` (rowid-based branch-point cutoff per DD-2), `markPairRewound`, `restoreLatestRewoundPair`. Switched `lt` → `lte` on prior-user lookup (caught by tests — same-millisecond timestamps without role filter).
- `src/lib/data/__tests__/branching.test.ts` — new file, 10 tests covering create-with-parent, ancestor walk on linear + 1-deep + 2-deep branches, rewound filtering across layers, depth-cap, role-validation on rewind, restore-most-recent-pair, restore-no-op.
- `src/lib/chat/context-builder.ts` — `buildTier1` now calls `getMessagesWithAncestors` instead of `getMessages`. Linear conversations behave identically (no parent → walk degenerates to single-conv read with `rewoundAt IS NULL` filter that's no-op for never-rewound rows). Depth-cap synthetic system note prepended when chains exceed 8 (DD-6).
- `src/lib/chat/__tests__/context-builder-branching.test.ts` — new file, 4 tests: linear baseline, branch reconstruction, rewound exclusion, depth-cap notice.
- `src/lib/chat/__tests__/active-skill-injection.test.ts` — added `getMessagesWithAncestors` + `MAX_BRANCH_DEPTH` to the existing `vi.mock("@/lib/data/chat", ...)`. Was failing the full vitest sweep until I extended the mock.
- `src/app/api/chat/conversations/route.ts` — POST extended to accept `parentConversationId` + `branchedFromMessageId`. Strict pair validation: both required together (400), parent must exist (404), branch-point message must belong to the parent (400).
- `src/app/api/chat/conversations/__tests__/branching.test.ts` — new file, 6 tests covering happy path + 4 validation paths + linear-baseline preserved.
- `src/lib/chat/branching/flag.ts` + `__tests__/flag.test.ts` — new module + 3 tests. `isBranchingEnabled()` reads `AINATIVE_CHAT_BRANCHING === "true"` (canonical-true-only; rejects truthy variants).
- `src/components/chat/chat-session-provider.tsx` — added `rewoundAt: null` to 3 ChatMessage object literals (user optimistic, assistant placeholder, system permission/question). Caught by tsc — non-optional on the new schema row type.
- `features/chat-conversation-branches.md` — `status: planned` → `status: in-progress`. Added `data-layer-shipped: 2026-05-03`. ACs split into Phase 1 (8 shipped with file:line evidence) + Phase 2 (7 deferred). 6 Design Decisions appended.
- `features/roadmap.md` — `chat-conversation-branches` row flipped `planned` → `in-progress`.
- `features/changelog.md` — prepended top-level entry with implementation summary, file:line evidence, verification numbers, DD summaries, deferral list, and roadmap impact note.
- `HANDOFF.md` — this file.
- `.archive/handoff/2026-05-03-composed-app-manifest-authoring-tools.md` — predecessor handoff archived.

### Net effect on roadmap

| Status | Before | After |
|---|---|---|
| in-progress | 0 | 1 |
| planned (P3) | 1 | 0 |

(completed and other-priority planned counts unchanged.)

### Test surface verified

- 25 new tests across 5 new test files (10 + 4 + 6 + 3 + 2 added to existing bootstrap test = 25 net-new) — **all passing**.
- `npx vitest run src/lib/db src/lib/data src/lib/chat src/app/api/chat src/components/chat` — **402/402 pass across 49 files** (zero regressions in the touched-module sweep).
- `npx tsc --noEmit` — **clean project-wide** (zero errors).
- Pre-existing baseline failures (router.test.ts, settings.test.ts, blueprint.test.ts) confirmed unchanged via stash + re-run on `712fe62c`.

---

## Patterns reinforced this session

- **Phased ship for spec-broad-than-session features.** Spec called for ~12 ACs spanning data + UI + cross-runtime smoke; this session shipped only the data layer with the spec staying `in-progress`. Matches DD-1 from the predecessor session ("Build the standalone, defer the integration when honest"). Pattern is: ship the foundation cleanly with comprehensive tests, defer the consumer layer to a follow-up where the consumer has clearer requirements.

- **Tests caught a real timestamp-resolution bug at the schema boundary.** Drizzle's `mode: "timestamp"` rounds to seconds — fine for chat conversations spanning seconds, broken for tight test loops where multiple messages share a millisecond. Two clean fixes: (1) `rewoundAt` uses `mode: "timestamp_ms"` (new column, no migration risk); (2) ancestor-walk branch-point cutoff uses SQLite's implicit `rowid` instead of `createdAt` (monotonic per-INSERT, unique, immune to timestamp resolution). The lesson is to write the test FIRST; the obvious-looking implementation often hides resolution assumptions.

- **MEMORY.md gotcha enforced again — addColumnIfMissing precedes CREATE TABLE on fresh DBs.** I added a `CREATE INDEX` next to the addColumnIfMissing block; tests caught it failing on fresh DBs because the table didn't exist yet. Fixed by keeping the CREATE INDEX only inline in the CREATE TABLE block — `IF NOT EXISTS` makes it a safe no-op for legacy DBs that re-run bootstrap. Pattern: any standalone DDL that references a table by name has to live AFTER the CREATE TABLE block, not before it. Inline DDL inside the CREATE TABLE block is always safe.

- **Self-referential FKs as plain TEXT, not Drizzle `.references()`.** Matches existing schema pattern (`active_skill_id` does the same). Pair validation lives in the API route. Avoids Drizzle's circular-typeref complexity and works fine because the actual safety comes from the route-level check.

- **Bootstrap-test legacy-DB simulation pattern.** Created a manual pre-feature CREATE TABLE (without the new columns), ran `bootstrapAinativeDatabase`, then asserted `addColumnIfMissing` added the new columns. This is a strict improvement over "just test fresh DB" — catches the upgrade path that's most likely to break in production.

---

## How to commit this session's work

```
git add features/chat-conversation-branches.md \
        features/roadmap.md \
        features/changelog.md \
        src/lib/db/schema.ts \
        src/lib/db/bootstrap.ts \
        src/lib/db/__tests__/bootstrap.test.ts \
        src/lib/data/chat.ts \
        src/lib/data/__tests__/branching.test.ts \
        src/lib/chat/context-builder.ts \
        src/lib/chat/__tests__/context-builder-branching.test.ts \
        src/lib/chat/__tests__/active-skill-injection.test.ts \
        src/lib/chat/branching/flag.ts \
        src/lib/chat/branching/__tests__/flag.test.ts \
        src/app/api/chat/conversations/route.ts \
        src/app/api/chat/conversations/__tests__/branching.test.ts \
        src/components/chat/chat-session-provider.tsx \
        HANDOFF.md \
        .archive/handoff/2026-05-03-composed-app-manifest-authoring-tools.md
git commit -m "feat(chat): ship chat-conversation-branches Phase 1 (data layer)"
```

Single commit captures the full Phase 1 close-out — schema + bootstrap + data-layer primitives + context-builder integration + API route + feature flag + 25 new tests + spec/roadmap/changelog/handoff. Per CLAUDE.md commit style: `feat(chat)` is correct because the eventual user-visible change is a chat feature; tagging by the Phase 1 module would obscure that.

---

*End of handoff. Next move: Phase 2 UI for `chat-conversation-branches` (branch action + tree tab + ⌘Z/⌘⇧Z + cross-runtime smoke), OR pick up an in-progress P1 like `upgrade-session`. Either is reasonable; Phase 2 keeps the data-layer momentum.*
