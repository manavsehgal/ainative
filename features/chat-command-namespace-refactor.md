---
title: Chat — Command Namespace Refactor (/ = verbs, @ = nouns)
status: completed
priority: P1
milestone: post-mvp
source: ideas/chat-context-experience.md §5, §8 Phase 3, §11 (frontend-designer), Q7, Q9
dependencies: [chat-claude-sdk-skills, chat-file-mentions, runtime-capability-matrix, command-palette-enhancement]
---

# Chat — Command Namespace Refactor (/ = verbs, @ = nouns)

## Description

ainative chat's current `/` popover mixes verbs and nouns: "new task" sits next to "list tasks" sits next to "researcher profile" sits next to 88 ainative MCP tools grouped by function. As Phase 1a/1b/1c introduce filesystem skills, filesystem tools, and (via `chat-file-mentions`) file references through `@`, the current mental model will strain — over 200 items across ambiguous categories.

This feature refactors the command UX around a clean split: `/` is for **actions** (skills, session commands, ainative primitives, filesystem tools) and `@` is for **references** (ainative entities + files). The `/` popover becomes tabbed (Actions / Skills / Tools / Files / Entities) with environment-aware skill badges (health, profile link, cross-tool sync). A `⌘K` global command palette gives power users terminal-speed access. A new capability hint banner below the chat input resolves Q9a: when the active runtime can't do X/Y/Z, the banner says so in plain text without littering the popover with disabled rows.

ainative is alpha, so per Q7 we accept this as a breaking UX change and skip the deprecation shim.

**Design sign-off required:** this spec must be reviewed by `/frontend-designer` before implementation begins — it introduces a new `CommandTabBar` component and touches the primary input surface.

## User Story

As a ainative user who wants to discover what I can do, I want a predictable command system where `/` does things and `@` names things, grouped by category, so I can build muscle memory that transfers between chat, the CLI, and the command palette.

## Technical Approach

### 1. Split verbs from nouns

Move every noun-like entry out of the `/` popover and into the `@` popover: profiles (ainative registry profiles acting as references), document references, table references, etc. Anything that "names a thing" belongs under `@`; anything that "performs an action" belongs under `/`.

### 2. `/` tab structure

`src/components/chat/chat-command-popover.tsx` grows a tabbed structure via a new `CommandTabBar` component that matches the existing Sheet/Dialog visual patterns (per frontend-designer §11):

- **Actions** — `/new-task`, `/new-workflow`, `/new-schedule`, `/clear`, `/compact`, `/export`, `/help`, `/settings`
- **Skills** — filesystem skills with environment badges (from `chat-environment-integration`)
- **Tools** — filesystem/system tools (`Read`, `Write`, `Grep`, `Bash`, `TodoWrite`) — visible by default only in an "Advanced" reveal for CLI refugees
- **Entities** — (lightweight cross-link back to `@`; not the primary surface for entities)

Tab selection persists per user (localStorage) so the first tab the user landed on last time is opened first.

### 3. `@` popover (extended by `chat-file-mentions`)

Recent + pinned → By type → Search fuzzy, as described in §5.3 of the ideas doc. File completion lands when `chat-file-mentions` is done. This feature provides the popover structure; file completion is wired in parallel.

### 4. Capability hint banner (Q9a)

Below the chat input, render a single-line subtext derived from `runtime-capability-matrix`:

- Claude runtime: no banner (full capability)
- Codex runtime: no banner (full capability)
- Ollama runtime: "Features like file read/write, Bash, and hooks are not available on this runtime. Switch models to use them."

The banner uses `text-muted-foreground`, is dismissible per session, and auto-updates on model change.

### 5. `⌘K` global command palette

Integrate with `command-palette-enhancement` (already completed). `⌘K` opens the palette with unified items — actions, entities, files, skills — fuzzy-searchable together, independent of the chat input's `/@` popovers. Useful for users outside the chat view.

### 6. Keyboard shortcuts

Implement the full shortcut table from §5.5:

