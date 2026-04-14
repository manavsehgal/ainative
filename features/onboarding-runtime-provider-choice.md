---
title: Onboarding — Runtime Provider Choice
status: planned
priority: P2
milestone: post-mvp
source: ideas/chat-context-experience.md Q10
dependencies: [app-shell, provider-runtime-abstraction, runtime-capability-matrix]
---

# Onboarding — Runtime Provider Choice

## Description

Stagent's `DEFAULT_CHAT_MODEL` is currently hard-coded to `"haiku"` (Claude runtime). This works for the default audience but hides a meaningful tradeoff: users who care about cost want a cheap cloud model, users who care about privacy want Ollama, users who care about quality want Opus or GPT-5.4. Today they discover all of this only after landing in chat and noticing the model picker.

Per the resolution of Q10 in the ideas doc, first-launch onboarding should ask the user which model/provider they use most, and set defaults accordingly. This is a small, self-contained settings/onboarding feature that runs independently of the Phase 1 runtime-skill work. It becomes more valuable once Phase 1a/1b/1c ship because the runtimes actually differ in capability — at that point an informed default matters more.

## User Story

As a new Stagent user, I want to be asked on first launch whether I prefer a cost-optimized, quality-optimized, latency-optimized, or privacy-optimized model, so my chat defaults match my actual priorities without hunting through settings.

## Technical Approach

### 1. First-launch detection

Reuse the existing onboarding/first-launch flow (likely in `src/app/layout.tsx` or a settings-bootstrap helper). If no `settings.defaultChatModel` record exists, run the onboarding modal once.

### 2. Preference prompt

Show a short radio-group modal (uses existing Sheet/Dialog patterns — remember the CLAUDE.md SheetContent padding convention `px-6 pb-6` for the body). Four choices, each mapped to a recommended model:

| Preference | Recommended default model | Runtime |
|---|---|---|
| Best quality | `claude-opus-4-6` or `gpt-5.4` | claude-code / codex |
| Lowest cost | `claude-haiku-4-5-20251001` or `gpt-5.4-mini` | claude-code / codex |
| Best privacy (local only) | First available `ollama:*` model | ollama |
| Balanced (default) | `claude-sonnet-4-6` | claude-code |

Each option shows a short capability note sourced from `runtime-capability-matrix` — e.g., "Ollama: runs locally, no filesystem tools."

### 3. Persist the preference

Store both the user's stated preference and the chosen model in `settings`:

- `settings.modelPreference`: `"quality" | "cost" | "privacy" | "balanced"`
- `settings.defaultChatModel`: the actual model id

The preference is kept alongside the model so future onboarding updates (e.g., a new model is released) can re-resolve sensibly if the user hasn't pinned a specific model themselves.

### 4. Skip / defer path

User can skip the modal with "Use default" — sets `defaultChatModel = "claude-sonnet-4-6"` (balanced) and `modelPreference = null`. Settings UI still allows changing it anytime.

### 5. Ollama availability check

If the user picks "Best privacy" and no Ollama models are discovered, show a small note ("No local models found — point Stagent at your Ollama install in Settings") and fall back to `"balanced"` temporarily.

## Acceptance Criteria

- [ ] On first launch (no `defaultChatModel` in settings), onboarding modal appears once
- [ ] Four preference options render with short capability notes from the runtime capability matrix
- [ ] Selecting an option persists both `settings.modelPreference` and `settings.defaultChatModel`
- [ ] "Skip / use default" path exists and sets the balanced default
- [ ] If no Ollama models are discoverable when "Best privacy" is chosen, the user is informed and balanced is used as fallback until they configure Ollama
- [ ] Modal does not re-appear on subsequent launches
- [ ] Settings UI exposes both `modelPreference` and `defaultChatModel`, editable independently
- [ ] Modal follows the project's Sheet padding convention (`px-6 pb-6` in body)

## Scope Boundaries

**Included:**
- First-launch preference modal and persistence
- Capability-note text sourced from `runtime-capability-matrix`
- Settings UI surfaces for both preference and model

**Excluded:**
- Multi-step onboarding beyond model choice (other onboarding is tracked elsewhere)
- Automatic Ollama installation/discovery — relies on existing `ollama-runtime-provider` behavior
- Re-prompting on model catalog changes (future enhancement)
- A/B testing of defaults

## References

- Source: `ideas/chat-context-experience.md` Q10 answer
- Depends on: `runtime-capability-matrix` (for capability notes), `provider-runtime-abstraction`, `app-shell`
- MEMORY.md: "SheetContent body padding" convention
- Existing code: `src/app/layout.tsx`, `src/lib/settings.ts` (if present), `src/components/shared/app-sidebar.tsx`
