---
title: Direct Runtime Prompt Caching
status: planned
priority: P2
milestone: post-mvp
source: ideas/direct-api-gap-analysis.md
dependencies: [anthropic-direct-runtime]
---

# Direct Runtime Prompt Caching

## Description

The Anthropic Messages API supports prompt caching — marking content blocks with `cache_control` so repeated prompts reuse cached token processing at 90% lower cost. ainative's task and chat execution patterns are ideal for caching: the same system prompt + profile instructions + learned context are sent with every task for a given profile.

This feature wires prompt caching into the `anthropic-direct` runtime adapter. It's a pure cost optimization — no behavior changes, no new UI beyond usage dashboard enhancements to show cache hit rates.

## User Story

As a ainative user running tasks on the Anthropic Direct runtime, I want prompt caching enabled automatically so that repeated tasks with the same profile cost up to 90% less on input tokens.

## Technical Approach

### Cache Block Strategy

ainative's system prompt has a natural layering that maps perfectly to cache breakpoints:

```
┌─────────────────────────────────┐
│ Base system prompt              │ ← cache_control: ephemeral (stable across all tasks)
├─────────────────────────────────┤
│ Profile instructions (SKILL.md) │ ← cache_control: ephemeral (stable per profile)
├─────────────────────────────────┤
│ Learned context block           │ ← cache_control: ephemeral (stable per profile, changes slowly)
├─────────────────────────────────┤
│ Document context                │ ← NOT cached (varies per task)
├─────────────────────────────────┤
│ Task-specific prompt            │ ← NOT cached (unique per task)
└─────────────────────────────────┘
```

The first 3 blocks are stable across tasks with the same profile → ideal for caching. The bottom 2 vary per task → not cached.

### Implementation

- In `anthropic-direct.ts`, when building the system prompt for `messages.create()`:
  - Split system content into multiple `content` blocks within the `system` parameter
  - Add `cache_control: { type: "ephemeral" }` to the base prompt block, profile block, and learned context block
  - Leave document context and task prompt uncached
- Track cache performance via `usage` response fields:
  - `cache_creation_input_tokens` — tokens processed and cached (first call)
  - `cache_read_input_tokens` — tokens read from cache (subsequent calls, 90% cheaper)
- Record cache metrics in usage ledger entries for dashboard visibility

### Usage Dashboard Enhancement

- Add cache hit rate to cost-and-usage dashboard
- Show `cache_read_input_tokens` vs `input_tokens` ratio per runtime
- Calculate and display actual cost savings from caching

### Batch API for Meta-Completions

ainative's meta-completions (task assist, profile assist, pattern extraction) are single-turn, non-time-sensitive queries. These are ideal for the Anthropic Batch API which offers 50% discount:

- In `anthropic-direct.ts`, add `batchMode` option for `runTaskAssist()` and `runProfileAssist()`
- Use `messages.batches.create()` for batch-eligible queries
- Poll for completion (batch API is async, results available within 24h but usually minutes)
- Not suitable for real-time task execution (only meta-completions)

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/agents/runtime/anthropic-direct.ts` | Add cache_control to system prompt blocks |
| `src/lib/agents/runtime/anthropic-direct.ts` | Add batch mode for meta-completions |
| `src/lib/usage/ledger.ts` | Record cache_creation and cache_read token counts |
| `src/lib/db/schema.ts` | Add cache token columns to usage_ledger (if not already present) |
| `src/components/dashboard/usage-chart.tsx` | Show cache hit rate and savings |

## Acceptance Criteria

- [ ] System prompt blocks have `cache_control: { type: "ephemeral" }` on stable content
- [ ] Second task with same profile shows `cache_read_input_tokens > 0` in usage logs
- [ ] Cost savings visible in usage dashboard (cache read tokens at 10% of normal cost)
- [ ] Cache metrics recorded in usage ledger entries
- [ ] Batch API used for task assist and profile assist meta-completions (when not time-critical)
- [ ] No behavior change — task outputs identical with or without caching
- [ ] No impact on other runtimes (caching is `anthropic-direct` only)

## Scope Boundaries

**Included:**
- Prompt caching with `cache_control` on system prompt blocks
- Cache performance tracking in usage ledger
- Batch API for meta-completions
- Usage dashboard cache metrics

**Excluded:**
- Caching for `claude-code` runtime (SDK controls its own caching)
- User-configurable cache TTL (API manages TTL automatically: 5-min default, 1-hr extended)
- Cache warming strategies (natural usage provides cache hits)

## References

- Source: `ideas/direct-api-gap-analysis.md` — Section 5 "Cost Comparison" and Section 9 Phase 4
- Anthropic docs: Prompt caching with `cache_control` parameter
- Existing: `src/lib/usage/ledger.ts` for usage tracking pattern
