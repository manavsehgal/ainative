---
title: Chat Slash Commands & @Mentions
status: completed
priority: P1
milestone: post-mvp
source: ideas/chat-enhancements.md
dependencies: [chat-input-composer, chat-engine, command-palette-enhancement]
---

# Chat Slash Commands & @Mentions

## Description

Add inline autocomplete to the chat prompt box that activates on two trigger characters:

- **"/" commands** — surface tools and actions (create task, navigate, execute workflow) directly from the chat input. Typing `/` at the start of the input opens a popover with grouped commands that filter as the user types.
- **"@" mentions** — reference Stagent primitives (projects, tasks, workflows, documents, profiles, schedules) inline. Typing `@` after whitespace opens a popover with fuzzy-searchable entity results. Selected mentions inject Tier 3 context into the chat engine so the model receives full entity details.

Both popover UIs reuse the existing `cmdk` (Command) primitives from `src/components/ui/command.tsx` — the same fuzzy matching, keyboard navigation, and grouped item rendering used by the `Cmd+K` command palette. The key difference: instead of a modal dialog, items render in a Popover anchored above the textarea at the caret position.

## User Story

As a Stagent user, I want to type `/` to quickly access tools and actions, and `@` to reference specific entities, so that I can compose rich, context-aware prompts without leaving the chat input.

## Technical Approach

### Shared Infrastructure

- **Reuse cmdk primitives**: `Command`, `CommandList`, `CommandGroup`, `CommandItem`, `CommandEmpty` from `src/components/ui/command.tsx` — rendered inside a Radix `Popover` instead of `CommandDialog`
- **Reuse command data**: Extract `navigationItems` and `createItems` from `src/components/shared/command-palette.tsx` into a shared module so both the palette and slash commands consume the same data
- **Custom hook**: `useChatAutocomplete` encapsulates trigger detection, caret positioning, keyboard interception, and popover state

### New Components

1. **`src/components/chat/chat-command-popover.tsx`** — Popover shell containing cmdk Command primitives. Two modes: `slash` (static command groups) and `mention` (dynamic entity search results). Anchored to caret position via Radix Popover virtual anchor.

2. **`src/hooks/use-chat-autocomplete.ts`** — Hook managing:
   - Trigger detection (`/` at position 0 or after newline; `@` after whitespace or at position 0)
   - Query extraction (text between trigger and cursor)
   - Caret pixel position calculation (mirror-div technique)
   - Keyboard interception (Arrow keys, Enter, Escape, Tab when popover open)
   - Debounced entity search for `@` mode (200ms)
   - Mention tracking (maps `@type:Name` text ranges to entity IDs)

### Slash Commands Registry

3. **`src/lib/chat/slash-commands.ts`** — Static registry of chat commands, organized in groups:
   - **Actions**: create_task, execute_task, cancel_task, create_project, create_workflow, execute_workflow, create_schedule, upload_document
   - **Navigation**: reuse from shared `navigationItems`
   - **Create**: reuse from shared `createItems`
   - **Utility**: toggle theme, mark all read

   Selection behaviors:
   - `insert_template` — replaces `/` trigger with a natural language prompt template the user can edit before sending
   - `navigate` — closes popover and navigates to the page
   - `execute_immediately` — replaces trigger text and auto-sends (only for safe read-only commands like list queries)

### Entity Search API

4. **`GET /api/chat/entities/search?q=<query>&types=project,task,...&limit=10`** — New endpoint for `@` mention autocomplete. Fuzzy-searches across entity tables (projects by name, tasks by title, workflows by name, documents by filename, schedules by name) and the file-based profile registry. Returns results grouped by entity type with status badges.

### Context Injection (Tier 3)

5. **Extend `src/lib/chat/context-builder.ts`** — Add `buildTier3(mentions)` that fetches full details for each mentioned entity and appends structured summaries to the system prompt. Token budget: 3,000 tokens. This completes the Tier 3 slot already reserved in the context builder comments.

6. **Thread mentions through the message pipeline**:
   - `ChatInput` passes `mentions[]` up to `ChatShell`
   - `ChatShell.handleSend` includes mentions in the POST body
   - `POST /api/chat/conversations/[id]/messages` route parses mentions
   - `engine.ts` forwards mentions to `buildChatContext()`

### Mention Representation

Plain text `@type:Name` in the textarea (not contentEditable chips). The textarea remains a native `<textarea>` element, preserving auto-resize, IME support, and mobile keyboard behavior. Mentions are parsed at send time by regex-matching `@(project|task|workflow|document|profile|schedule):(.+?)(?=\s|$)` patterns and resolving against the cached search results.

## Acceptance Criteria

- [ ] Typing `/` at position 0 in the chat input opens a command popover above the textarea
- [ ] The popover shows grouped commands (Actions, Navigation, Create, Utility) with icons
- [ ] Typing after `/` fuzzy-filters commands via cmdk's built-in command-score
- [ ] Arrow keys navigate items, Enter selects, Escape closes the popover
- [ ] Selecting an `insert_template` command replaces the `/` text with an editable prompt template
- [ ] Selecting a `navigate` command closes popover and navigates to the target page
- [ ] Typing `@` after whitespace or at position 0 opens a mention popover
- [ ] The mention popover shows entity results grouped by type (Projects, Tasks, Workflows, etc.)
- [ ] Typing after `@` triggers a debounced search against `GET /api/chat/entities/search`
- [ ] Selecting a mention inserts `@type:Name` text into the textarea
- [ ] Sending a message with `@` mentions injects Tier 3 entity context into the system prompt
- [ ] The model's response demonstrates awareness of the mentioned entity's details
- [ ] Enter-to-send still works normally when the popover is closed
- [ ] The popover does not interfere with Shift+Enter newline behavior
- [ ] Popover is accessible: proper ARIA roles, keyboard-only operation, screen reader announcements

## Scope Boundaries

**Included:**
- `/` command popover with static command registry
- `@` mention popover with live entity search
- Tier 3 context injection for mentioned entities
- Keyboard navigation and fuzzy filtering
- Shared data extraction from command palette

**Excluded:**
- ContentEditable rich text editor / styled mention chips (plain text only)
- File attachment via `/upload` command (future feature)
- Multi-line command templates with structured forms
- Mention notifications to other users (Stagent is single-user)
- Custom command registration by users
- `#` channel/tag syntax

## References

- Source: `features/chat-input-composer.md` — slash commands explicitly excluded, now being added
- Source: `features/command-palette-enhancement.md` — ⌘K palette UX to reuse
- Source: `features/chat-engine.md` — Tier 3 context slot reserved for entity expansion
- Related: `src/components/ui/command.tsx` — cmdk primitives
- Related: `src/components/shared/command-palette.tsx` — command data to share
- Related: `src/lib/chat/context-builder.ts` — Tier 3 integration point
- Related: `src/lib/chat/entity-detector.ts` — existing entity detection for Quick Access (different from mention detection)