| Shortcut | Action |
|---|---|
| `/` | Open slash popover |
| `@` | Open at popover |
| `⌘K` | Open command palette (global) |
| `⌘/` | Focus chat input from anywhere |
| `↑/↓` | Navigate popover |
| `Tab` / `Enter` | Select |
| `Esc` | Close popover |
| `⌘L` | `/clear` shortcut |
| `⌘⏎` | Send message |

### 7. Visual / motion calibration (frontend-designer §11)

Per taste metrics: **DESIGN_VARIANCE 3-4**, **MOTION_INTENSITY 2**, **VISUAL_DENSITY 7**. StatusChip used for skill badges (5 families). Monospace for file paths. Fade-in only, no bouncy animations. Keyboard-first with full focus trap and ARIA labels on tabs + items.

### 8. Session commands

- `/clear` — starts a new conversation (matches UI "New conversation" button)
- `/compact` — replaces existing auto-compact UI button trigger
- `/export` — sends current conversation to the document pool
- `/new-task`, `/new-workflow`, `/new-schedule` — inline ainative primitive creators

## Acceptance Criteria

- [ ] `/` popover is tabbed with Actions / Skills / Tools / Entities categories
- [ ] `@` popover supports all existing entity types plus the file category (from `chat-file-mentions`)
- [ ] Skills tab renders environment-aware badges (health, profile linkage, sync status) via `chat-environment-integration`
- [ ] Tools tab is hidden behind an "Advanced" reveal by default
- [ ] New `/` action commands (`/new-task`, `/new-workflow`, `/new-schedule`, `/clear`, `/compact`, `/export`, `/help`, `/settings`) are implemented and executable
- [ ] Capability hint banner renders below the chat input when the active runtime lacks capabilities (Ollama); silent on Claude/Codex
- [ ] `⌘K` opens the global command palette with unified items
- [ ] All shortcuts in §5.5 are bound
- [ ] `CommandTabBar` component follows the Sheet/Dialog visual language and is keyboard-accessible (arrow keys, focus trap, ARIA labels)
- [ ] Taste metrics verified: DV 3-4, MI 2, VD 7 (popover shows 10-12 items at once with inline hints)
- [ ] `/frontend-designer` sign-off recorded in the PR description
- [ ] Breaking UX change called out in the changelog entry per Q7

## Scope Boundaries

**Included:**
- Tabbed `/` popover with new category structure
- New `CommandTabBar` component
- Action commands (ainative primitives + session commands)
- Capability hint banner
- `⌘K` global command palette integration
- Full keyboard shortcut table from §5.5

**Excluded:**
- `#` filter namespace — covered by `chat-advanced-ux`
- Environment metadata backing for skill badges — covered by `chat-environment-integration`
- File completion under `@` — covered by `chat-file-mentions` (this feature provides the popover structure; file logic is wired when that feature lands)
- Migration shim for the old popover (Q7: alpha product, breaking change accepted)

## References

- Source: `ideas/chat-context-experience.md` §5 (entire section), §8 Phase 3, §11 (frontend-designer), Q7, Q9
- Depends on: `chat-claude-sdk-skills` (skills surface), `chat-file-mentions` (file surface under `@`), `runtime-capability-matrix` (banner + tool visibility), `command-palette-enhancement` (⌘K foundation)
- Existing code: `src/components/chat/chat-command-popover.tsx`, `src/hooks/use-chat-autocomplete.ts`, `src/components/chat/chat-input.tsx`, `src/components/shared/app-sidebar.tsx`
- Design: taste metrics DV 3-4, MI 2, VD 7 per `.claude/skills/taste/SKILL.md`
- Memory: MEMORY.md "SheetContent body padding" convention applies to any new Sheet-based surfaces

## Verification — 2026-04-14

