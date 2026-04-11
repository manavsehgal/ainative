# Task Runtime Stagent MCP Injection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the in-process stagent MCP server into `executeClaudeTask` and `resumeClaudeTask` so scheduled and manual tasks running under the `claude-code` runtime have reliable access to `mcp__stagent__*` tools.

**Architecture:** Small, surgical edit in one file (`src/lib/agents/claude-agent.ts`). Both execution entry points already build a `mergedMcpServers` object and already conditionally pass `allowedTools`. We (1) call the existing `createStagentMcpServer(task.projectId)` factory and merge its output into `mergedMcpServers` under the `stagent` key, and (2) conditionally prepend `"mcp__stagent__*"` to `allowedTools` only when the profile already provided one, so profiles relying on the `claude_code` preset's default tool surface are not accidentally restricted. Permission gating is unchanged — the existing `handleToolPermission` + per-profile `canUseToolPolicy` model is the correct design for task execution and does not need to be ported from the chat engine's inline switch.

**Tech Stack:** TypeScript, `@anthropic-ai/claude-agent-sdk`, Vitest (hoisted mocks), better-sqlite3 via Drizzle (untouched here).

**Spec:** `features/task-runtime-stagent-mcp-injection.md`
**Source handoff:** `handoff/bug-task-execution-missing-stagent-mcp.md`

---

## What already exists (no new code needed)

| Asset | Path | Why we reuse it |
|---|---|---|
| `createToolServer(projectId, onToolResult?)` factory | `src/lib/chat/stagent-tools.ts:70-113` | Returns `{ asMcpServer, forProvider, definitions }`. Call `.asMcpServer()` to get the SDK-compatible server object for the `claude-code` runtime path. **Note:** `createStagentMcpServer` is a deprecated wrapper for chat-engine back-compat — new code should call `createToolServer().asMcpServer()` directly (see the `@deprecated` JSDoc at line 125). |
| `mergedMcpServers` merge pattern | `src/lib/agents/claude-agent.ts:487-493` (execute) and `:606-612` (resume) | Already merges profile + browser + external MCP servers. We prepend `stagent:` as the first key. |
| Conditional `allowedTools` pattern | `src/lib/agents/claude-agent.ts:511` and `:631` | Already omits `allowedTools` when the profile has none, preserving preset defaults. We extend this pattern: when present, prepend `"mcp__stagent__*"`; when absent, still omit. |
| `handleToolPermission` + `ctx.canUseToolPolicy` | `src/lib/agents/claude-agent.ts:516-521` and `:635-641`; `src/lib/agents/tool-permissions.ts:115` | Per-profile `autoApprove`/`autoDeny` + saved user patterns + notification-based approval. Already correctly gates stagent tools by default — any stagent tool not explicitly auto-approved by a profile creates an approval notification. **Do not change.** |
| Test harness with hoisted mocks | `src/lib/agents/__tests__/claude-agent.test.ts` | `vi.mocked(query)` captures call args on the first call. `createMockStream()` helper yields fake SDK frames. `makeTask()` helper produces task rows. `mockQuery.mock.calls[0][0].options` is the assertion surface. |

## NOT in scope

| Excluded item | Why |
|---|---|
| Lifting `PERMISSION_GATED_TOOLS` out of `src/lib/chat/engine.ts` into a shared constant | The task path already has a stronger per-profile `canUseToolPolicy` model. The chat engine's inline deny-list is a chat-specific shortcut and porting it would argue with the existing architecture. See spec's Technical Approach third bullet. |
| Refactoring the stagent tool registry (`createToolServer` / `asMcpServer`) | Factory is already correctly structured and already reused by `openai-direct` / `anthropic-direct`. |
| Adding wildcard support to `canUseToolPolicy.autoApprove` | Profiles currently list exact tool names. Wildcard support is a separate feature — file as follow-up if any profile needs to auto-approve "all stagent read tools". |
| Rewiring `openai-direct` / `anthropic-direct` runtimes | They already inject stagent tools via `createToolServer` (see `src/lib/agents/runtime/openai-direct.ts:19`, `anthropic-direct.ts:18`). |
| Chat engine changes | The chat engine's injection already works. Do not touch `src/lib/chat/engine.ts`. |
| Backfill of historical tasks | This bug is about runtime wiring, not data. |
| End-to-end smoke test against a real DB | Vitest mocks are sufficient for the wiring assertion. A real-DB smoke run is step 4 of the verification section, not a coded test. |

