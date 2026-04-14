---
title: Chat — Advanced UX (#-filters, Templates, Skill Composition, Branches)
status: planned
priority: P3
milestone: post-mvp
source: ideas/chat-context-experience.md §5.1, §8 Phase 5
dependencies: [chat-command-namespace-refactor, chat-environment-integration, chat-ollama-native-skills, workflow-blueprints, chat-conversation-persistence]
---

# Chat — Advanced UX (#-filters, Templates, Skill Composition, Branches)

## Description

With the Phase 1 runtime-skill work, file mentions, namespace refactor, and environment integration in place, Stagent chat achieves CLI-parity plus Stagent differentiation. This feature captures the "next ring" of improvements that power users asked for in the ideas brainstorm but that are not critical path: a `#` filter/tag namespace, saved searches and pinned entities, conversation templates derived from workflow blueprints, skill composition with conflict warnings, and an undo/redo model for conversation branches.

These are independently valuable but collectively represent a P3 bundle — the floor is already good after Phases 1-4. Split into sub-features during grooming if any individual capability grows past ~200 lines of design.

## User Story

As a power user who has been living in Stagent chat daily, I want to filter what I see (`#priority:high`), save views I reuse, start conversations from proven workflow templates, stack multiple skills when I know they compose, and branch a conversation without losing my place — so the chat scales with the sophistication of my work.

## Technical Approach

### 1. `#` filter namespace

Third trigger character alongside `/` and `@`. Scope: filters and tags applied to popovers, not commands. Examples:

- `#priority:high` — filters a `@task:` popover to high-priority tasks
- `#status:blocked` — filters workflow/task lists to blocked items
- `#scope:project` — filters the skill list to project skills only

Implementation: chained with an existing `@` or `/` trigger. Typing `@task: #status:blocked` applies the filter inside the popover. Filters are reusable across the app (search, list pages) via a shared filter parser.

### 2. Saved searches / pinned entities

Per-user persistence of commonly used filter combinations. "Pin" a result from any popover (right-click or `⌘P`) → appears in a pinned section at the top on next open. "Save this search" on a filter combination → appears in a Saved section.

Storage: `settings.chat.pinnedEntries` and `settings.chat.savedSearches` JSON fields, no new tables.

### 3. Conversation templates from workflow blueprints

`workflow-blueprints` already serializes workflows as YAML templates with resolvable parameters. Add "Start conversation from template" → pick a blueprint → the blueprint's description + primary prompt populate the first message, with parameter substitution. Reuse the existing instantiation pipeline; the chat surface is just a new consumer.

### 4. Skill composition with conflict warning

`chat-ollama-native-skills` currently enforces single-active-skill to bound context. This feature relaxes that with explicit opt-in composition on runtimes that can afford it (Claude, Codex — progressive disclosure keeps cost manageable). When activating a second skill, run a conflict check:

- Overlapping tool requirements resolved favorably → allow silently
- Conflicting instructions (e.g., two skills tell the agent to use different tools for the same task) → show a warning modal listing the conflict and require confirmation
- Ollama runtime: disallow composition, link to a "switch runtime to compose" hint

The conflict check is heuristic (keyword overlap in instruction sections of SKILL.md). Good-enough for v1; replace with embedding-based later if needed.

### 5. Conversation branches with undo/redo

Today chat is linear. This feature introduces lightweight branching:

- "Branch from here" on any assistant message → creates a child conversation whose prefix is up to that message
- A conversation tree view (compact) is available in the conversation detail sheet
- `⌘Z` at the chat input when the last turn was an assistant response → marks that turn as rewound (hidden) and re-presents the user's last input pre-filled for editing. `⌘⇧Z` redoes.

Storage: extend the conversation-message schema with `parentConversationId` and `branchedFromMessageId`. Existing conversations are trivially "linear branches of themselves."

## Acceptance Criteria

- [ ] `#key:value` filters parse and apply inside `@`/`/` popovers
- [ ] Shared filter parser is reusable beyond chat (e.g., list pages consume it)
- [ ] Users can pin entries and save filter combinations; both persist per user
- [ ] "Start conversation from template" picks a workflow blueprint and pre-populates the first message with resolved parameters
- [ ] Activating a second skill on Claude/Codex triggers a conflict check; confirmed or auto-allowed depending on heuristic
- [ ] Composition is disabled on Ollama with a capability hint
- [ ] "Branch from here" creates a child conversation preserving the prefix, visible in a tree view on the detail sheet
- [ ] `⌘Z` / `⌘⇧Z` support basic per-turn rewind/redo on the chat input surface
- [ ] No regressions in existing linear conversations (they render as single-node trees)
- [ ] Feature flag off by default until v1 is validated; on-by-default once stable

## Scope Boundaries

**Included:**
- `#` filter namespace + shared parser
- Pinned entries and saved searches
- Conversation templates from existing workflow blueprints (reuses instantiation pipeline)
- Skill composition with keyword-based conflict heuristic
- Conversation branches and per-turn undo/redo

**Excluded:**
- Multi-user saved searches / team-shared views (per-user only in v1)
- Full semantic conflict detection via embeddings (future)
- Branch merging / squashing (branches are forward-only in v1)
- A dedicated tree visualization page — compact tree view on detail sheet only

## References

- Source: `ideas/chat-context-experience.md` §5.1 (mental model), §8 Phase 5
- Depends on: `chat-command-namespace-refactor` (popover structure), `chat-environment-integration` (skill badges), `chat-ollama-native-skills` (single-active-skill baseline), `workflow-blueprints` (template source), `chat-conversation-persistence`
- Existing code: `src/components/chat/chat-command-popover.tsx`, `src/lib/chat/context-builder.ts`, `src/lib/workflows/*`, conversation schema in `src/lib/db/schema.ts`
