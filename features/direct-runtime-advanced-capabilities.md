---
title: Direct Runtime Advanced Capabilities
status: planned
priority: P2
milestone: post-mvp
source: ideas/direct-api-gap-analysis.md
dependencies: [anthropic-direct-runtime, openai-direct-runtime]
---

# Direct Runtime Advanced Capabilities

## Description

Direct API runtimes unlock model capabilities that SDK-based runtimes don't expose. This feature wires three high-value capabilities into the direct runtime adapters: extended thinking (Anthropic), context compaction (Anthropic), and model routing (both providers). These are opt-in enhancements that improve task quality, enable long-running sessions, and optimize cost.

## User Story

As a ainative user, I want access to extended thinking for complex tasks, context compaction for long sessions, and model routing for cost optimization so that I get the best results from direct API runtimes.

## Technical Approach

### 1. Extended Thinking (Anthropic Direct)

Extended thinking lets Claude show its reasoning process before answering, improving quality on complex tasks.

- Add `extendedThinking` option to profile config (`profile.yaml`):
  ```yaml
  runtimeOverrides:
    anthropic-direct:
      extendedThinking:
        enabled: true
        budgetTokens: 10000  # Max thinking tokens
  ```
- In `anthropic-direct.ts`, when extended thinking is enabled:
  - Add `thinking: { type: "enabled", budget_tokens: N }` to `messages.create()` params
  - Stream `thinking` content blocks as a collapsible "Thinking..." section in task output
  - Thinking tokens count toward usage but are typically worth the quality improvement
- Default: disabled (opt-in per profile or per task)

### 2. Context Compaction (Anthropic Direct)

Long-running chat sessions and multi-turn tasks can exceed context limits. Context compaction automatically summarizes older conversation turns to stay within limits.

- In `anthropic-direct.ts`, for chat sessions and long tasks:
  - Monitor total token count across the conversation
  - When approaching 80% of model context window:
    - Use Anthropic's `context_compaction` API parameter if available
    - OR implement client-side compaction: summarize older turns into a compact block, replace original messages
  - Preserve the most recent N turns verbatim for continuity
- Add compaction indicator to chat UI: "Context compacted — older messages summarized"

### 3. Model Selection per Runtime

Direct API runtimes unlock access to the full model catalog, not just the SDK's bundled version. Enable per-task and per-profile model selection:

- Add `modelId` to profile runtime overrides:
  ```yaml
  runtimeOverrides:
    anthropic-direct:
      modelId: claude-sonnet-4-6  # Cheaper for simple tasks
    openai-direct:
      modelId: gpt-4.1            # Cost-effective default
  ```
- Add model selector to task creation UI for direct runtimes
- Available models fetched from `/v1/models` endpoint per provider
- Enable model routing patterns:
  - Classification/routing tasks → cheapest model (Haiku, GPT-4.1-mini)
  - Complex reasoning → best model (Opus, GPT-5.4)
  - General tasks → balanced model (Sonnet, GPT-4.1)

### 4. Server-Side Tools Configuration (Both Direct Runtimes)

Server-side tools are available but need UI configuration:

**Anthropic Direct:**
- `web_search` — enable/disable per profile
- `code_execution` — enable/disable per profile
- `text_editor` — enable/disable per profile

**OpenAI Direct:**
- `web_search_preview` — enable/disable per profile
- `code_interpreter` — enable/disable per profile
- `file_search` — enable/disable + vector store management
- `image_generation` — enable/disable per profile

- Add server-side tool toggles to profile edit UI
- Store configuration in profile `runtimeOverrides`
- Pass enabled tools to API calls alongside ainative custom tools

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/agents/runtime/anthropic-direct.ts` | Extended thinking param, context compaction, model selection |
| `src/lib/agents/runtime/openai-direct.ts` | Model selection, server-side tool configuration |
| `src/lib/agents/profiles/types.ts` | Add `extendedThinking`, `modelId`, `serverTools` to runtime overrides |
| `src/lib/agents/profiles/builtins/*/profile.yaml` | Add runtime-specific model and feature config |
| `src/components/profiles/profile-edit-form.tsx` | Extended thinking toggle, model selector, server tool toggles |
| `src/components/tasks/task-create-panel.tsx` | Model selector for direct runtimes |
| `src/components/chat/chat-message.tsx` | Thinking block rendering (collapsible) |

## Acceptance Criteria

- [ ] Extended thinking can be enabled per profile for `anthropic-direct` runtime
- [ ] Thinking blocks stream and render as collapsible sections in task/chat output
- [ ] Context compaction activates for conversations approaching context limits
- [ ] Model can be selected per profile per runtime (e.g., Sonnet for simple tasks, Opus for complex)
- [ ] Model selector shows available models from provider's `/v1/models` endpoint
- [ ] Server-side tools (web_search, code_execution, etc.) can be toggled per profile
- [ ] Server-side tool results stream correctly in task output
- [ ] All capabilities are opt-in — disabled by default, no impact on existing behavior
- [ ] Usage tracking correctly records model ID and thinking token usage

## Scope Boundaries

**Included:**
- Extended thinking (Anthropic Direct)
- Context compaction (Anthropic Direct)
- Per-runtime model selection (both direct runtimes)
- Server-side tool configuration UI

**Excluded:**
- Automatic model routing based on task complexity (future — could integrate with smart router)
- Vector store management UI for OpenAI file_search (future feature)
- Image generation gallery/preview UI (future feature)
- Citations rendering for Anthropic web_search results (future feature)

## References

- Source: `ideas/direct-api-gap-analysis.md` — Section 3 "Differentiating Capabilities", Section 5 "Quality Comparison"
- Anthropic docs: Extended thinking, context compaction
- OpenAI docs: Responses API built-in tools
- Existing: `src/lib/chat/model-discovery.ts` for model catalog pattern
