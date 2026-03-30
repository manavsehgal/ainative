---
id: TDR-015
title: Permission pre-check caching with auto-approve patterns
date: 2026-03-30
status: accepted
category: workflow
---

# TDR-015: Permission pre-check caching with auto-approve patterns

## Context

Agents make many tool calls during execution. Each tool call potentially requires human approval, which is slow (1.5s poll interval, up to 55s timeout). Repeated identical tool calls would spam the inbox.

## Decision

Three-tier permission system: (1) Profile-level auto-approve/auto-deny patterns in canUseToolPolicy, (2) User-configured "Always Allow" patterns persisted in settings, (3) In-memory cache keyed by taskId::toolName::JSON.stringify(input) for deduplication. Permission checks cascade: auto-approve → cache hit → create notification + poll.

## Consequences

- Dramatically reduces notification noise for repeated tool patterns.
- "Always Allow" gives users persistent control without per-task overhead.
- Cache key includes full input, so different arguments create separate permission requests.
- Cache is per-task (cleared on task completion).

## Alternatives Considered

- **Approve-all mode** — no governance.
- **Per-tool-name caching only** — misses input-specific risks.
- **Database-backed cache** — over-engineered, memory is fine for task lifetime.

## References

- `src/lib/agents/claude-agent.ts` (buildPermissionCacheKey, permission cascade)
- `src/lib/db/schema.ts` (settings table for Always Allow)
