---
title: "Bug: Task Disappears After Creation — No Trace in API"
audience: ainative-base
status: proposed
source_branch: wealth-mgr
handoff_reason: A task was created and returned a valid ID, but subsequently became unfindable via get_task or list_tasks. No error was surfaced at creation time. This suggests either silent garbage collection, a failed execution that deletes the record, or a creation race condition.
---

# Bug: Task Disappears After Creation — No Trace in API

## Summary

During testing, a task was created via `create_task` which returned task ID `38911ccb`. The task was then executed via `execute_task`. When later queried via `get_task`, it returned `"Task not found: 38911ccb"`. The task also did not appear in `list_tasks` results.

The task was created with an invalid profile value (`anthropic-direct` — which is a runtime, not a profile). The execution likely failed immediately due to the invalid profile, but:

1. **`create_task` did not validate the profile** and returned success
2. **`execute_task` did not return a clear error** about the invalid profile
3. **The task record was deleted** rather than being preserved with a `failed` status
4. **No notification or error trace** was left behind

## Expected Behavior

- `create_task` should validate `agentProfile` against known profiles and reject invalid values
- Failed tasks should remain in the database with `status: "failed"` and an error message
- `get_task` should always return a record for any ID that was previously returned by `create_task`
- Users should never encounter "task not found" for a task they just created

## Observed Behavior

1. `create_task` accepted `anthropic-direct` as a profile → returned `38911ccb` ✅ (no validation)
2. `execute_task` was called → approval granted → execution started
3. Task hit auth error ("No Anthropic API key configured")
4. Sometime after failure, the task record was deleted from the database
5. `get_task("38911ccb")` → `"Task not found"` ❌

## Proposed Fix

1. **Validate `agentProfile`** in `create_task` against the list of known profiles; reject with a clear error if invalid
2. **Never delete failed task records** — set `status: "failed"` with an `error` field describing what went wrong
3. **Surface execution errors** in the task record so they're visible via `get_task`
4. If there's a cleanup/GC process that removes old tasks, ensure it only removes tasks older than a retention threshold (e.g., 30 days) and never removes tasks created in the current session

## Affected Areas

- Task creation validation (profile check)
- Task execution error handling (preserve failed records)
- Task cleanup/GC logic (if exists)
- MCP tool response for `execute_task` (surface errors immediately)

## Acceptance Criteria

- [ ] `create_task` rejects invalid `agentProfile` values with a descriptive error
- [ ] Failed tasks persist with `status: "failed"` and an `error` field
- [ ] `get_task` returns records for all previously-created tasks (within retention window)
- [ ] `execute_task` surfaces execution errors in its response when the task fails immediately
