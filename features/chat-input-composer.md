---
title: Chat Input Composer
status: completed
priority: P1
milestone: post-mvp
source: brainstorm (2026-03-22)
dependencies: [chat-ui-shell, chat-api-routes]
---

# Chat Input Composer

## Description

The prompt input area with auto-growing textarea, model/runtime selector with cost/capability labels, send/stop controls, and keyboard shortcuts. Operates in two layout modes: hero-styled when centered in the empty state, and compact when docked at the bottom during an active conversation.

The model selector is a key UX element — it shows all available models grouped by provider with clear cost tiers ($, $$, $$$) so users can make informed choices. The default model is configurable via a new "Chat default model" preference in the Settings page.

## User Story

As a user, I want a polished input area that lets me type messages, choose which AI model to use, and send with Enter — similar to Claude.ai and ChatGPT.

## Technical Approach

### Input Component (`src/components/chat/chat-input.tsx`)
- Auto-growing `<textarea>`:
  - `field-sizing: content` for native auto-grow
  - `min-h-[40px] max-h-[200px]` constraints
  - `border-0 bg-transparent focus:ring-0 text-sm placeholder:text-muted-foreground`
  - Placeholder: "Ask anything about your projects..."
- Container: `elevation-2 rounded-xl p-3 bg-card flex flex-col gap-2`
- Control row: `flex items-end gap-2`
  - Model selector (left)
  - Textarea (center, flex-1)
  - Send/Stop button (right)
- **Send button**: `Button size="icon-sm" variant="default"` with ArrowUp icon
  - Disabled when textarea is empty
  - Disabled during streaming (replaced by Stop)
- **Stop button**: `Button size="icon-sm" variant="destructive"` with Square icon
  - Replaces Send during streaming
  - Cancels the active SSE stream (via AbortController)
- Keyboard shortcuts:
  - **Enter**: Send message (when textarea has content and not streaming)
  - **Shift+Enter**: Insert newline
  - **Escape**: Blur textarea
- Focus management: auto-focus on page load, re-focus after sending

### Model Selector (`src/components/chat/chat-model-selector.tsx`)
- Compact `Select` trigger: `h-7 text-xs rounded-md border border-border bg-muted px-2`
- Shows current model with tier emoji (e.g., "Haiku 4.5 ⚡")
- Dropdown content grouped by provider:
  - **Anthropic** group header
    - "Haiku 4.5 — Fast, $" (default)
    - "Sonnet 4.6 — Balanced, $$"
    - "Opus 4.6 — Best, $$$"
  - **OpenAI** group header (only if Codex runtime available)
    - "GPT-4o-mini — Fast, $"
    - "GPT-4o — Balanced, $$"
- Each option shows: model name, capability descriptor, cost tier
- Selection updates conversation's `modelId` via PATCH API
- Default value: reads `chat_default_model` from settings, falls back to 'claude-haiku-4-5'
- Available models derived from runtime availability (check settings/auth status)

### Settings Integration
- Add "Chat default model" to Settings page (`/settings`):
  - New section or row in existing settings UI
  - Dropdown matching the model selector options (same model list)
  - Stored in `settings` table via existing `PATCH /api/settings` API (key: `chat_default_model`)
  - ChatInput reads this on mount for new conversations
- Settings key: `chat_default_model`, values: model IDs like `claude-haiku-4-5`, `claude-sonnet-4-6`, etc.

### Layout Modes
- **Hero mode** (empty state — no active conversation):
  - Centered on page with generous whitespace
  - Larger container: `max-w-2xl mx-auto w-full`
  - Suggestion chips grid rendered above the input
  - Input has more visual presence (slightly larger padding)
- **Docked mode** (active conversation):
  - `sticky bottom-0 p-4 bg-background border-t border-border`
  - Compact, minimal chrome
  - Full-width within the message area column
- Mobile: `pb-[env(safe-area-inset-bottom)]` for iOS safe area inset

## Acceptance Criteria

- [ ] Textarea auto-grows with content up to max-h-[200px]
- [ ] Enter sends message (when not empty and not streaming), Shift+Enter inserts newline
- [ ] Send button disabled when textarea is empty or during streaming
- [ ] Stop button appears during streaming and cancels the SSE response
- [ ] Model selector shows available models grouped by provider with cost labels ($, $$, $$$)
- [ ] Model selector defaults to `chat_default_model` setting (falls back to Haiku 4.5)
- [ ] Selecting a model updates the conversation's modelId via API
- [ ] Settings page has "Chat default model" dropdown preference
- [ ] Settings preference persists across sessions via settings API
- [ ] Hero mode centers input with generous whitespace on empty state
- [ ] Docked mode sticks to bottom with border-t separator during conversation
- [ ] Mobile safe area padding prevents input from hiding behind iOS nav bar
- [ ] Focus management: textarea auto-focuses on page load and after sending
- [ ] Escape key blurs the textarea

## Scope Boundaries

**Included:**
- Textarea with auto-grow, send/stop buttons, keyboard shortcuts
- Model selector with cost/capability tiers
- Settings page "Chat default model" preference
- Hero and docked layout modes
- Mobile safe area handling

**Excluded:**
- File attachment button (future feature)
- Voice input/output
- Slash commands in chat
- "Run as Task" escalation button (could be added to message rendering later)

## References

- Source: Brainstorm session 2026-03-22
- Related features: Depends on chat-ui-shell, chat-api-routes. Sibling to chat-message-rendering
- Pattern reference: `src/components/ui/select.tsx` (Select), `src/app/settings/` (settings page), `src/app/api/settings/` (settings API)
- UX spec: elevation-2 rounded-xl container. Calm Ops tokens. DV=5, MI=4, VD=6