## Error & Rescue Registry

| Failure mode | Detection | Recovery |
|---|---|---|
| Profile has `allowedTools: []` (empty array, truthy, falls into the "has allowlist" branch) | Test A (below) covers this — the empty-array case should still prepend `mcp__stagent__*`, producing `["mcp__stagent__*"]`. | Intentional: an empty allowlist plus stagent prepended gives the agent access to stagent tools only. This is the safest interpretation of a profile that explicitly opted out of all other tools. |
| Profile has `allowedTools: undefined` / not set | Conditional spread omits `allowedTools` entirely. SDK falls back to `claude_code` preset defaults. Stagent tools are still reachable because they are registered via `mcpServers.stagent`. | Intentional: do not pass `allowedTools` unless the profile set one. No code change needed beyond what the current conditional already does. |
| `createStagentMcpServer` throws (tool registry init failure) | The `try { ... } catch` block at `claude-agent.ts:478-548` already catches and calls `handleExecutionError`, which persists `status: "failed"` with `failureReason`. No new handling needed. | Existing `handleExecutionError` path. Task is marked failed with the thrown error message. |
| Duplicate `stagent` key collision (profile defines its own `stagent` MCP server) | Spread order `{ stagent: stagentServer, ...profileMcpServers }` — profile wins, overwriting ours. | **Problem:** a malicious or misconfigured profile could shadow our stagent server. **Mitigation:** reverse the spread order — `{ ...profileMcpServers, stagent: stagentServer }` — so stagent always wins. Codified in Task 1, Step 3. |
| `allowedTools` contains a literal `"mcp__stagent__*"` already (profile pre-declared it) | Test D covers: when the profile already lists `"mcp__stagent__*"`, don't duplicate it. | Use `profileAllowedTools.includes("mcp__stagent__*") ? profileAllowedTools : ["mcp__stagent__*", ...profileAllowedTools]`. Simpler alternative: deduplicate via `Array.from(new Set(...))`. Task 1 uses the `Set` form — cleaner and handles overlaps from browser/external patterns too. |

## File Structure

**Modified:**
- `src/lib/agents/claude-agent.ts` — 2 edit sites: `executeClaudeTask` MCP merge (~line 487-514) and `resumeClaudeTask` MCP merge (~line 606-634). One new import.
- `src/lib/agents/__tests__/claude-agent.test.ts` — add 4 new tests (2 per execution path), plus one new `vi.mock` block for `@/lib/chat/stagent-tools`.

**Created:** None.

**Unchanged (do not touch):** `src/lib/chat/engine.ts`, `src/lib/chat/stagent-tools.ts`, `src/lib/agents/tool-permissions.ts`, `src/lib/agents/profiles/**`, any runtime adapter under `src/lib/agents/runtime/`.

---

## Task 1: Wire stagent injection into `executeClaudeTask`

**Files:**
- Modify: `src/lib/agents/claude-agent.ts` (imports + `executeClaudeTask` MCP merge at lines 487-514)
- Test: `src/lib/agents/__tests__/claude-agent.test.ts` (add `vi.mock` for stagent-tools + 2 new tests in Group A)

---

- [ ] **Step 1: Add the stagent-tools mock to the test file**

Open `src/lib/agents/__tests__/claude-agent.test.ts`. Locate the block of `vi.mock(...)` calls around lines 81-142 (after the hoisted mock declarations, before the static `import { executeClaudeTask, resumeClaudeTask } from "../claude-agent"` at line 147). Add this mock at the end of the block, just before the static imports:

```ts
vi.mock("@/lib/chat/stagent-tools", () => ({
  createToolServer: vi.fn((_projectId?: string | null) => ({
    asMcpServer: () => ({ __mockStagentServer: true }),
  })),
}));
```

