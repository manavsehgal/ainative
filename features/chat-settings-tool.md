---
title: Chat Settings Tool
status: planned
priority: P1
milestone: post-mvp
source: conversation
dependencies: [tool-permission-persistence]
---

# Chat Settings Tool

## Description

Add a `set_settings` tool to the stagent chat agent, allowing users to modify settings via natural language instructions. Today the agent can read settings with `get_settings` but cannot change them — the user must navigate to the Settings UI page for any configuration change.

This tool uses an explicit allowlist of safe, user-facing keys with per-key validation. It is permission-gated so the user sees a confirmation prompt before any setting is actually changed. Secrets (API keys) and internal state keys are excluded by design.

## User Story

As a stagent user, I want to say "set my timeout to 120 seconds" or "enable Playwright" in chat so that I can configure my workspace without leaving the conversation.

## Technical Approach

- Add `set_settings` tool definition in `src/lib/chat/tools/settings-tools.ts` alongside existing `get_settings`
- Define a `WRITABLE_SETTINGS` allowlist map with per-key validation functions and human-readable descriptions
- Use existing `setSetting()` from `src/lib/settings/helpers.ts` for DB writes
- Add `mcp__stagent__set_settings` to `PERMISSION_GATED_TOOLS` in `src/lib/chat/engine.ts`
- Add catalog entry in `src/lib/chat/tool-catalog.ts` under "Settings" group
- Return `{ key, oldValue, newValue }` on success for chat transparency

### Writable Keys Allowlist

| Key | Validation | Description |
|-----|-----------|-------------|
| `runtime.sdkTimeoutSeconds` | integer 10-300 | SDK timeout |
| `runtime.maxTurns` | integer 1-50 | Max agent turns |
| `routing.preference` | cost \| latency \| quality \| manual | Routing mode |
| `browser.chromeDevtoolsEnabled` | true \| false | Chrome DevTools MCP |
| `browser.playwrightEnabled` | true \| false | Playwright MCP |
| `web.exaSearchEnabled` | true \| false | Exa web search |
| `learning.contextCharLimit` | integer 2000-32000, step 1000 | Learning context limit |
| `ollama.baseUrl` | non-empty URL string | Ollama server URL |
| `ollama.defaultModel` | non-empty string | Default Ollama model |

### Excluded Keys (by design)

- `auth.apiKey`, `openai.authApiKey` — secrets
- `auth.apiKeySource`, `openai.authApiKeySource` — internal state
- `auth.method` — auth flow changes are high-risk
- `permissions.allow` — meta-permission, prevents self-escalation
- `usage.budgetPolicy`, `usage.budgetWarningState`, `usage.pricingRegistry` — complex/internal
- `browser.*Config` — complex JSON blobs

## Acceptance Criteria

- [ ] `set_settings` tool is available in chat and listed in tool catalog
- [ ] Only allowlisted keys can be written; unknown keys return a clear error with valid key list
- [ ] Per-key validation rejects invalid values with descriptive messages
- [ ] Tool is permission-gated — user sees approval prompt before any setting changes
- [ ] Successful change returns old value and new value
- [ ] API keys and internal state keys cannot be written via this tool
- [ ] `get_settings` continues to work unchanged

## Scope Boundaries

**Included:**
- Single-key write tool with allowlist and validation
- Permission gating via existing `PERMISSION_GATED_TOOLS` mechanism
- Tool catalog registration

**Excluded:**
- Batch updates (multiple keys per call) — LLM can issue sequential calls
- "List writable settings" helper — writable keys listed in tool description
- Real-time UI refresh after chat-driven change (existing limitation, acceptable for V1)
- Budget policy changes (complex JSON schema, keep in dedicated UI)

## References

- Existing tool: `src/lib/chat/tools/settings-tools.ts` (get_settings)
- Permission system: `src/lib/chat/engine.ts` (PERMISSION_GATED_TOOLS)
- Settings helpers: `src/lib/settings/helpers.ts` (getSetting/setSetting)
- Tool catalog: `src/lib/chat/tool-catalog.ts`
