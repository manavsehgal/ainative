---
title: Codex ChatGPT Authentication
status: completed
priority: P1
milestone: post-mvp
source: user request 2026-04-10
dependencies: [openai-codex-app-server, provider-runtime-abstraction]
---

# Codex ChatGPT Authentication

## Description

Stagent's initial Codex App Server integration only supported API-key authentication. That was enough to prove the runtime adapter, but it left Stagent behind the current Codex product surface, which also supports browser-based ChatGPT sign-in tied to a ChatGPT plan. Users who rely on ChatGPT-managed Codex access had no way to use that entitlement inside Stagent.

This feature adds ChatGPT sign-in as a first-class authentication mode for the Codex App Server runtime. The v1 scope is local browser login only: Stagent starts the `chatgpt` auth flow, opens or exposes the returned URL, waits for the app-server callback to complete, and then reuses the cached Codex session for future health checks, chat turns, and task executions.

## User Story

As a Stagent user with Codex access through my ChatGPT plan, I want to connect Codex App Server with browser sign-in instead of an API key so that I can use the same authentication mode and entitlements I already have in Codex.

## Technical Approach

- Extend OpenAI settings storage from key-only to a mixed model:
  - selected auth method for Codex App Server (`api_key` or `oauth`)
  - shared OpenAI API key state for OpenAI Direct
  - persisted OAuth connection/account metadata
- Add a Stagent-managed login flow around Codex App Server JSON-RPC:
  - `account/login/start { type: "chatgpt" }`
  - `account/login/completed`
  - `account/login/cancel`
  - `account/logout`
  - `account/read`
  - `account/rateLimits/read`
- Update the Codex runtime adapter and Codex chat engine to branch on the selected OpenAI auth method instead of assuming API-key-only startup.
- Update the Settings provider row so OpenAI has a provider-specific auth selector and a browser-login control with pending, connected, cancelled, expired, and error states.
- Keep `openai-direct` API-key-only; ChatGPT auth only applies to `openai-codex-app-server`.

## Acceptance Criteria

- [x] OpenAI settings support both API key and ChatGPT auth methods for Codex App Server
- [x] Settings can start a ChatGPT browser login and poll until the app-server reports completion
- [x] Existing valid ChatGPT sessions are reused for future Codex connection tests and runtime starts
- [x] Codex task execution uses the selected auth mode instead of assuming an API key
- [x] Codex chat conversations use the selected auth mode instead of assuming an API key
- [x] OpenAI Direct remains API-key-only and is not marked configured by ChatGPT auth alone
- [x] OpenAI Settings surfaces explicit pending, cancelled, failed, and connected states with provider-specific copy

## Scope Boundaries

**Included:**
- Local browser sign-in for Codex App Server
- Persisted ChatGPT account and rate-limit metadata for Settings
- Shared auth-mode branching across Codex task execution, task assist, connection test, and chat

**Excluded:**
- Host-managed `chatgptAuthTokens`
- Device-code or headless-only login flows
- Remote CI/session seeding workflows
- OpenAI Direct support without an API key

## References

- Related features: [openai-codex-app-server](openai-codex-app-server.md), [openai-direct-runtime](openai-direct-runtime.md), [spend-budget-guardrails](spend-budget-guardrails.md)
- Official docs: [Codex App Server auth surface](https://developers.openai.com/codex/app-server), [Codex auth](https://developers.openai.com/codex/auth)