This returns a sentinel object whose identity we can assert on in later steps. Mocking `createToolServer` (not the deprecated `createStagentMcpServer` wrapper) matches the production import.

- [ ] **Step 2: Write the failing test — `executeClaudeTask` injects stagent into `mcpServers`**

In `src/lib/agents/__tests__/claude-agent.test.ts`, inside the `describe("executeClaudeTask", ...)` block (around line 215), add this test after the existing A1/A2 tests:

```ts
it("A-stagent-1: injects stagent MCP server into query mcpServers", async () => {
  mockWhere.mockResolvedValueOnce([makeTask({ projectId: "proj-7" })]);
  mockQuery.mockReturnValue(
    createMockStream([
      { type: "result", result: "done" },
    ]) as unknown as ReturnType<typeof query>
  );

  await executeClaudeTask("task-1");

  const queryCall = mockQuery.mock.calls[0][0] as {
    options: { mcpServers?: Record<string, unknown> };
  };
  expect(queryCall.options.mcpServers).toBeDefined();
  expect(queryCall.options.mcpServers!.stagent).toEqual({ __mockStagentServer: true });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
npx vitest run src/lib/agents/__tests__/claude-agent.test.ts -t "A-stagent-1"
```

Expected: FAIL. Either `mcpServers` is undefined (current behavior when `mergedMcpServers` is empty due to the `Object.keys().length > 0` guard) or `mcpServers.stagent` is missing.

- [ ] **Step 4: Add the import to `claude-agent.ts`**

Open `src/lib/agents/claude-agent.ts`. Find the line importing from `browser-mcp`:

```ts
import { getBrowserMcpServers, getExternalMcpServers } from "./browser-mcp";
```

Immediately after this line, add:

```ts
import { createToolServer } from "@/lib/chat/stagent-tools";
```

(`createStagentMcpServer` is a `@deprecated` wrapper — new code uses `createToolServer(...).asMcpServer()`.)

- [ ] **Step 5: Inject stagent into `executeClaudeTask`'s MCP merge**

Still in `src/lib/agents/claude-agent.ts`, find this block around lines 487-493:

```ts
    // Merge browser + external MCP servers when enabled globally
    const [browserServers, externalServers] = await Promise.all([
      getBrowserMcpServers(),
      getExternalMcpServers(),
    ]);
    const profileMcpServers = ctx.payload?.mcpServers ?? {};
    const mergedMcpServers = { ...profileMcpServers, ...browserServers, ...externalServers };
```

Replace it with:

```ts
    // Merge browser + external MCP servers when enabled globally
    const [browserServers, externalServers] = await Promise.all([
      getBrowserMcpServers(),
      getExternalMcpServers(),
    ]);
    // Inject the in-process stagent MCP server so scheduled and manual tasks
    // have access to mcp__stagent__* tools (table CRUD, notifications, etc.).
    // Spread profile/browser/external first, then stagent — ensures no profile
    // can accidentally shadow our server under the `stagent` key.
    const stagentServer = createToolServer(task.projectId).asMcpServer();
    const profileMcpServers = ctx.payload?.mcpServers ?? {};
    const mergedMcpServers = {
      ...profileMcpServers,
      ...browserServers,
      ...externalServers,
      stagent: stagentServer,
    };
```

- [ ] **Step 6: Run the test to verify it passes**

Run:
```bash
npx vitest run src/lib/agents/__tests__/claude-agent.test.ts -t "A-stagent-1"
```

Expected: PASS. `mockQuery.mock.calls[0][0].options.mcpServers.stagent` equals `{ __mockStagentServer: true }`.

- [ ] **Step 7: Write the failing test — `executeClaudeTask` prepends `mcp__stagent__*` only when profile has an allowlist**

Back in the test file, the default `mockGetProfile` mock (line 199-204) returns `{ allowedTools: undefined }`, so `ctx.payload?.allowedTools` will also be falsy by default. We need a test that sets up a profile with an explicit allowlist.

Add this test right after A-stagent-1:

