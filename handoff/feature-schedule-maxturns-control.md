---
title: "Feature: Expose maxTurns on Schedule API"
audience: ainative-base
status: proposed
source_branch: wealth-mgr
handoff_reason: Schedule records store a maxTurns field but the update_schedule API doesn't expose it, preventing users from tuning per-schedule turn budgets. create_schedule also lacks this parameter.
---

# Feature: Expose maxTurns on Schedule API

## Summary

Schedules have a `maxTurns` field (visible in `get_schedule` responses, currently always `null`) that controls the maximum number of turns an agent can consume per firing. However, neither `create_schedule` nor `update_schedule` expose this field — users cannot set or modify it.

This matters because different schedules have wildly different complexity:
- A simple portfolio snapshot might need 10–15 turns
- A news sentinel with web searches + table operations might need 40–60
- The system default (unknown, appears to be ~48) may be too low for complex prompts or too high for simple ones

## Current State

**`update_schedule` accepted parameters:**
- `name`, `prompt`, `interval`, `agentProfile`, `assignedAgent`, `status`
- No `maxTurns`

**`create_schedule` accepted parameters:**
- `name`, `prompt`, `interval`, `agentProfile`, `projectId`
- No `maxTurns`

**`get_schedule` response includes:**
- `maxTurns: null` — field exists on the data model but is never writable

## Proposed Fix

1. Add `maxTurns` (optional integer, min 10, max 500) to `update_schedule` input schema
2. Add `maxTurns` (optional integer, min 10, max 500) to `create_schedule` input schema
3. When `maxTurns` is set, pass it through to the task execution runtime so the agent respects the cap
4. When `maxTurns` is null, continue using the system default

## Affected Files

- Schedule MCP tool definitions (input schemas for create/update)
- Schedule service layer (persist maxTurns on create/update)
- Task execution runtime (read maxTurns from schedule and enforce it)

## Acceptance Criteria

- [ ] `create_schedule` accepts optional `maxTurns` parameter
- [ ] `update_schedule` accepts optional `maxTurns` parameter
- [ ] `get_schedule` reflects the user-set value
- [ ] Task execution enforces the cap when set
- [ ] Null/unset maxTurns falls back to system default (no behavioral change)
