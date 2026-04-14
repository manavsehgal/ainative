---
title: Chat — Conversation Templates from Workflow Blueprints
status: completed
priority: P2
milestone: post-mvp
source: chat-advanced-ux.md §3 (split during grooming, 2026-04-14)
dependencies:
  - workflow-blueprints
  - chat-conversation-persistence
  - chat-command-namespace-refactor
---

# Chat — Conversation Templates from Workflow Blueprints

## Description

`workflow-blueprints` already serializes 13 built-in workflows as YAML templates with resolvable `{{parameter}}` tokens. Today those are consumed only by the workflow engine. This feature makes them consumable by chat: a user starting a new conversation can pick a blueprint → chat pre-fills the first user message with the blueprint's primary prompt after substituting resolved parameters.

No schema changes. No new persistence. The conversation is a normal conversation after instantiation — the blueprint is just a convenient first message.

## User Story

As a new user (or a returning user who forgets how to phrase a good research prompt), I want to click "Start from template" → pick "Research summary" → fill in {topic} and {timeframe} → and land in a chat with a professional-grade first message already in the input, ready to send.

## Technical Approach

### Entry points

Three places expose the template picker:

1. **Chat empty-state** — when a new conversation has zero messages, render a "Start from template" card alongside the existing empty-state copy
2. **`/new-task` sibling** — add `/new-from-template` slash command to the Session group in the Actions tab
3. **`⌘K` palette** — `Start from template…` entry in a new `Templates` group

### Picker

A sliding sheet (`SheetContent` from `shadcn/ui`, following the SheetContent body-padding rule from MEMORY.md — `px-6 pb-6` on the body div) listing blueprints from `GET /api/workflows/blueprints`. Each card shows:

- Blueprint name + description
- Parameter count badge (e.g. "2 parameters")
- First ~140 chars of the primary prompt as preview

Selecting a blueprint opens an inline parameter form (reuses `FormSectionCard` from shared components). Fields are typed per the blueprint schema (`text`, `select`, `multiline`). "Start conversation" button is disabled until required params are filled.

### Instantiation

Reuses existing `instantiateBlueprint()` from `src/lib/workflows/blueprints/instantiate.ts` — but since we need the **rendered primary prompt**, not a workflow, add a small peer function:

```typescript
// src/lib/workflows/blueprints/render-prompt.ts
export function renderBlueprintPrompt(
  blueprint: WorkflowBlueprint,
  params: Record<string, unknown>
): { firstMessage: string; title: string };
```

Pure template substitution over the blueprint's `chatPrompt` field (new field on the blueprint schema, falls back to first step's `prompt` if absent). On click:

1. `POST /api/chat/conversations` with `{ title: rendered.title }`
2. Navigate to `/chat/<id>`
3. Pre-fill the composer with `rendered.firstMessage`
4. User can edit or send

### Blueprint schema addition

Optional `chatPrompt` field on `WorkflowBlueprintDefinition`:

```yaml
id: research-summary
name: Research Summary
chatPrompt: |
  Research {{topic}} focused on the period {{timeframe}}.
  Summarize findings in ≤500 words with citations.
```

Fallback for the 13 existing blueprints: derive `chatPrompt` from step 1's `prompt` if absent, so no blueprints need editing for v1.

## Acceptance Criteria

- [ ] "Start from template" card renders on empty chat
- [ ] `/new-from-template` slash command opens the picker
- [ ] `⌘K` → Templates group lists all blueprints
- [ ] Picker lists blueprints with name, description, parameter count, prompt preview
- [ ] Selecting a blueprint with 0 parameters immediately starts the conversation
- [ ] Selecting a blueprint with required parameters renders an inline form; submit is disabled until complete
- [ ] `renderBlueprintPrompt()` unit tests cover: no params, all params, missing optional param, unresolved token (error)
- [ ] New conversation is created with the blueprint's rendered title
- [ ] Composer is pre-filled with the rendered prompt; user can edit before sending
- [ ] Blueprints without a `chatPrompt` field fall back to step 1's prompt

## Scope Boundaries

**Included:**
- 3 entry points (empty-state, slash command, palette)
- Sliding sheet picker with inline parameter form
- `renderBlueprintPrompt()` utility
- Optional `chatPrompt` blueprint field with step-1 fallback

**Excluded:**
- Authoring new blueprints from the chat surface (that's `workflow-blueprints` editor territory)
- Parameter type beyond `text` / `select` / `multiline` (no file-picker params in v1)
- Blueprint search/filter inside the picker (13 blueprints, visually scannable)
- Per-blueprint analytics / frequency-based ordering
- Chained templates (pick one, then another)

## References

- Split from: [chat-advanced-ux](chat-advanced-ux.md) §3 — picked as first sub-feature to ship per grooming decision
- Depends on: [workflow-blueprints](workflow-blueprints.md) — source of templates
- Depends on: [chat-conversation-persistence](chat-conversation-persistence.md) — conversation creation
- Existing code: `src/lib/workflows/blueprints/instantiate.ts`, `src/app/api/workflows/blueprints/route.ts`, `src/app/chat/`
- Shared components: `FormSectionCard`, `SheetContent` (watch the `px-6 pb-6` padding rule)