### What shipped
- `src/lib/chat/command-tabs.ts` — pure partition model, 4 tabs (Actions / Skills / Tools / Entities), `GROUP_TO_TAB` exhaustively mapped via `satisfies Record<ToolGroup, CommandTabId>`.
- `src/components/chat/command-tab-bar.tsx` — `role=tablist` with arrow-key nav, roving tabindex, ARIA labels.
- `src/components/chat/chat-command-popover.tsx` — tabbed slash mode, single `<Command>` root preserved (avoids focus-state loss on tab switch). Entities tab renders a pointer to `@`.
- `src/components/chat/capability-banner.tsx` — single-line `role=status` banner, per-runtime `sessionStorage` dismissal. Hidden on `claude-code`/`openai-codex-app-server`; visible on `ollama`/`anthropic-direct`/`openai-direct`.
- `src/components/chat/help-dialog.tsx` — keyboard shortcut dialog rendered from the session provider; opens via `ainative.chat.help` CustomEvent.
- `src/app/api/chat/export/route.ts` — NEW endpoint that writes inline markdown to `~/.ainative/uploads/chat-exports/<name>.md` and inserts a documents row with `direction: "output"`, `source: "chat-export"`.
- `src/components/chat/chat-session-provider.tsx` — wires `ainative.chat.{clear,compact,export,help}` CustomEvents. `/compact` currently shows a "coming soon" toast (no compact machinery yet).
- `src/components/chat/chat-input.tsx` — dispatches session commands via CustomEvents; derives runtime via `resolveAgentRuntime(getRuntimeForModel(modelId))`; binds `⌘L` / `⌘⇧L` (clear) and `⌘/` (focus + slash).
- `src/components/shared/command-palette.tsx` — ⌘K palette extended with Skills (guarded by `skills.length > 0`) and Files (debounced 200ms search against `/api/chat/files/search`).
- 8 new session commands in `tool-catalog.ts` under a new `Session` group: `clear`, `compact`, `export`, `help`, `settings`, `new-task`, `new-workflow`, `new-schedule`.

### Tests
- 22 new unit tests across `command-tabs`, `use-chat-autocomplete-tabs`, and `capability-banner`.
- Full suite: 897 passing / 12 skipped / 1 pre-existing e2e (needs running server).
- `npx tsc --noEmit` clean.

### `/frontend-designer` sign-off
Reviewed against Calm Ops design system + DV 3-4 / MI 2 / VD 7 taste metrics. Verdict: ✅ APPROVED WITH MINOR NOTES. All 3 non-debatable findings addressed in commit `571d685`:
- popover: dropped `zoom-in-95 slide-in-from-bottom-2` (MI=2 target is fade-only)
- capability-banner: added `focus-visible:ring-2 focus-visible:ring-ring` to dismiss button
- help-dialog: dropped redundant `px-6 pb-6` (DialogContent already applies `p-6`)

Two palette `toast.info("… coming soon")` stubs for Skills activation + File mention insertion are intentional — CustomEvents are dispatched but no listener wires them back to the chat input yet. Deferred to a follow-up.

### Browser smoke (localhost:3010, Claude in Chrome)
- Tab bar renders with 4 tabs; Actions/Skills/Tools/Entities route catalog entries correctly.
- Session group appears first under Actions with all 8 commands; `paramHint` visible for `new-task`, `new-workflow`, `new-schedule`.
- `localStorage` tab persistence verified across navigation.
- Capability banner: hidden on Claude (Opus), visible on Ollama (`gpt-oss`) with the exact spec text, dismissible via X button.
- ⌘K palette opens globally.

### Scope deviations from spec
- AC #4 ("Tools tab hidden behind Advanced reveal"): softened to "Tools tab visible by default" during HOLD-mode scope approval. Toggle can be added later if muscle memory suggests it.
- AC #3 (Skills-tab env-aware badges): intentionally deferred to `chat-environment-integration` (still planned). Skills tab ships without badges.

### Known follow-ups
- `/compact` is a stub (toast only) — real compaction machinery to be added alongside `chat-advanced-ux` or a dedicated feature.
- `/help` + Enter when the popover's last-remembered tab is **Entities** sends the text as a chat message (edge case: no cmdk-item is selected under the Entities placeholder). Happy path on Actions tab works as expected.
- ⌘K palette → Skills / Files selection dispatches CustomEvents but has no chat-input listener yet; `toast.info("coming soon")` provides user feedback.
- `chat-file-mentions` listener on `ainative.chat.insert-mention` to wire the Files group once it lands.

Commits: `99cd92e`, `827d0df`, `9283338`, `3851fd3`, `29f161c`, `4140e99`, `1bc1078`, `d2469e4`, `728017b`, `541c6fd`, `571d685`, `db235aa`.