```ts
it("A-stagent-2: prepends mcp__stagent__* when profile has allowedTools", async () => {
  mockWhere.mockResolvedValueOnce([makeTask({ projectId: "proj-7" })]);
  mockGetProfile.mockReturnValueOnce({
    id: "restricted",
    name: "Restricted",
    systemPrompt: "",
    allowedTools: ["Read", "Grep"],
  });
  mockQuery.mockReturnValue(
    createMockStream([
      { type: "result", result: "done" },
    ]) as unknown as ReturnType<typeof query>
  );

  await executeClaudeTask("task-1");

  const queryCall = mockQuery.mock.calls[0][0] as {
    options: { allowedTools?: string[] };
  };
  expect(queryCall.options.allowedTools).toBeDefined();
  expect(queryCall.options.allowedTools).toContain("mcp__stagent__*");
  expect(queryCall.options.allowedTools).toContain("Read");
  expect(queryCall.options.allowedTools).toContain("Grep");
  // Duplicates not added when profile didn't already include the pattern
  const stagentCount = queryCall.options.allowedTools!.filter(
    (t) => t === "mcp__stagent__*"
  ).length;
  expect(stagentCount).toBe(1);
});
```

- [ ] **Step 8: Write the failing test — `executeClaudeTask` omits `allowedTools` entirely when profile has none**

Add this test right after A-stagent-2:

```ts
it("A-stagent-3: omits allowedTools when profile has none (preset defaults preserved)", async () => {
  mockWhere.mockResolvedValueOnce([makeTask({ projectId: "proj-7" })]);
  // Default mockGetProfile returns allowedTools: undefined, so ctx.payload.allowedTools
  // will also be undefined — the query() call should NOT include an allowedTools option.
  mockQuery.mockReturnValue(
    createMockStream([
      { type: "result", result: "done" },
    ]) as unknown as ReturnType<typeof query>
  );

  await executeClaudeTask("task-1");

  const queryCall = mockQuery.mock.calls[0][0] as {
    options: { allowedTools?: string[] };
  };
  expect(queryCall.options.allowedTools).toBeUndefined();
});
```

- [ ] **Step 9: Run the new tests to verify they fail**

Run:
```bash
npx vitest run src/lib/agents/__tests__/claude-agent.test.ts -t "A-stagent-2"
npx vitest run src/lib/agents/__tests__/claude-agent.test.ts -t "A-stagent-3"
```

