# Task Runtime Skill Parity — Faithful Task Mirror

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror Phase 1a (`chat-claude-sdk-skills`) into the Claude task execution runtime (`src/lib/agents/claude-agent.ts`) so project skills, CLAUDE.md, and filesystem tools reach background tasks the same way they reach interactive chat.

**Architecture:** Extract the `CLAUDE_SDK_*` constants from `src/lib/chat/engine.ts` into `src/lib/agents/runtime/claude-sdk.ts` (a module both chat and agent already import). Thread `settingSources` + the merged allowed-tools list into both `executeClaudeTask` and `resumeClaudeTask`. Add a filesystem/skill auto-allow layer to the existing task-level `handleToolPermission` — keep task UX on the notification/inbox polling pattern; don't try to reuse chat's SSE side-channel. Capability-gate every new option on `getFeaturesForModel(modelId).hasNativeSkills` so the logic doesn't fire on Anthropic-direct or Ollama runtimes.

**Tech Stack:** TypeScript, Next.js 16, `@anthropic-ai/claude-agent-sdk`, vitest, SQLite/Drizzle.

---

## NOT in scope

- **Codex and Ollama task runtimes.** They don't share the `claude-agent.ts` code path. Separate features (`chat-codex-app-server-skills`, `chat-ollama-native-skills`) cover those surfaces.
- **Shared Tier 0 partition helper between chat and task.** Spec §3 suggested extracting this. Pushback: chat's system prompt embeds conversation history; task's system prompt embeds document/table/output contexts. The two shapes are genuinely different; the shared surface is the SDK options block (constants), not the prompt text. Extraction is speculative abstraction ("extract on third use, not first").
- **DRY refactor of `executeClaudeTask` / `resumeClaudeTask` duplication.** The two entry points have ~40 lines of near-duplicated options-block plumbing. Currently 2 sites, not 3 — deferred.
- **UI changes.** Task dispatch flow is unchanged from the user's perspective. Skill-invocation visualisation is `task-turn-observability`'s job.
- **Bash / Edit / Write auto-allow.** These go through the existing notification permission flow. Only Read/Grep/Glob/Skill get auto-allow (mirroring chat's Phase 1a policy).

## What already exists

- `CLAUDE_SDK_SETTING_SOURCES`, `CLAUDE_SDK_ALLOWED_TOOLS`, `CLAUDE_SDK_READ_ONLY_FS_TOOLS` in `src/lib/chat/engine.ts:63-84` — ready to extract verbatim. The `as const` suffix on arrays is load-bearing (keeps literal types narrow for SDK option typing).
- `src/lib/agents/runtime/claude-sdk.ts` — already contains `buildClaudeSdkEnv`, already imported by both `chat/engine.ts` and `agents/claude-agent.ts`. Zero risk of introducing a module cycle by adding constants here.
- `src/lib/agents/tool-permissions.ts:115-203` — `handleToolPermission` with 4 layers (profile policy, Exa readonly, user-saved, notification polling). Needs a new layer between 1.5 and 2 for SDK filesystem + Skill auto-allow.
- `src/lib/agents/claude-agent.ts:60-88` — `withStagentMcpServer` and `withStagentAllowedTools` helpers. `withStagentAllowedTools` returns `undefined` when a profile has no allowlist. After this change, callers must pass `CLAUDE_SDK_ALLOWED_TOOLS` as fallback instead of letting the SDK fall through to claude_code preset defaults — because the preset doesn't include `mcp__stagent__*` AND the preset already includes Skill/Read/Grep/etc, so we need to make sure we don't produce two conflicting tool lists.
- `src/lib/chat/types.ts:120` — `getFeaturesForModel(modelId)` returns `RuntimeFeatures`. Use `.hasNativeSkills` as the capability gate before wiring Phase 1a options.
- `src/lib/chat/__tests__/engine-sdk-options.test.ts` — reference test shape; task test will mirror it including the "hooks excluded" regex check over `claude-agent.ts` source.
- `features/task-runtime-stagent-mcp-injection.md` — TDR-032 precedent; its "Verification run — 2026-04-11" section documents the exact smoke-test format to follow.

## Files touched

- **Modify:** `src/lib/agents/runtime/claude-sdk.ts` — add `CLAUDE_SDK_*` constants
- **Modify:** `src/lib/chat/engine.ts` — re-export extracted constants (preserve existing import consumers)
- **Modify:** `src/lib/agents/tool-permissions.ts` — add Layer 1.75 (SDK filesystem + Skill auto-allow)
- **Modify:** `src/lib/agents/claude-agent.ts` — capability gate + options parity in both executeClaudeTask and resumeClaudeTask
- **Create:** `src/lib/agents/__tests__/claude-agent-sdk-options.test.ts` — parity test matching engine-sdk-options.test.ts shape
- **Modify:** `src/lib/agents/__tests__/tool-permissions.test.ts` (if it exists; create if not) — new auto-allow layer tests
- **Modify:** `features/task-runtime-skill-parity.md` — status flip, verification-run stamp
- **Modify:** `features/changelog.md` — closeout entry
- **Modify:** `features/roadmap.md` — move out of "planned"

## Error & Rescue Registry

| Failure mode | Symptom | Recovery |
|---|---|---|
| **Module-load cycle via static import of `@/lib/chat/stagent-tools`** | `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` on first Next.js request; 100% of unit tests pass | Never `import ... from "@/lib/chat/stagent-tools"` at top of any file under `src/lib/agents/`. Use `await import()` inside function bodies (existing pattern at `claude-agent.ts:66`). The smoke test is the only thing that catches this. |
| **Profile explicit allowedTools collides with CLAUDE_SDK tools** | Profile says `["Read"]` only; runtime passes `["Read", ..., "Bash"]`; user expects no Bash | `withStagentAllowedTools` returns the profile's list unchanged when present. Only use `CLAUDE_SDK_ALLOWED_TOOLS` as fallback when the profile has no allowlist. Test with a profile that explicitly restricts to `["Read"]`. |
| **Non-claude-code runtime gets settingSources** | Anthropic-direct or OpenAI-direct task execution hits an option it can't parse; crash or silent ignore | Gate on `getFeaturesForModel(modelId).hasNativeSkills` before adding settingSources or Skill tool. Test covers the `hasNativeSkills: false` branch. |
| **Filesystem tool auto-allow races with profile autoDeny** | Profile says `autoDeny: ["Read"]`; model calls Read; auto-allow layer short-circuits before deny check | Place new layer AFTER Layer 1 (profile policy) in `handleToolPermission`. Profile policy wins by ordering. Test with a profile that denies Read. |
| **Dev server fails to start for smoke test** | `npm run dev` collides with user's :3000 instance | Use `PORT=3010 npm run dev` in a separate terminal. Stop with `kill %1` or by PID lookup. Do NOT `pkill -f "next"` — user runs parallel instances. |
| **Skill directory doesn't exist before smoke test** | Model calls Skill tool; SDK can't resolve skill path | Create `.claude/skills/task-smoke/SKILL.md` before dispatching task. Delete after smoke test to keep repo clean. |

---

## Task 1: Extract `CLAUDE_SDK_*` constants into shared module

**Files:**
- Modify: `src/lib/agents/runtime/claude-sdk.ts`
- Modify: `src/lib/chat/engine.ts:60-84`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/chat/__tests__/engine-sdk-options.test.ts` at the top of the file (after existing imports):

```typescript
describe("CLAUDE_SDK_* constants source-of-truth", () => {
  it("exports CLAUDE_SDK_ALLOWED_TOOLS from runtime/claude-sdk", async () => {
    const mod = await import("@/lib/agents/runtime/claude-sdk");
    expect(mod.CLAUDE_SDK_ALLOWED_TOOLS).toEqual(
      expect.arrayContaining(["Skill", "Read", "Grep", "Glob", "Edit", "Write", "Bash", "TodoWrite"])
    );
  });

  it("exports CLAUDE_SDK_SETTING_SOURCES from runtime/claude-sdk", async () => {
    const mod = await import("@/lib/agents/runtime/claude-sdk");
    expect(mod.CLAUDE_SDK_SETTING_SOURCES).toEqual(["user", "project"]);
  });

  it("exports CLAUDE_SDK_READ_ONLY_FS_TOOLS from runtime/claude-sdk", async () => {
    const mod = await import("@/lib/agents/runtime/claude-sdk");
    expect(mod.CLAUDE_SDK_READ_ONLY_FS_TOOLS).toEqual(new Set(["Read", "Grep", "Glob"]));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/chat/__tests__/engine-sdk-options.test.ts -t "source-of-truth" 2>&1 | tail -30`
Expected: FAIL — `mod.CLAUDE_SDK_ALLOWED_TOOLS` is `undefined` because nothing is exported from `runtime/claude-sdk` yet.

- [ ] **Step 3: Add the constants to `runtime/claude-sdk.ts`**

Append to `src/lib/agents/runtime/claude-sdk.ts`:

```typescript
// ─── Claude Agent SDK options shared by chat and task runtimes ──────
//
// Chat (src/lib/chat/engine.ts) and task (src/lib/agents/claude-agent.ts)
// both construct query() options for the `claude-code` runtime. These
// constants are the single source of truth so the two code paths cannot
// drift — a drift that would manifest as "skills work in chat but vanish
// in tasks on the same project." See features/task-runtime-skill-parity.md
// and features/chat-claude-sdk-skills.md.

export const CLAUDE_SDK_SETTING_SOURCES = ["user", "project"] as const;

export const CLAUDE_SDK_ALLOWED_TOOLS = [
  "Skill",
  "Read",
  "Grep",
  "Glob",
  "Edit",
  "Write",
  "Bash",
  "TodoWrite",
] as const;

/**
 * Filesystem tools safe to auto-allow without a permission prompt.
 * Mirrors the existing browser/exa read-only auto-allow pattern.
 */
export const CLAUDE_SDK_READ_ONLY_FS_TOOLS = new Set<string>([
  "Read",
  "Grep",
  "Glob",
]);
```

- [ ] **Step 4: Re-export from `chat/engine.ts` for backwards compatibility**

Replace `src/lib/chat/engine.ts:60-84` (the three `export const` declarations and their JSDoc) with a single re-export so existing test imports keep working:

```typescript
// Re-exported from runtime/claude-sdk.ts so chat/engine.ts remains a stable
// import surface for the Phase 1a test suite. The canonical definitions
// live in the runtime module since task execution needs them too — see
// features/task-runtime-skill-parity.md Task 1.
export {
  CLAUDE_SDK_SETTING_SOURCES,
  CLAUDE_SDK_ALLOWED_TOOLS,
  CLAUDE_SDK_READ_ONLY_FS_TOOLS,
} from "@/lib/agents/runtime/claude-sdk";
```

Leave all other imports and `canUseToolForTest` in `engine.ts` unchanged.

- [ ] **Step 5: Run the new test + existing engine-sdk-options suite to verify everything passes**

Run: `npx vitest run src/lib/chat/__tests__/engine-sdk-options.test.ts 2>&1 | tail -15`
Expected: All tests PASS (both new "source-of-truth" tests and the pre-existing 12 tests).

- [ ] **Step 6: Run full type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5 && echo EXIT:$?`
Expected: EXIT:0

- [ ] **Step 7: Commit**

```bash
git add src/lib/agents/runtime/claude-sdk.ts src/lib/chat/engine.ts src/lib/chat/__tests__/engine-sdk-options.test.ts
git commit -m "$(cat <<'EOF'
refactor(runtime): extract CLAUDE_SDK_* constants to runtime/claude-sdk

Task execution (claude-agent.ts) is about to need the same constants as
chat (engine.ts) for skill-parity work. Moves the three constants to
runtime/claude-sdk.ts — a module both callers already import — and leaves
a re-export in chat/engine.ts so existing test imports keep working.

No behavioural change. Prep for task-runtime-skill-parity.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add SDK filesystem + Skill auto-allow layer to `handleToolPermission`

**Files:**
- Modify: `src/lib/agents/tool-permissions.ts`
- Test: `src/lib/agents/__tests__/tool-permissions.test.ts` (create if absent)

- [ ] **Step 1: Check whether a test file exists**

Run: `ls src/lib/agents/__tests__/tool-permissions.test.ts 2>&1`
Expected: Either shows the file (proceed to Step 2) or `No such file or directory` (note for Step 2 — you'll create the file).

- [ ] **Step 2: Write the failing test**

If the test file does NOT exist, create `src/lib/agents/__tests__/tool-permissions.test.ts` with this full content:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  },
}));

vi.mock("@/lib/settings/permissions", () => ({
  isToolAllowed: vi.fn().mockResolvedValue(false),
}));

import { handleToolPermission, clearPermissionCache } from "@/lib/agents/tool-permissions";

describe("handleToolPermission — SDK filesystem and Skill auto-allow", () => {
  beforeEach(() => {
    clearPermissionCache("test-task");
  });

  it("auto-allows Read without creating a notification", async () => {
    const result = await handleToolPermission("test-task", "Read", { file_path: "/tmp/x" });
    expect(result.behavior).toBe("allow");
    expect(result.updatedInput).toEqual({ file_path: "/tmp/x" });
  });

  it("auto-allows Grep", async () => {
    const result = await handleToolPermission("test-task", "Grep", { pattern: "foo" });
    expect(result.behavior).toBe("allow");
  });

  it("auto-allows Glob", async () => {
    const result = await handleToolPermission("test-task", "Glob", { pattern: "**/*.ts" });
    expect(result.behavior).toBe("allow");
  });

  it("auto-allows Skill invocations", async () => {
    const result = await handleToolPermission("test-task", "Skill", { skill: "code-reviewer" });
    expect(result.behavior).toBe("allow");
  });

  it("does NOT auto-allow Edit (must route through notification flow)", async () => {
    // To avoid the test hanging on the 55s DB poll, we expect the call to
    // reach the notification layer by mocking db.select to resolve immediately
    // with a denied response. But since our stub resolves [] forever, the
    // polling will hit the deadline. We assert on the call path using a
    // separate ledger in production code; for now, assert that Edit doesn't
    // take the auto-allow fast path by checking the layer that gets hit.
    //
    // The cleanest assertion: auto-allow layer would resolve synchronously
    // from in-memory sets; the notification layer returns a Promise that
    // touches `db.insert`. We can spy on db.insert being called.
    const { db } = await import("@/lib/db");
    const insertSpy = vi.spyOn(db, "insert");
    // Fire-and-forget; we don't await the 55s timeout. Just verify
    // that db.insert was called (meaning the Edit path did NOT auto-allow).
    handleToolPermission("test-task-edit", "Edit", { file_path: "/tmp/x", content: "y" });
    await new Promise((r) => setTimeout(r, 10));
    expect(insertSpy).toHaveBeenCalled();
  });

  it("profile autoDeny for Read wins over auto-allow", async () => {
    const result = await handleToolPermission(
      "test-task",
      "Read",
      { file_path: "/tmp/x" },
      { autoApprove: [], autoDeny: ["Read"] },
    );
    expect(result.behavior).toBe("deny");
  });
});
```

If the file already exists, ADD the describe block above (nested under a new `describe` so existing tests are preserved).

- [ ] **Step 3: Run the tests to verify failure**

Run: `npx vitest run src/lib/agents/__tests__/tool-permissions.test.ts 2>&1 | tail -25`
Expected: the four "auto-allows" assertions TIME OUT or FAIL (polling hangs because nothing short-circuits Read/Grep/Glob/Skill), and the "profile autoDeny wins" test will PASS (autoDeny is already Layer 1).

- [ ] **Step 4: Add the auto-allow layer to `handleToolPermission`**

Modify `src/lib/agents/tool-permissions.ts`. Add this import near the top (after the existing `isExaTool` import):

```typescript
import { CLAUDE_SDK_READ_ONLY_FS_TOOLS } from "./runtime/claude-sdk";
```

Then insert a new layer between the existing Layer 1.5 and Layer 2. Find the block:

```typescript
  // Layer 1.5: External MCP read-only tools — auto-approve without I/O
  if (!isQuestion && isExaTool(toolName) && isExaReadOnly(toolName)) {
    return buildAllowedToolPermissionResponse(input);
  }

  // Layer 2: Saved user permissions — skip notification for pre-approved tools
```

Insert between these two:

```typescript
  // Layer 1.75: SDK filesystem read-only tools and Skill invocations —
  // auto-approve without I/O. Mirrors the chat-side Phase 1a policy
  // (src/lib/chat/engine.ts canUseTool). Read/Grep/Glob are non-destructive;
  // Skill load is equivalent to using `claude` CLI directly — any tool the
  // loaded skill subsequently invokes (Bash, Edit, etc.) goes through this
  // same canUseTool check. See features/chat-claude-sdk-skills.md Error
  // & Rescue Registry row "settingSources loads hostile skill."
  if (!isQuestion && (CLAUDE_SDK_READ_ONLY_FS_TOOLS.has(toolName) || toolName === "Skill")) {
    return buildAllowedToolPermissionResponse(input);
  }

```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/agents/__tests__/tool-permissions.test.ts 2>&1 | tail -25`
Expected: All tests PASS.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5 && echo EXIT:$?`
Expected: EXIT:0

- [ ] **Step 7: Commit**

```bash
git add src/lib/agents/tool-permissions.ts src/lib/agents/__tests__/tool-permissions.test.ts
git commit -m "$(cat <<'EOF'
feat(agents): auto-allow SDK filesystem + Skill tools in task permission handler

Mirrors Phase 1a's chat-side policy: Read/Grep/Glob and Skill invocations
bypass the notification/inbox permission flow because they're either
non-destructive (read-only) or equivalent to the Claude CLI's own trust
boundary (Skill loads; nested tool calls still gate). Profile autoDeny
still wins — the new layer sits below Layer 1 so explicit deny lists
are honoured.

Prep for task-runtime-skill-parity Task 3.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire `settingSources` + Phase 1a tools into `executeClaudeTask`

**Files:**
- Modify: `src/lib/agents/claude-agent.ts:515-616` (the `executeClaudeTask` function)
- Test: `src/lib/agents/__tests__/claude-agent-sdk-options.test.ts` (create)

- [ ] **Step 1: Write the failing parity test**

Create `src/lib/agents/__tests__/claude-agent-sdk-options.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("claude-agent.ts SDK options parity with chat engine", () => {
  const agentSource = fs.readFileSync(
    path.resolve(__dirname, "../claude-agent.ts"),
    "utf8",
  );

  it("imports CLAUDE_SDK_ALLOWED_TOOLS from runtime/claude-sdk", () => {
    expect(agentSource).toMatch(/CLAUDE_SDK_ALLOWED_TOOLS[\s\S]*runtime\/claude-sdk/);
  });

  it("imports CLAUDE_SDK_SETTING_SOURCES from runtime/claude-sdk", () => {
    expect(agentSource).toMatch(/CLAUDE_SDK_SETTING_SOURCES[\s\S]*runtime\/claude-sdk/);
  });

  it("imports getFeaturesForModel to gate native-skill options", () => {
    expect(agentSource).toMatch(/getFeaturesForModel/);
  });

  it("passes settingSources inside executeClaudeTask query() options", () => {
    // Extract the first query() call (executeClaudeTask's)
    const queryBlocks = agentSource.match(/query\(\s*\{[\s\S]*?canUseTool/g);
    expect(queryBlocks).toBeTruthy();
    expect(queryBlocks![0]).toContain("settingSources");
  });

  it("passes settingSources inside resumeClaudeTask query() options", () => {
    const queryBlocks = agentSource.match(/query\(\s*\{[\s\S]*?canUseTool/g);
    expect(queryBlocks).toBeTruthy();
    expect(queryBlocks!.length).toBeGreaterThanOrEqual(2);
    expect(queryBlocks![1]).toContain("settingSources");
  });

  it("hooks field is NOT present in either query() options block", () => {
    const queryBlocks = agentSource.match(/query\(\s*\{[\s\S]*?canUseTool/g) ?? [];
    for (const block of queryBlocks) {
      expect(block).not.toMatch(/\bhooks\s*:/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/agents/__tests__/claude-agent-sdk-options.test.ts 2>&1 | tail -20`
Expected: FAIL — claude-agent.ts does not import the constants or `getFeaturesForModel` yet, and `settingSources` is not in either query() block.

- [ ] **Step 3: Add imports at the top of `claude-agent.ts`**

Find the existing import block at the top of `src/lib/agents/claude-agent.ts` (lines 1-36). Add two new imports alongside the existing ones — add after the `buildClaudeSdkEnv` import:

```typescript
import {
  CLAUDE_SDK_ALLOWED_TOOLS,
  CLAUDE_SDK_SETTING_SOURCES,
} from "./runtime/claude-sdk";
import { getFeaturesForModel } from "@/lib/chat/types";
```

- [ ] **Step 4: Update `withStagentAllowedTools` to accept a fallback**

Replace the existing `withStagentAllowedTools` function (roughly lines 83-88 in claude-agent.ts) with:

```typescript
/**
 * Prepend `mcp__stagent__*` to a profile's explicit allowedTools so the
 * stagent tool registration survives the SDK preset filter. When the
 * profile has no explicit allowlist and `includeSdkTools` is true, fall
 * back to Phase 1a's CLAUDE_SDK_ALLOWED_TOOLS (Skill, Read/Grep/Glob,
 * Edit/Write/Bash, TodoWrite) so task execution gets the same toolset as
 * chat. Returns `undefined` only when the profile has no allowlist AND
 * the caller does not want SDK tools added — letting the SDK fall
 * through to claude_code preset defaults.
 */
function withStagentAllowedTools(
  profileAllowedTools: string[] | undefined,
  includeSdkTools: boolean,
): string[] | undefined {
  if (profileAllowedTools) {
    // Profile has explicit list — respect it. Only prepend stagent.
    return Array.from(new Set(["mcp__stagent__*", ...profileAllowedTools]));
  }
  if (includeSdkTools) {
    // No profile allowlist but runtime has native skills — pass the
    // Phase 1a tool set alongside mcp__stagent__* + browser/external
    // (callers merge their own browser/external patterns into this list).
    return ["mcp__stagent__*", ...CLAUDE_SDK_ALLOWED_TOOLS];
  }
  return undefined;
}
```

- [ ] **Step 5: Update `executeClaudeTask` query options block**

In `src/lib/agents/claude-agent.ts` around lines 559-587 (inside `executeClaudeTask`), find the existing block starting with `const authEnv = await getAuthEnv();` and ending at the close of `canUseTool:`. Replace this block:

```typescript
    // allowedTools prepended via shared helper (see withStagentAllowedTools).
    // Computed once so the conditional spread below does not invoke the
    // helper twice. Returns undefined when the profile has no allowlist so
    // the SDK falls through to claude_code preset defaults.
    const mergedAllowedTools = withStagentAllowedTools(ctx.payload?.allowedTools);

    const authEnv = await getAuthEnv();
    const response = query({
      prompt: ctx.userPrompt,
      options: {
        abortController,
        includePartialMessages: true,
        cwd: ctx.cwd,
        env: buildClaudeSdkEnv(authEnv),
        // F1: Use dedicated systemPrompt option with claude_code preset
        systemPrompt: ctx.systemInstructions
          ? { type: "preset" as const, preset: "claude_code" as const, append: ctx.systemInstructions }
          : { type: "preset" as const, preset: "claude_code" as const },
        // F9: Bounded turn limit from profile or default; per-schedule override wins
        maxTurns: effectiveMaxTurns,
        // F4: Per-execution budget cap — use task-specific override if set
        maxBudgetUsd: task.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD,
        ...(mergedAllowedTools && { allowedTools: mergedAllowedTools }),
        ...(Object.keys(mergedMcpServers).length > 0 && {
          mcpServers: mergedMcpServers,
        }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input, ctx.canUseToolPolicy);
        },
      },
    });
```

With this expanded block that adds capability-gated Phase 1a options:

```typescript
    // Capability gate: only pass settingSources + CLAUDE_SDK tools when the
    // runtime is claude-code (or a future runtime with hasNativeSkills).
    // Anthropic-direct and OpenAI-direct task runtimes don't understand
    // these SDK-specific options. Model ID comes from task.model, falling
    // through to the runtime default resolved via catalog.ts.
    const runtimeFeatures = getFeaturesForModel(task.model ?? "");
    const includeSdkNativeTools = runtimeFeatures.hasNativeSkills;

    // allowedTools merged via shared helper. When the profile has no explicit
    // allowlist AND the runtime has native skills, we fall back to Phase 1a's
    // CLAUDE_SDK_ALLOWED_TOOLS (Skill, Read/Grep/Glob, Edit/Write/Bash,
    // TodoWrite) so task execution matches chat. Computed once so the
    // conditional spread below does not invoke the helper twice.
    const mergedAllowedTools = withStagentAllowedTools(
      ctx.payload?.allowedTools,
      includeSdkNativeTools,
    );

    const authEnv = await getAuthEnv();
    const response = query({
      prompt: ctx.userPrompt,
      options: {
        abortController,
        includePartialMessages: true,
        cwd: ctx.cwd,
        env: buildClaudeSdkEnv(authEnv),
        // F1: Use dedicated systemPrompt option with claude_code preset
        systemPrompt: ctx.systemInstructions
          ? { type: "preset" as const, preset: "claude_code" as const, append: ctx.systemInstructions }
          : { type: "preset" as const, preset: "claude_code" as const },
        // F9: Bounded turn limit from profile or default; per-schedule override wins
        maxTurns: effectiveMaxTurns,
        // F4: Per-execution budget cap — use task-specific override if set
        maxBudgetUsd: task.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD,
        ...(mergedAllowedTools && { allowedTools: mergedAllowedTools }),
        // Phase 1a parity: load user + project settings (.claude/skills,
        // CLAUDE.md, .claude/rules/*.md) when the runtime supports it.
        ...(includeSdkNativeTools && {
          settingSources: [...CLAUDE_SDK_SETTING_SOURCES],
        }),
        ...(Object.keys(mergedMcpServers).length > 0 && {
          mcpServers: mergedMcpServers,
        }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input, ctx.canUseToolPolicy);
        },
      },
    });
```

- [ ] **Step 6: Run the parity test to verify PASS for execute**

Run: `npx vitest run src/lib/agents/__tests__/claude-agent-sdk-options.test.ts 2>&1 | tail -25`
Expected: Tests 1-4 PASS (imports + executeClaudeTask has settingSources), test 5 FAIL (resumeClaudeTask not yet updated), test 6 PASS (no hooks field introduced).

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5 && echo EXIT:$?`
Expected: EXIT:0

- [ ] **Step 8: Commit**

```bash
git add src/lib/agents/claude-agent.ts src/lib/agents/__tests__/claude-agent-sdk-options.test.ts
git commit -m "$(cat <<'EOF'
feat(agents): wire settingSources + Phase 1a tools into executeClaudeTask

Mirrors chat-claude-sdk-skills into the Claude task execution runtime so
project skills, CLAUDE.md, and filesystem tools reach background tasks
the same way they reach interactive chat.

Capability-gated on getFeaturesForModel(...).hasNativeSkills so future
Anthropic-direct or OpenAI-direct task runtimes don't receive SDK-
specific options they can't parse. Profile allowedTools still wins when
explicit; CLAUDE_SDK_ALLOWED_TOOLS is the fallback only when the profile
has no allowlist.

Resume path will follow in the next commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire same options into `resumeClaudeTask`

**Files:**
- Modify: `src/lib/agents/claude-agent.ts:618-777` (the `resumeClaudeTask` function)

- [ ] **Step 1: Confirm test already covers resume (failing)**

Run: `npx vitest run src/lib/agents/__tests__/claude-agent-sdk-options.test.ts -t "resumeClaudeTask" 2>&1 | tail -15`
Expected: FAIL — `queryBlocks![1]` does not contain `settingSources`.

- [ ] **Step 2: Update `resumeClaudeTask` query options**

In `src/lib/agents/claude-agent.ts` inside `resumeClaudeTask` (starting around line 686, the block after `const mergedMcpServers = await withStagentMcpServer(...)`), find:

```typescript
    // allowedTools prepended via shared helper (see withStagentAllowedTools).
    // Computed once so the conditional spread below does not invoke the
    // helper twice.
    const mergedAllowedTools = withStagentAllowedTools(ctx.payload?.allowedTools);

    const authEnv = await getAuthEnv();
    const response = query({
      prompt: ctx.userPrompt,
      options: {
        resume: task.sessionId,
        abortController,
        includePartialMessages: true,
        cwd: ctx.cwd,
        env: buildClaudeSdkEnv(authEnv),
        // F1: Use dedicated systemPrompt option with claude_code preset
        systemPrompt: ctx.systemInstructions
          ? { type: "preset" as const, preset: "claude_code" as const, append: ctx.systemInstructions }
          : { type: "preset" as const, preset: "claude_code" as const },
        // F9: Bounded turn limit from profile or default; per-schedule override wins
        maxTurns: effectiveMaxTurns,
        // F4: Per-execution budget cap — use task-specific override if set
        maxBudgetUsd: task.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD,
        ...(mergedAllowedTools && { allowedTools: mergedAllowedTools }),
        ...(Object.keys(mergedMcpServers).length > 0 && {
          mcpServers: mergedMcpServers,
        }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input, ctx.canUseToolPolicy);
        },
      },
    });
```

Replace with the capability-gated version (identical structure to Task 3, plus the `resume:` line stays at the top of options):

```typescript
    // Capability gate: same logic as executeClaudeTask. Resumed tasks must
    // get the same SDK options as their original run so skills that were
    // visible on first execution remain visible after a resume.
    const runtimeFeatures = getFeaturesForModel(task.model ?? "");
    const includeSdkNativeTools = runtimeFeatures.hasNativeSkills;

    const mergedAllowedTools = withStagentAllowedTools(
      ctx.payload?.allowedTools,
      includeSdkNativeTools,
    );

    const authEnv = await getAuthEnv();
    const response = query({
      prompt: ctx.userPrompt,
      options: {
        resume: task.sessionId,
        abortController,
        includePartialMessages: true,
        cwd: ctx.cwd,
        env: buildClaudeSdkEnv(authEnv),
        // F1: Use dedicated systemPrompt option with claude_code preset
        systemPrompt: ctx.systemInstructions
          ? { type: "preset" as const, preset: "claude_code" as const, append: ctx.systemInstructions }
          : { type: "preset" as const, preset: "claude_code" as const },
        // F9: Bounded turn limit from profile or default; per-schedule override wins
        maxTurns: effectiveMaxTurns,
        // F4: Per-execution budget cap — use task-specific override if set
        maxBudgetUsd: task.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD,
        ...(mergedAllowedTools && { allowedTools: mergedAllowedTools }),
        // Phase 1a parity: match executeClaudeTask — see Task 3 rationale.
        ...(includeSdkNativeTools && {
          settingSources: [...CLAUDE_SDK_SETTING_SOURCES],
        }),
        ...(Object.keys(mergedMcpServers).length > 0 && {
          mcpServers: mergedMcpServers,
        }),
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ) => {
          return handleToolPermission(taskId, toolName, input, ctx.canUseToolPolicy);
        },
      },
    });
```

- [ ] **Step 3: Run the parity test — all six tests should PASS**

Run: `npx vitest run src/lib/agents/__tests__/claude-agent-sdk-options.test.ts 2>&1 | tail -20`
Expected: All 6 tests PASS.

- [ ] **Step 4: Run the full claude-agent test suite for regressions**

Run: `npx vitest run src/lib/agents/__tests__/claude-agent.test.ts 2>&1 | tail -15`
Expected: All tests PASS (the existing suite mocks `query` so it's not affected by options additions, but confirm no snapshot/assertion drift).

- [ ] **Step 5: Full test suite**

Run: `npm test 2>&1 | tail -10`
Expected: 775+ PASS, existing skipped count unchanged.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5 && echo EXIT:$?`
Expected: EXIT:0

- [ ] **Step 7: Commit**

```bash
git add src/lib/agents/claude-agent.ts
git commit -m "$(cat <<'EOF'
feat(agents): wire settingSources + Phase 1a tools into resumeClaudeTask

Same capability-gated mirror as executeClaudeTask, applied to the resume
path. Without this, a resumed task would lose visibility of skills it
had access to on first run — surfacing as "my skill worked the first
time but not after I re-queued."

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Smoke-test skill fixture + live dev-server verification

**Files:**
- Create (temporary): `.claude/skills/task-smoke/SKILL.md`
- Modify: `features/task-runtime-skill-parity.md` (add Verification run entry)

This is the mandatory TDR-032 step. Unit tests cannot catch module-load cycles. This task executes a real task through the modified code path on a running dev server.

- [ ] **Step 1: Create the smoke-test skill fixture**

Create `.claude/skills/task-smoke/SKILL.md` with this content:

```markdown
---
name: task-smoke
description: Smoke-test fixture for task-runtime-skill-parity verification. When invoked by a task, returns the exact sentinel string TASK_SMOKE_SKILL_REACHED_AGENT — used to prove project skills reach the Claude task runtime via settingSources.
---

# Task Smoke Skill

When invoked via the `Skill` tool, respond to the calling agent with exactly this line and no other text:

TASK_SMOKE_SKILL_REACHED_AGENT

Do not summarise. Do not elaborate. The sentinel is the entire response.
```

- [ ] **Step 2: Confirm user's dev server is running on :3000**

Run: `curl -sSI http://localhost:3000/ 2>&1 | head -3`
Expected: `HTTP/1.1 200 OK`. If not running, STOP and ask the user to start `npm run dev`.

- [ ] **Step 3: Dispatch a task via the UI that exercises the modified code path**

Use the browser (Claude in Chrome or Playwright MCP) to:

1. Navigate to `http://localhost:3000/chat`
2. Create a new chat with the Opus model selected (ensures `hasNativeSkills: true`)
3. Paste this prompt:

```
Create a new task titled "task-runtime-skill-parity-smoke" in the default project with this description: "Invoke the task-smoke skill via the Skill tool and report exactly what the skill told you to say." Then execute the task immediately and tell me its final result.
```

4. Wait for the task to complete. Watch for tool-use status events confirming the task invoked `Skill`.

- [ ] **Step 4: Verify the smoke sentinel appears in the task result**

Navigate to the task's detail view (Inbox or Monitor). The task's final `result` field must contain exactly `TASK_SMOKE_SKILL_REACHED_AGENT`. If it does not — for example the result says "I don't have access to a skill called task-smoke" — the smoke test FAILED and settingSources is not reaching the task runtime.

Also check the dev-server terminal output for any `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` — even if the task succeeds, this error proves a cycle was introduced and must be fixed before commit.

- [ ] **Step 5: Record the verification run in the feature spec**

Append to `features/task-runtime-skill-parity.md` under a new "Verification run" section (insert before "References"):

```markdown
## Verification run — 2026-04-13

**Runtime:** claude-code (Opus)
**Task ID:** <paste actual UUID from task detail view>
**Prompt:** "Invoke the task-smoke skill via the Skill tool and report exactly what the skill told you to say."
**Skill fixture:** `.claude/skills/task-smoke/SKILL.md` (deleted post-verification)
**Outcome:** PASS — task result contained the exact sentinel `TASK_SMOKE_SKILL_REACHED_AGENT`. No `ReferenceError` in dev-server output. Confirms settingSources and Skill tool reach the Claude task runtime identically to chat.
```

- [ ] **Step 6: Clean up the smoke-test skill fixture**

Run: `rm -rf .claude/skills/task-smoke`

- [ ] **Step 7: Commit the verification entry + fixture removal**

```bash
git add features/task-runtime-skill-parity.md .claude/skills/task-smoke
git commit -m "$(cat <<'EOF'
docs(features): record task-runtime-skill-parity smoke-test outcome

TDR-032 requires an end-to-end smoke test on a running dev server for
any change to claude-agent.ts. A real task invoked the task-smoke skill
via the Skill tool and returned the expected sentinel, confirming that
settingSources: ["user", "project"] and the Skill tool reach the task
runtime the same way they reach chat. Smoke fixture removed after run.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Feature closeout

**Files:**
- Modify: `features/task-runtime-skill-parity.md` — flip `status: planned` → `status: complete`
- Modify: `features/roadmap.md` — move feature out of planned section
- Modify: `features/changelog.md` — append completion entry

- [ ] **Step 1: Flip the spec status**

Edit `features/task-runtime-skill-parity.md` frontmatter, change the status line from:

```yaml
status: planned
```

to:

```yaml
status: complete
```

Also check each checkbox in the "Acceptance Criteria" section from `- [ ]` to `- [x]` based on the work done.

- [ ] **Step 2: Update roadmap**

Edit `features/roadmap.md`. Find the row or line listing `task-runtime-skill-parity` in the planned section and move it to the completed section with the date `2026-04-13`.

- [ ] **Step 3: Append to changelog**

Append to `features/changelog.md`:

```markdown
## 2026-04-13 — task-runtime-skill-parity (P1 complete)

Mirror of `chat-claude-sdk-skills` (Phase 1a) into the Claude task execution runtime. Project skills, CLAUDE.md, and filesystem tools (Skill, Read, Grep, Glob, Edit, Write, Bash, TodoWrite) now reach background tasks on the `claude-code` runtime the same way they reach interactive chat — closing the architect drift flagged in `ideas/chat-context-experience.md` §11.

Key changes:
- `CLAUDE_SDK_{ALLOWED_TOOLS,SETTING_SOURCES,READ_ONLY_FS_TOOLS}` extracted from `chat/engine.ts` into shared `agents/runtime/claude-sdk.ts`
- `handleToolPermission` gains a Layer 1.75 (SDK filesystem + Skill auto-allow)
- Both `executeClaudeTask` and `resumeClaudeTask` pass `settingSources` + merged allowed-tools, capability-gated on `getFeaturesForModel(...).hasNativeSkills`
- Live TDR-032 smoke test verified: a real task invoked the task-smoke fixture skill and returned the expected sentinel

Commits: refactor(runtime) + feat(agents) × 3 + docs(features) × 2.
```

- [ ] **Step 4: Final test run**

Run: `npm test 2>&1 | tail -10`
Expected: All tests PASS. 780+ passing is expected given new tests added.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5 && echo EXIT:$?`
Expected: EXIT:0

- [ ] **Step 6: Commit**

```bash
git add features/task-runtime-skill-parity.md features/roadmap.md features/changelog.md
git commit -m "$(cat <<'EOF'
docs(features): close out task-runtime-skill-parity (P1 complete)

Flips status to complete, updates roadmap and changelog. Chat and task
execution now have identical SDK-native capability on the claude-code
runtime — same skills, same filesystem tools, same project config,
capability-gated on hasNativeSkills.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Post-plan verification checklist

After all 6 tasks complete, confirm:

- [ ] `npm test` — all tests PASS, 780+ passing
- [ ] `npx tsc --noEmit` — EXIT:0
- [ ] `git log --oneline -10` shows 6 clean commits (one per task)
- [ ] No `ReferenceError` appeared in any dev-server run during Task 5
- [ ] `features/task-runtime-skill-parity.md` frontmatter shows `status: complete`
- [ ] `.claude/skills/task-smoke/` does NOT exist (cleanup confirmed)
- [ ] `git status` is clean (only gitignored files untracked)

## Spec coverage self-review

| Spec acceptance criterion | Task |
|---|---|
| `claude-agent.ts` passes `settingSources: ["user", "project"]` + full allowed-tools list | Tasks 3 + 4 |
| Task execution sees same skills as chat (verified by listing profiles from within a task) | Task 5 smoke test |
| CLAUDE.md and `.claude/rules/*.md` reach task execution | Task 5 smoke test (settingSources loads both) |
| Filesystem tools usable from tasks; Edit/Write/Bash gated by permission bridge | Task 2 (auto-allow layer) + Task 3/4 (allowedTools list includes them) |
| Tier 0 partition sourced from shared helper — no duplication | **Out of scope per scope challenge** (documented in "NOT in scope") |
| Hooks NOT loaded on task execution | Task 3 test `hooks field is NOT present in either query() options block` |
| Capability check: non-native-skill runtime skips settingSources/Skill | Task 3 + 4 `includeSdkNativeTools` gate; tested implicitly via the `includeSdkNativeTools && {...}` spread — add explicit `hasNativeSkills: false` branch test if spec review raises it |
| Smoke test: task invokes a project skill; invocation appears in task log | Task 5 |
