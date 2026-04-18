---
title: Runtime Validation Hardening
status: completed
priority: P1
milestone: post-mvp
source: conversation — reddit-researcher profile crash (2026-03-31)
dependencies: [provider-runtime-abstraction, multi-agent-routing]
---

# Runtime Validation Hardening

## Description

Creating a task via the MCP `create_task` / `execute_task` chat tools can write invalid runtime IDs to the database, crashing the UI when the task detail page calls `resolveAgentRuntime()`. The REST API validator (`src/lib/validators/task.ts`) already validates `assignedAgent` against `SUPPORTED_AGENT_RUNTIMES` via Zod, but the MCP tool layer bypasses this validation entirely — it inserts directly into the DB without using the shared schema.

Root cause chain discovered during a live session: the `execute_task` MCP tool hardcodes `"claude"` as the fallback runtime (line 212 of task-tools.ts), but the valid ID is `"claude-code"`. This invalid value was written to the `assignedAgent` column, and `resolveAgentRuntime()` threw `Unknown agent type: claude` when the detail page rendered.

Three gaps compound the issue:
1. **`execute_task` MCP tool** — hardcoded `"claude"` fallback instead of `DEFAULT_AGENT_RUNTIME`; no validation of the `assignedAgent` param against the runtime catalog
2. **`create_task` / `update_task` MCP tools** — don't expose `assignedAgent` or `agentProfile` parameters at all, forcing workarounds via direct API PATCH (which does validate)
3. **`resolveAgentRuntime()`** — throws on unknown IDs instead of falling back gracefully, propagating a data-layer issue into a UI crash

## User Story

As a user chatting with ainative, I want to create and execute tasks with specific runtimes and agent profiles through the chat interface — and if I (or the system) provide an invalid runtime ID, I want a clear error message rather than a page crash.

## Acceptance Criteria

- [x] `execute_task` MCP tool uses `DEFAULT_AGENT_RUNTIME` from catalog.ts instead of hardcoded `"claude"` string
- [x] `execute_task` MCP tool validates `assignedAgent` param against `SUPPORTED_AGENT_RUNTIMES` before writing to DB; returns a tool error with valid options if invalid
- [x] `create_task` MCP tool exposes optional `assignedAgent` (validated) and `agentProfile` parameters
- [x] `update_task` MCP tool exposes optional `assignedAgent` (validated) and `agentProfile` parameters
- [x] `resolveAgentRuntime()` returns `DEFAULT_AGENT_RUNTIME` with a console warning instead of throwing on unknown IDs (graceful degradation)
- [x] Existing Zod validator in `task.ts` remains the source of truth for REST API validation (no duplication)
- [x] Unit test covers: valid runtime passes, invalid runtime returns error (MCP tool level), unknown runtime falls back (resolveAgentRuntime level)
- [x] The `execute_task` tool description documents valid runtime IDs (e.g. `claude-code`, `openai-codex-app-server`, `anthropic-direct`, `openai-direct`)

## Technical Approach

### 1. Fix `resolveAgentRuntime()` — Graceful Fallback

**File:** `src/lib/agents/runtime/catalog.ts`

Change line 117 from `throw new Error(...)` to:
```ts
console.warn(`Unknown agent runtime "${runtimeId}", falling back to "${DEFAULT_AGENT_RUNTIME}"`);
return DEFAULT_AGENT_RUNTIME;
```

This prevents any data-layer corruption from cascading into UI crashes. The UI will render with the default runtime rather than white-screening.

### 2. Fix `execute_task` MCP Tool — Correct Fallback + Validation

**File:** `src/lib/chat/tools/task-tools.ts`

- Import `DEFAULT_AGENT_RUNTIME`, `isAgentRuntimeId`, `SUPPORTED_AGENT_RUNTIMES` from catalog
- Change line 212: `?? "claude"` → `?? DEFAULT_AGENT_RUNTIME`
- Add validation before DB write:
  ```ts
  if (args.assignedAgent && !isAgentRuntimeId(args.assignedAgent)) {
    return err(`Invalid runtime "${args.assignedAgent}". Valid: ${SUPPORTED_AGENT_RUNTIMES.join(", ")}`);
  }
  ```
- Update tool description to list valid runtime IDs

### 3. Expose `assignedAgent` + `agentProfile` on `create_task` and `update_task`

**File:** `src/lib/chat/tools/task-tools.ts`

Add to both tool schemas:
```ts
assignedAgent: z.string().optional().describe("Runtime ID: claude-code (default), openai-codex-app-server, anthropic-direct, openai-direct"),
agentProfile: z.string().optional().describe("Agent profile ID (e.g. general, code-reviewer, researcher, reddit-researcher)"),
```

Add validation in both handlers using `isAgentRuntimeId()` before DB insert/update.

### 4. Unit Tests

**File:** `src/lib/chat/tools/__tests__/task-tools-validation.test.ts`

- Test: `execute_task` with invalid runtime returns error listing valid options
- Test: `create_task` with valid runtime writes correctly
- Test: `create_task` with invalid runtime returns error
- Test: `resolveAgentRuntime("claude")` returns `"claude-code"` (fallback) instead of throwing

**File:** `src/lib/agents/runtime/__tests__/catalog.test.ts` (extend existing)

- Test: `resolveAgentRuntime("invalid")` returns default with warning

## Scope Boundaries

**Included:**
- MCP tool validation for assignedAgent
- Graceful fallback in resolveAgentRuntime()
- Expose assignedAgent + agentProfile on all 3 MCP task tools
- Unit tests

**Excluded / Deferred:**
- DB migration to add CHECK constraint on assignedAgent column (low value — app-layer validation is sufficient)
- Retroactive data cleanup of existing tasks with invalid runtime values (one-off, already fixed manually)
- Profile compatibility validation in MCP tools (already handled in REST API via `validateRuntimeProfileAssignment`)

## Impact Assessment

- **Severity:** P1 — invalid data causes full page crash (white screen), no recovery without manual DB fix
- **Blast radius:** Any task created/executed via chat with wrong runtime ID
- **Fix complexity:** Low — 4 small changes across 2 files + tests
- **Regression risk:** Minimal — adds validation without changing happy-path behavior
