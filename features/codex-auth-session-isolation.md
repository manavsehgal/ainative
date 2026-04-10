---
title: Codex Auth Session Isolation
status: completed
priority: P1
milestone: post-mvp
source: codex-chatgpt-authentication
dependencies: [codex-chatgpt-authentication]
---

# Codex Auth Session Isolation

## Description

Codex caches authentication state under `CODEX_HOME`, defaulting to `~/.codex`. Reusing that global home inside Stagent would make login, logout, and session repair affect the operator's normal Codex CLI session, which is an unnecessary trust and debugging hazard.

This feature gives Stagent its own isolated Codex auth home under the Stagent data directory and forces file-based credential storage there. Stagent's browser login, cached session reuse, and logout semantics all operate on that isolated session only.

## User Story

As a Stagent user, I want Stagent's Codex sign-in state isolated from my normal Codex CLI state so that using or troubleshooting Stagent never logs me out of my usual Codex environment.

## Technical Approach

- Add Stagent path helpers for a dedicated Codex home, config file, and auth cache path.
- Ensure the isolated Codex home exists before app-server startup and write a `config.toml` that forces `cli_auth_credentials_store = "file"`.
- Start every Stagent-managed Codex App Server process with that isolated `CODEX_HOME`.
- Strip ambient `OPENAI_API_KEY` from app-server environment when ChatGPT auth is selected so OAuth mode cannot silently fall back to the host's API-key environment.
- Ensure logout clears only the isolated auth cache and persisted Stagent session metadata.

## Acceptance Criteria

- [x] Stagent-managed Codex login uses a Stagent-owned `CODEX_HOME` instead of `~/.codex`
- [x] Stagent config forces file-based auth storage for predictable session handling
- [x] Stagent logout clears only the isolated Codex auth cache
- [x] Ambient `OPENAI_API_KEY` does not leak into ChatGPT-authenticated Codex startup
- [x] Connection tests, chat, and tasks all reuse the isolated cached session consistently

## Scope Boundaries

**Included:**
- Stagent-owned Codex auth home
- File-based credential storage enforcement
- Logout/session cleanup for the isolated store

**Excluded:**
- Importing credentials from an existing global `~/.codex`
- Sharing a live auth cache between Stagent and the normal Codex CLI
- CI/CD credential-copy workflows

## References

- Related features: [codex-chatgpt-authentication](codex-chatgpt-authentication.md), [openai-codex-app-server](openai-codex-app-server.md)
