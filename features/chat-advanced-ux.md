---
title: Chat — Advanced UX (retired umbrella — split 2026-04-14)
status: split
priority: P3
milestone: post-mvp
source: ideas/chat-context-experience.md §5.1, §8 Phase 5
dependencies: [chat-command-namespace-refactor, chat-environment-integration, chat-ollama-native-skills, workflow-blueprints, chat-conversation-persistence]
---

# Chat — Advanced UX (retired umbrella)

This spec was a P3 bundle of 5 independently valuable capabilities. During grooming (2026-04-14) it was split into 5 discrete specs so each can be prioritized, designed, and shipped on its own cadence.

## Successor specs

| # | Spec | Priority | Rationale for split priority |
|---|------|----------|-------------------------------|
| 1 | [chat-filter-namespace](chat-filter-namespace.md) | P2 | Shared parser usable beyond chat (list pages, `⌘K`) — foundational infra |
| 2 | [chat-pinned-saved-searches](chat-pinned-saved-searches.md) | P3 | Depends on #1; standalone value is lower |
| 3 | [chat-conversation-templates](chat-conversation-templates.md) | P2 | **Picked as first to ship** — smallest diff, no schema change, high demo value |
| 4 | [chat-skill-composition](chat-skill-composition.md) | P3 | Cross-runtime regression surface; requires careful smoke budget per MEMORY.md |
| 5 | [chat-conversation-branches](chat-conversation-branches.md) | P3 | Largest design surface (schema, tree view, rewind); defer until dogfooding evidence |

## Do not implement this spec directly

This document is preserved as a historical pointer. All future work references the sub-specs above.

## References

- Original umbrella content archived in git history (commit prior to 2026-04-14 split)
- Grooming decision: [changelog](changelog.md) 2026-04-14 entry
