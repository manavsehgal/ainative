---
title: Chat — Command Namespace Refactor (/ = verbs, @ = nouns)
status: planned
priority: P1
milestone: post-mvp
source: ideas/chat-context-experience.md §5, §8 Phase 3, §11 (frontend-designer), Q7, Q9
dependencies: [chat-claude-sdk-skills, chat-file-mentions, runtime-capability-matrix, command-palette-enhancement]
---

# Chat — Command Namespace Refactor (/ = verbs, @ = nouns)

## Description

Stagent chat's current `/` popover mixes verbs and nouns: "new task" sits next to "list tasks" sits next to "researcher profile" sits next to 88 Stagent MCP tools grouped by function. As Phase 1a/1b/1c introduce filesystem skills, filesystem tools, and (via `chat-file-mentions`) file references through `@`, the current mental model will strain — over 200 items across ambiguous categories.

This feature refactors the command UX around a clean split: `/` is for **actions** (skills, session commands, Stagent primitives, filesystem tools) and `@` is for **references** (Stagent entities + files). The `/` popover becomes tabbed (Actions / Skills / Tools / Files / Entities) with environment-aware skill badges (health, profile link, cross-tool sync). A `⌘K` global command palette gives power users terminal-speed access. A new capability hint banner below the chat input resolves Q9a: when the active runtime can't do X/Y/Z, the banner says so in plain text without littering the popover with disabled rows.

Stagent is alpha, so per Q7 we accept this as a breaking UX change and skip the deprecation shim.

**Design sign-off required:** this spec must be reviewed by `/frontend-designer` before implementation begins — it introduces a new `CommandTabBar` component and touches the primary input surface.

## User Story

As a Stagent user who wants to discover what I can do, I want a predictable command system where `/` does things and `@` names things, grouped by category, so I can build muscle memory that transfers between chat, the CLI, and the command palette.

## Technical Approach

### 1. Split verbs from nouns

Move every noun-like entry out of the `/` popover and into the `@` popover: profiles (Stagent registry profiles acting as references), document references, table references, etc. Anything that "names a thing" belongs under `@`; anything that "performs an action" belongs under `/`.

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
- `/new-task`, `/new-workflow`, `/new-schedule` — inline Stagent primitive creators

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
- Action commands (Stagent primitives + session commands)
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
