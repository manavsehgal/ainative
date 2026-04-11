---
title: Task Create Profile Validation + Disappearance Investigation
status: planned
priority: P1
milestone: post-mvp
source: handoff/bug-task-silently-disappears-after-creation.md
dependencies: [agent-integration, agent-profile-catalog]
---

# Task Create Profile Validation + Disappearance Investigation

## Description

Close the validation gap in `create_task` — today it accepts any string as `agentProfile`, including values that are runtimes rather than profiles (e.g., `anthropic-direct`), so users can create tasks that are guaranteed to fail at execution time with no feedback at creation time.

Bundled with the validation fix is a time-boxed investigation spike for a separate reported symptom: a task whose ID was returned by `create_task` later became unfindable via `get_task`. The original handoff attributed this to "the task record was deleted." A codebase audit found **no task deletion code anywhere in stagent** — `claude-agent.ts` persists failed tasks with `status: "failed"` and `failureReason` in every error path, and there is no GC/cleanup for tasks. The disappearance is almost certainly a scoping mismatch (the `STAGENT_DATA_DIR` env var used for isolation between domain clones, or the `projectId` filter on queries) rather than a data-loss bug. The spike must establish the real cause before we change any production code.

## User Story

As an operator creating tasks via chat or MCP, I want invalid profile IDs rejected at creation time with a clear error, and I want any task whose ID I've been handed to remain findable via `get_task` for as long as the task exists — so I never see "task not found" for a task I just created.

## Technical Approach

### 1. Profile validation at `create_task`

- In `src/lib/chat/tools/task-tools.ts:91-96`, convert the `agentProfile` field from an open `z.string()` into a `z.string().refine(...)` that checks the id against the profile registry via `getProfile()` from `src/lib/agents/profiles/registry.ts`.
- On validation failure, return a descriptive error message that names the invalid value and lists the currently-registered profile ids (the registry's `listProfiles()` output).
- Keep validation synchronous — the registry is an in-memory map, so there's no async cost.

### 2. Investigation spike for the disappearance claim (time-boxed, ~2 hours)

Before touching any "preserve failed tasks" code, reproduce the original symptom and determine the real cause. Candidates:

1. **Data-dir mismatch.** The creating context (e.g., a chat session in one domain clone) has `STAGENT_DATA_DIR=~/.stagent/wealth-mgr` while the querying context hits `~/.stagent`. See `MEMORY.md` → `shared-stagent-data-dir.md`.
2. **Project scoping mismatch.** Task created under `projectId=A`, queried under `projectId=B`. `get_task` may filter by current project.
3. **Transaction rollback.** A create-then-execute path that wraps both in a transaction and rolls back on execution failure.
4. **Something else entirely** — the spike output is the data that tells us.

The spike writes its findings directly into the "References" section of this spec as a short addendum, with file:line citations, before any remediation code is merged. If the cause turns out to be #1 or #2, the remediation is a documentation + error-message improvement rather than a data-layer change.

### 3. Failed-state preservation (only if the spike finds a gap)

The codebase already persists failed tasks in every path the Explore pass examined:
- `src/lib/agents/claude-agent.ts:300-309` — result frame handler writes `status: "failed"`
- `src/lib/agents/claude-agent.ts:363-371` — stream-exhaustion safety net with `failureReason`
- `src/lib/agents/claude-agent.ts:731-740` — `handleExecutionError` persists status

If the spike reveals a failure path that does NOT persist status, fix it there with a single targeted change. Otherwise this acceptance criterion becomes verification-only.

### 4. Synchronous error surfacing in `execute_task`

When `execute_task` is called with a task that has a validation error knowable synchronously (invalid profile caught at creation, or a task created before this fix with an invalid profile), the tool response should include the error field in its immediate response rather than returning a 202 and leaving the user to poll.

## Acceptance Criteria

- [ ] `create_task` rejects `agentProfile` values not in the profile registry with a descriptive error that names the invalid value and lists valid options.
- [ ] A new test in `src/lib/chat/tools/__tests__/task-tools.test.ts` asserts `create_task` with `agentProfile: "anthropic-direct"` is rejected.
- [ ] The investigation spike documents the actual cause of the reported disappearance in this spec's References section (with file:line citations) before any failed-state-preservation code is written.
- [ ] No task returned from `create_task` is unfindable via `get_task` within the same data-dir + project scope (verified by a new integration test that creates, triggers a failure, and reads back).
- [ ] `execute_task` surfaces validation/profile errors synchronously in its response for synchronous-failure cases.
- [ ] Existing `task-tools` tests still pass.

## Scope Boundaries

**Included:**
- Profile validation at `create_task` (Zod refine + error message)
- Investigation spike for the disappearance symptom
- Test coverage for profile validation
- MCP response surfacing for synchronously-known failures

**Excluded:**
- A general task cleanup/GC retention policy (none exists today — do not build one speculatively)
- Profile validation on `execute_task` (already happens at runtime via `getProfile`)
- Refactoring the runtime-vs-profile taxonomy
- Any change to the domain-clone `STAGENT_DATA_DIR` isolation model (even if the spike finds it is the cause — the fix there is error messaging, not isolation changes)

## References

- Source: `handoff/bug-task-silently-disappears-after-creation.md`
- `src/lib/chat/tools/task-tools.ts:91-96` — `create_task` Zod schema (target of validation change)
- `src/lib/agents/profiles/registry.ts:143-170` — `getProfile` / `listProfiles`
- `src/lib/agents/claude-agent.ts:300-309, 363-371, 731-740` — existing failed-state persistence paths
- `MEMORY.md` → `shared-stagent-data-dir.md` — domain-clone isolation model, likely root cause of the disappearance symptom
- **Correction note:** The handoff's claim "the task record was deleted rather than being preserved with a `failed` status" is not supported by the codebase. No DELETE on tasks exists anywhere in `src/`. The groomed spec frames the fix as "add validation + investigate scoping mismatch" instead of "stop deleting tasks."
- **Spike addendum (to be filled in by spike subtask):** _actual root cause + file:line evidence_