Expected: A-stagent-2 FAILS (current code passes profile's `allowedTools` as-is without prepending). A-stagent-3 PASSES already (current conditional already omits when falsy) — that's fine, it's a regression test.

- [ ] **Step 10: Implement the `allowedTools` merge in `executeClaudeTask`**

In `src/lib/agents/claude-agent.ts`, find this line around 511 (inside the `query({ ... options: { ... } })` call):

```ts
        ...(ctx.payload?.allowedTools && { allowedTools: ctx.payload.allowedTools }),
```

Replace it with:

```ts
        // When the profile set an explicit allowedTools, prepend mcp__stagent__*
        // so the stagent tool registration is not filtered out. When the profile
        // has no allowedTools, fall through to the preset defaults (stagent tools
        // are still reachable because they're registered via mcpServers.stagent).
        ...(ctx.payload?.allowedTools && {
          allowedTools: Array.from(
            new Set(["mcp__stagent__*", ...ctx.payload.allowedTools])
          ),
        }),
```

- [ ] **Step 11: Run the new tests to verify they pass**

Run:
```bash
npx vitest run src/lib/agents/__tests__/claude-agent.test.ts -t "A-stagent"
```

Expected: all three (A-stagent-1, A-stagent-2, A-stagent-3) PASS.

- [ ] **Step 12: Run the full `claude-agent.test.ts` file to check for regressions**

Run:
```bash
npx vitest run src/lib/agents/__tests__/claude-agent.test.ts
```

Expected: all tests PASS (existing A1/A2/B/C/D groups and the new A-stagent tests).

If any previously-passing test now fails, diagnose before proceeding. Most likely failure: a Group A test that previously asserted `mcpServers` was absent because the merge was empty — the new code always merges `stagent`, so `mcpServers` is now always present in the call args. Adjust the existing assertion to be `expect(queryCall.options.mcpServers).toBeDefined()` or inspect specific keys.

- [ ] **Step 13: Commit**

```bash
git add src/lib/agents/claude-agent.ts src/lib/agents/__tests__/claude-agent.test.ts
git commit -m "$(cat <<'EOF'
fix(agents): inject stagent MCP into executeClaudeTask

The claude-code runtime's executeClaudeTask was missing the in-process
stagent MCP server that chat engine, openai-direct, and anthropic-direct
all inject. Scheduled and manual tasks reported "No stagent table MCP
tools are available" when their prompts tried to read/write tables.

Adds createStagentMcpServer(task.projectId) to the mergedMcpServers
merge, and prepends mcp__stagent__* to allowedTools only when the
profile has an explicit allowlist (profiles without one continue to
use the claude_code preset defaults). The per-profile canUseToolPolicy
permission model is untouched — it already gates dangerous stagent
tools via handleToolPermission.

Tests A-stagent-1/2/3 cover the three branches. resumeClaudeTask
will receive the same treatment in the next commit.

Refs: features/task-runtime-stagent-mcp-injection.md
      handoff/bug-task-execution-missing-stagent-mcp.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Mirror the injection in `resumeClaudeTask`

**Files:**
- Modify: `src/lib/agents/claude-agent.ts` (`resumeClaudeTask` MCP merge at lines 606-634)
- Test: `src/lib/agents/__tests__/claude-agent.test.ts` (add 2 new tests in the `resumeClaudeTask` describe block)

---

- [ ] **Step 1: Find the `resumeClaudeTask` describe block in the test file**

Open `src/lib/agents/__tests__/claude-agent.test.ts` and search for `describe("resumeClaudeTask"`. If the block does not exist yet, create it at the end of the file (after Group D). If it exists, add the new tests inside.

```bash
grep -n 'describe("resumeClaudeTask' src/lib/agents/__tests__/claude-agent.test.ts
```

- [ ] **Step 2: Write the failing test — `resumeClaudeTask` injects stagent into `mcpServers`**

Add this test inside the `resumeClaudeTask` describe block (create the describe block if needed):

```ts
it("R-stagent-1: injects stagent MCP server into query mcpServers on resume", async () => {
  mockWhere.mockResolvedValueOnce([
    makeTask({
      projectId: "proj-7",
      sessionId: "session-abc",
      resumeCount: 1,
    }),
  ]);
  mockQuery.mockReturnValue(
    createMockStream([
      { type: "result", result: "resumed and done" },
    ]) as unknown as ReturnType<typeof query>
  );

  await resumeClaudeTask("task-1");

  const queryCall = mockQuery.mock.calls[0][0] as {
    options: { mcpServers?: Record<string, unknown>; resume?: string };
  };
  expect(queryCall.options.resume).toBe("session-abc");
  expect(queryCall.options.mcpServers).toBeDefined();
  expect(queryCall.options.mcpServers!.stagent).toEqual({ __mockStagentServer: true });
});
```

- [ ] **Step 3: Write the failing test — `resumeClaudeTask` prepends `mcp__stagent__*` when profile has allowlist**

Add this test right after R-stagent-1:

```ts
it("R-stagent-2: prepends mcp__stagent__* on resume when profile has allowedTools", async () => {
  mockWhere.mockResolvedValueOnce([
    makeTask({
      projectId: "proj-7",
      sessionId: "session-abc",
      resumeCount: 1,
    }),
  ]);
  mockGetProfile.mockReturnValueOnce({
    id: "restricted",
    name: "Restricted",
    systemPrompt: "",
    allowedTools: ["Read", "Grep"],
  });
  mockQuery.mockReturnValue(
    createMockStream([
      { type: "result", result: "resumed and done" },
    ]) as unknown as ReturnType<typeof query>
  );

  await resumeClaudeTask("task-1");

  const queryCall = mockQuery.mock.calls[0][0] as {
    options: { allowedTools?: string[] };
  };
  expect(queryCall.options.allowedTools).toContain("mcp__stagent__*");
  expect(queryCall.options.allowedTools).toContain("Read");
});
```

- [ ] **Step 4: Run both failing tests**

```bash
npx vitest run src/lib/agents/__tests__/claude-agent.test.ts -t "R-stagent"
```

Expected: both FAIL. `resumeClaudeTask` does not yet inject stagent.

- [ ] **Step 5: Inject stagent into `resumeClaudeTask`'s MCP merge**

In `src/lib/agents/claude-agent.ts`, find this block around lines 606-612 (inside `resumeClaudeTask`):

```ts
    // Merge browser + external MCP servers when enabled globally
    const [browserServers, externalServers] = await Promise.all([
      getBrowserMcpServers(),
      getExternalMcpServers(),
    ]);
    const profileMcpServers = ctx.payload?.mcpServers ?? {};
    const mergedMcpServers = { ...profileMcpServers, ...browserServers, ...externalServers };
```

Replace it with the same pattern as Task 1, Step 5:

```ts
    // Merge browser + external MCP servers when enabled globally
    const [browserServers, externalServers] = await Promise.all([
      getBrowserMcpServers(),
      getExternalMcpServers(),
    ]);
    // Inject the in-process stagent MCP server on resume too — session
    // resumption and workflow step execution both pass through this path.
    // Stagent wins the merge so no profile can shadow our server key.
    const stagentServer = createToolServer(task.projectId).asMcpServer();
    const profileMcpServers = ctx.payload?.mcpServers ?? {};
    const mergedMcpServers = {
      ...profileMcpServers,
      ...browserServers,
      ...externalServers,
      stagent: stagentServer,
    };
```

- [ ] **Step 6: Mirror the `allowedTools` merge in `resumeClaudeTask`**

In the same function, find this line around 631 (inside the `query({ ... options: { ... } })` call of `resumeClaudeTask`):

```ts
        ...(ctx.payload?.allowedTools && { allowedTools: ctx.payload.allowedTools }),
```

Replace it with the same block as Task 1, Step 10:

```ts
        // When the profile set an explicit allowedTools, prepend mcp__stagent__*
        // so the stagent tool registration is not filtered out. When the profile
        // has no allowedTools, fall through to the preset defaults.
        ...(ctx.payload?.allowedTools && {
          allowedTools: Array.from(
            new Set(["mcp__stagent__*", ...ctx.payload.allowedTools])
          ),
        }),
```

- [ ] **Step 7: Run the resume tests to verify they pass**

```bash
npx vitest run src/lib/agents/__tests__/claude-agent.test.ts -t "R-stagent"
```

Expected: both R-stagent tests PASS.

- [ ] **Step 8: Run the full `claude-agent.test.ts` file**

```bash
npx vitest run src/lib/agents/__tests__/claude-agent.test.ts
```

Expected: all tests PASS. Both A-stagent and R-stagent groups plus all existing tests.

- [ ] **Step 9: Run the TypeScript check**

```bash
npx tsc --noEmit
```

Expected: exit 0. If there are type errors unrelated to this change, flag them to the user but do not fix them in this plan.

- [ ] **Step 10: Commit**

```bash
git add src/lib/agents/claude-agent.ts src/lib/agents/__tests__/claude-agent.test.ts
git commit -m "$(cat <<'EOF'
fix(agents): inject stagent MCP into resumeClaudeTask

Mirrors the same stagent MCP server injection into resumeClaudeTask
so workflow step execution and session resumption also have reliable
access to mcp__stagent__* tools.

Tests R-stagent-1/2 cover mcpServers injection and allowedTools merge
on the resume path.

With this commit, features/task-runtime-stagent-mcp-injection.md is
fully implemented on both claude-code runtime entry points.

Refs: features/task-runtime-stagent-mcp-injection.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: End-to-end smoke verification

**Purpose:** The unit tests prove the wiring reaches the SDK call with the right shape. This task proves that a real task against a real stagent tool invocation actually works end-to-end — which is the acceptance criterion the user actually cares about.

**Files:** None (manual verification; record results in the spec's References section).

---

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: server boots on :3000 without errors. Wait for "✓ Ready".

- [ ] **Step 2: Create a test task that exercises stagent MCP**

Using the chat interface or a direct `create_task` MCP call, create a task whose prompt explicitly uses a stagent tool. A minimal example:

> Use `mcp__stagent__query_table` to list rows from any table in the current project. Report the row count. If no tables exist, say "no tables" and stop.

Assign it to the `general` profile (or any profile that does not override `allowedTools`).

- [ ] **Step 3: Execute the task**

Approve execution via the Inbox or the chat UI's approval toast. Watch the task's log stream.

Expected: the agent successfully invokes `mcp__stagent__query_table` (you should see a `tool_use` log entry with that tool name) and reports back with either the row count or "no tables". The agent must NOT report "No stagent table MCP tools are available in this session."

- [ ] **Step 4: Verify with a schedule (bonus, skip if time-pressed)**

Create a minimal schedule that runs every 5 minutes with the same prompt as Step 2. Wait for one firing, then check `get_schedule` for that schedule — `lastTurnCount` should be small (single digits) and the task should have completed successfully.

- [ ] **Step 5: Stop the dev server and record results**

Stop the dev server. Append a short "Verification run — 2026-04-11" note to `features/task-runtime-stagent-mcp-injection.md` in the References section, citing:
- Test task ID
- Tool invocation observed (`mcp__stagent__query_table`)
- Completion status
- (Optional) schedule firing id if Step 4 was run

If Step 3 fails — the agent still reports missing stagent tools — **do not proceed to flip the feature to completed**. Diagnose by checking the `agentLogs` table for the task, reading the SDK stderr chunks captured in `claude-agent.ts`, and re-running with `console.log(JSON.stringify(mergedMcpServers))` temporarily added before the `query()` call to confirm the stagent key is present at runtime. Report findings to the user.

- [ ] **Step 6: Commit the verification note**

```bash
git add features/task-runtime-stagent-mcp-injection.md
git commit -m "$(cat <<'EOF'
docs(features): record verification run for stagent MCP injection

Appends end-to-end verification notes to the feature spec after
confirming a test task successfully invoked mcp__stagent__query_table.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

**1. Spec coverage:** Every acceptance criterion in `features/task-runtime-stagent-mcp-injection.md` maps to a task:
- "executeClaudeTask calls createStagentMcpServer..." → Task 1, Step 5
- "resumeClaudeTask does the same" → Task 2, Step 5
- "When the profile has an explicit allowedTools, mcp__stagent__* is prepended" → Task 1 Step 10 + Task 2 Step 6; test A-stagent-2 + R-stagent-2
- "When the profile has no allowedTools, the SDK option is still omitted" → Task 1 Step 10 kept the conditional spread; test A-stagent-3
- "Permission-gated stagent tools still route through handleToolPermission" → No code change (already correct); verified by not touching lines 516-521 and 635-641
- "Existing claude-agent.test.ts tests still pass" → Task 1 Step 12, Task 2 Step 8
- "New unit tests assert mcpServers.stagent present on both paths" → A-stagent-1, R-stagent-1
- "Chat engine behavior is unchanged" → No edits to `src/lib/chat/engine.ts` (NOT in scope)

**2. Placeholder scan:** No TBDs. Every code block has concrete content. Error messages and commit messages are literal.

**3. Type consistency:** `createStagentMcpServer(projectId?: string | null, onToolResult?: ...)` — we pass only the first arg. `task.projectId` is `string | null` on the task row, matching the factory signature. The sentinel `{ __mockStagentServer: true }` is a `Record<string, unknown>` assignable to whatever shape the SDK expects for a registered MCP server (the test only asserts identity, not shape). The `allowedTools` merge produces `string[]` via `Array.from(new Set<string>(...))`, matching the SDK's `allowedTools?: string[]` option type.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-11-task-runtime-stagent-mcp-injection.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
