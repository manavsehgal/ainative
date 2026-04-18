---
title: Codex Subscription Governance
status: completed
priority: P2
milestone: post-mvp
source: codex-chatgpt-authentication
dependencies: [codex-chatgpt-authentication, spend-budget-guardrails]
---

# Codex Subscription Governance

## Description

Once Codex App Server supports both API-key and ChatGPT-plan authentication inside ainative, the Settings surface needs to distinguish usage-priced OpenAI Direct/API-key Codex from subscription-backed ChatGPT Codex. Without that split, operators cannot tell which runtime is active, which billing model applies, or whether they are simultaneously using both.

This feature adds the minimal governance and UX layer needed for that distinction: runtime setup now marks ChatGPT-backed Codex as subscription-priced, OpenAI provider state can show both subscription-backed Codex and usage-priced OpenAI Direct at the same time, and Settings exposes ChatGPT account/rate-limit metadata instead of treating every OpenAI path as API-key-only.

## User Story

As a ainative operator, I want the OpenAI provider UI to tell me whether Codex is using my ChatGPT plan or an API key so that I can understand the billing mode and active runtime surface before launching work.

## Technical Approach

- Update runtime setup derivation so `openai-codex-app-server` reports `billingMode: "subscription"` when ChatGPT auth is selected and connected.
- Detect OpenAI dual-billing state when ChatGPT-backed Codex and API-key-backed OpenAI Direct are both configured.
- Surface OpenAI account metadata and Codex rate-limit metadata in the OpenAI provider row.
- Keep API-key budgeting behavior for OpenAI Direct unchanged.

## Acceptance Criteria

- [x] Codex App Server reports subscription billing when ChatGPT auth is active
- [x] OpenAI Direct remains usage-priced and API-key-backed
- [x] The OpenAI provider row surfaces dual-billing when both modes are active
- [x] Settings shows ChatGPT account identity and Codex rate-limit status when available
- [x] Existing OpenAI API-key settings continue to work for OpenAI Direct

## Scope Boundaries

**Included:**
- Runtime billing-mode derivation for ChatGPT-backed Codex
- OpenAI dual-billing messaging
- ChatGPT account and rate-limit visibility

**Excluded:**
- Converting spend-budget guardrails to ChatGPT-plan quota enforcement
- Modeling ChatGPT plan tiers as configurable pricing rows
- Auto-blocking Codex work based on ChatGPT rate-limit thresholds

## References

- Related features: [codex-chatgpt-authentication](codex-chatgpt-authentication.md), [spend-budget-guardrails](spend-budget-guardrails.md), [openai-direct-runtime](openai-direct-runtime.md)
