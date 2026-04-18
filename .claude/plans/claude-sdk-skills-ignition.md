# Chat — Claude SDK-Native Skills & Filesystem Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip ainative chat on the `claude-code` runtime from "isolation mode" to "SDK-native" — enable filesystem skills, CLAUDE.md auto-loading, and the full filesystem tool suite (Read/Grep/Glob/Edit/Write/Bash/TodoWrite) routed through the existing permission bridge — and update `list_profiles` to honestly reflect what's reachable.

**Architecture:** Two small option changes to the `query()` call at `src/lib/chat/engine.ts:300-315` activate the SDK's native skill and filesystem machinery. The existing `canUseTool` callback at lines 317-400+ already routes any unknown tool through a saved-permissions → side-channel-request flow, so `Edit`/`Write`/`Bash`/`TodoWrite` gating is free once they're in `allowedTools`; only `Read`/`Grep`/`Glob` need a read-only auto-allow branch (mirroring the existing browser/exa pattern). A Tier 0 / CLAUDE.md partition audit documents why this codebase requires minimal content migration. A new `listAllProfiles(projectDir)` helper fuses registry profiles with SDK-discovered filesystem skills, and the chat `list_profiles` tool uses it. TDR-032-mandated live smoke tests verify no module-load cycle and confirm the three concrete user-visible capabilities (skill invocation, CLAUDE.md reach, Grep works without prompt spam).

**Tech Stack:** TypeScript, Next.js 16, `@anthropic-ai/claude-agent-sdk` ^0.2.71, Vitest.

---

## What already exists

- `src/lib/chat/engine.ts:300-315` — the target `query()` call. `cwd` is already resolved from `workspace.cwd` (via `project.workingDirectory` → launch cwd fallback at lines 188-207, identical pattern to `claude-agent.ts:479-489`). `env` passes through `buildClaudeSdkEnv`. `allowedTools` is a `string[]` with existing spread patterns.
- `src/lib/chat/engine.ts:317-400+` — the `canUseTool` callback. **Fully generic:** handles ainative MCP (`PERMISSION_GATED_TOOLS` list), Exa (read-only auto-allow), browser (read-only auto-allow, mutation → check), AskUserQuestion special case, then falls through to `isToolAllowed(toolName, input)` (saved-permission check) → side-channel permission request via `emitSideChannelEvent`. Any new tool added to `allowedTools` inherits this flow. **Implication:** `Edit`/`Write`/`Bash`/`TodoWrite` gating is free. Only `Read`/`Grep`/`Glob` need a new auto-allow branch.
- `src/lib/chat/permission-bridge.ts` — the side-channel queue (`createSideChannel`, `emitSideChannelEvent`, `createPendingRequest`, `resolvePendingRequest`) used by chat only. No modifications needed for this plan.
- `src/lib/chat/tools/profile-tools.ts:7-28` — current `list_profiles` returns registry-only via `listProfiles()` from `@/lib/agents/profiles/registry`. Does not see filesystem skills.
- `src/lib/agents/profiles/registry.ts` — `listProfiles()` loads builtins + `~/.claude/skills/` *for registry profiles only* (not raw filesystem skills). No `listAllProfiles(projectDir)` helper exists.
- `src/lib/chat/system-prompt.ts` — `STAGENT_SYSTEM_PROMPT` constant, 117 lines. Content audit: overwhelmingly ainative identity + tool catalog + tool routing + ainative-domain semantics (delay steps, enrich_table, workflow dedup). **The repo's `CLAUDE.md` is 34 lines and mostly "read AGENTS.md" pointers** — almost no content overlap.
- `CLAUDE.md` (project root) — thin Claude-compatible pointer to `AGENTS.md`. The SDK's `settingSources: ["project"]` loads `CLAUDE.md` but does NOT follow its pointer to `AGENTS.md` (that's a Codex convention).
- `.claude/skills/` — 23 skills on disk. All load via `settingSources` (progressive disclosure keeps per-skill cost to SKILL.md frontmatter until invoked).
- `~/.claude/skills/` — user-level skills. Also loaded via `settingSources: "user"`.
- `AgentProfile` type at `src/lib/agents/profiles/types.ts:36-70` — full schema with `skillMd`, `scope`, `origin`, `projectDir`, etc. Rich enough to represent SDK-discovered skills; `listAllProfiles` result can re-use it.
- SDK version: `@anthropic-ai/claude-agent-sdk": "^0.2.71"` — fully supports `settingSources` and the `Skill` tool.
- No existing tests for `engine.ts` `query()` options shape, no tests for `context-builder.ts`, no tests for the `canUseTool` callback. New tests in this plan create that coverage from scratch for the specific assertions this plan needs.

## NOT in scope

- **Codex runtime skill integration** — covered by `chat-codex-app-server-skills` (sibling spec).
- **Ollama runtime skill injection** — covered by `chat-ollama-native-skills` (sibling spec).
- **Task execution runtime parity** — `claude-agent.ts` does not get filesystem tools or `settingSources` in this plan. Drift is documented as an intentional seam; `task-runtime-skill-parity` (P1, sibling spec) closes it.
- **Filesystem hook loading** — the SDK supports `hooks` as a separate option; we explicitly do not pass it (Q2 scope exclusion). A regression test asserts the option is absent.
- **Popover UX refactor** — `chat-command-namespace-refactor` covers the `/` verb vs `@` noun redesign. This plan updates the underlying `list_profiles` data, not the popover component.
- **`Task` subagent delegation tool** — explicitly NOT in `allowedTools`. ainative task primitives replace the SDK's `Task` tool per §3.3 of the ideas doc.
- **Rich CLAUDE.md authoring** — we do not write new CLAUDE.md content. If Tier 0 gets trimmed, content may move into CLAUDE.md; otherwise CLAUDE.md stays as the thin pointer it already is. Making CLAUDE.md genuinely useful is separate editorial work.
- **Refactoring the existing `cwd` resolver** into a shared helper. Both `engine.ts` and `claude-agent.ts` currently duplicate the ~10-line pattern. That's a small DRY opportunity but not this plan's job.
- **New permission UI** — all gating reuses the existing side-channel flow. If a user sees a `Bash` approval toast, it looks exactly like a ainative `execute_task` toast, which is fine for MVP.

## Error & Rescue Registry

| Failure mode | How it manifests | Recovery strategy |
|---|---|---|
| Module-load cycle via chat-tools import (TDR-032) | `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` at first chat request in `npm run dev` | Task 7 (smoke test) is the only check that catches this. Recovery: trace the import graph from any file that touches `@/lib/chat/ainative-tools` and introduce a dynamic `await import()` at the call site. Reference: TDR-032, commits `092f925` → `2b5ae42`, and `runtime-capability-matrix` smoke test (this plan's immediate predecessor) which passed. |
| Permission-prompt spam on every `Read` call | User asks "read CLAUDE.md" and gets 5+ side-channel permission toasts before any content appears | Task 1's auto-allow branch is the fix. If the wrong set of read-only patterns is chosen (e.g. `Edit` accidentally auto-allowed), the test harness in Task 1 Step 7 asserts the exact auto-allow set. |
| SDK loads 23+ skills, floods context budget | First chat turn's input tokens spike, `maxTurns` is exhausted prematurely | Unlikely due to progressive disclosure (only frontmatter loads until invoked), but Task 7's smoke test records the first-turn input-token count and flags if it exceeds 25% more than a baseline non-SDK-skills turn. If breached, revisit by narrowing `settingSources` to `["user"]` or `["project"]` alone. |
| `settingSources: ["user", "project"]` loads hostile skill from user's `~/.claude/skills/` | Malicious skill's SKILL.md reaches the LLM | Out of scope for this plan — no new attack surface vs. Claude Code CLI itself, which is how these skills already load. Documented as trust assumption. |
| `CLAUDE.md` at repo root is empty or contradicts ainative identity | LLM follows CLAUDE.md guidance instead of ainative tool-use semantics | Current CLAUDE.md is a thin pointer — contradiction risk is low. Task 2's audit documents the specific content in today's CLAUDE.md and flags any future conflict risk to the `chat-claude-sdk-skills-tier0-partition` follow-up. |
| `listAllProfiles(projectDir)` crashes on malformed SKILL.md frontmatter in one of the 23 skills | `list_profiles` chat tool returns 500 | Task 4's helper wraps per-skill parsing in try/catch and logs-then-skips invalid entries. Unit test in Task 4 Step 1 covers this. |
| `list_profiles` now returns 30+ entries (23 skills + ~7 registry profiles) | Popover overflows, `/` menu becomes unusable | Popover UX is out of scope (`chat-command-namespace-refactor`). For now, the raw list is honest; the popover can paginate or filter on its own timeline. |

---

## Task 1: Enable SDK-native skills, CLAUDE.md loading, and filesystem tools

**Files:**
- Modify: `src/lib/chat/engine.ts:300-400`
- Test: `src/lib/chat/__tests__/engine-sdk-options.test.ts` (create)

Adds `settingSources: ["user", "project"]` and the filesystem tool set to the `query()` options object. Adds a read-only auto-allow branch in `canUseTool` for `Read`/`Grep`/`Glob` so those tools don't spam permission prompts. `Edit`/`Write`/`Bash`/`TodoWrite`/`Skill` are gated through the existing side-channel flow automatically (no new code for them).

- [ ] **Step 1: Write the failing test**

Create `src/lib/chat/__tests__/engine-sdk-options.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";
import {
  CLAUDE_SDK_ALLOWED_TOOLS,
  CLAUDE_SDK_SETTING_SOURCES,
  CLAUDE_SDK_READ_ONLY_FS_TOOLS,
} from "@/lib/chat/engine";

describe("Claude SDK options (Phase 1a)", () => {
  it("declares settingSources loading user and project config", () => {
    expect(CLAUDE_SDK_SETTING_SOURCES).toEqual(["user", "project"]);
  });

  it("includes Skill, filesystem tools, Bash, and TodoWrite in allowedTools", () => {
    expect(CLAUDE_SDK_ALLOWED_TOOLS).toEqual(
      expect.arrayContaining([
        "Skill",
        "Read",
        "Grep",
        "Glob",
        "Edit",
        "Write",
        "Bash",
        "TodoWrite",
      ])
    );
  });

  it("does NOT include Task (subagent delegation replaced by ainative primitives)", () => {
    expect(CLAUDE_SDK_ALLOWED_TOOLS).not.toContain("Task");
  });

  it("declares Read, Grep, Glob as read-only filesystem tools", () => {
    expect(CLAUDE_SDK_READ_ONLY_FS_TOOLS).toEqual(
      new Set(["Read", "Grep", "Glob"])
    );
  });

  it("does NOT treat Edit, Write, Bash, or TodoWrite as read-only", () => {
    for (const tool of ["Edit", "Write", "Bash", "TodoWrite"]) {
      expect(CLAUDE_SDK_READ_ONLY_FS_TOOLS.has(tool)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/chat/__tests__/engine-sdk-options.test.ts`
Expected: all 5 tests fail with "has no exported member 'CLAUDE_SDK_ALLOWED_TOOLS'" (etc.).

- [ ] **Step 3: Declare the exported constants**

In `src/lib/chat/engine.ts`, above the `sendMessage` function (or near the top of the file after the existing imports), insert:

```typescript
/**
 * Claude Agent SDK options for chat on the `claude-code` runtime (Phase 1a).
 * Exported for testability. See features/chat-claude-sdk-skills.md.
 */
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
 * Filesystem tools that are safe to auto-allow without a permission prompt.
 * Mirrors the existing browser/exa read-only auto-allow pattern.
 */
export const CLAUDE_SDK_READ_ONLY_FS_TOOLS = new Set<string>([
  "Read",
  "Grep",
  "Glob",
]);
```

- [ ] **Step 4: Wire the constants into the `query()` options**

Change `src/lib/chat/engine.ts:314-315` from:

```typescript
        mcpServers: { ainative: stagentServer, ...browserServers, ...externalServers },
        allowedTools: ["mcp__stagent__*", ...browserToolPatterns, ...externalToolPatterns],
```

to:

```typescript
        mcpServers: { ainative: stagentServer, ...browserServers, ...externalServers },
        allowedTools: [
          "mcp__stagent__*",
          ...browserToolPatterns,
          ...externalToolPatterns,
          ...CLAUDE_SDK_ALLOWED_TOOLS,
        ],
        settingSources: [...CLAUDE_SDK_SETTING_SOURCES],
```

**Notes:**
- `settingSources` is a new key on the options object; the SDK type may not include it if your local types are behind. If TypeScript complains, add a `// @ts-expect-error SDK types lag behind runtime features — settingSources is supported in ^0.2.71` comment above the line.
- The `[...CLAUDE_SDK_SETTING_SOURCES]` spread converts the readonly tuple to a mutable array, which the SDK expects.

- [ ] **Step 5: Add read-only filesystem auto-allow to `canUseTool`**

In `src/lib/chat/engine.ts`, inside the `canUseTool` callback, immediately **after** the browser-tools block (after line 370, before `const isQuestion = toolName === "AskUserQuestion";`), insert:

```typescript
          // SDK filesystem read-only tools: auto-allow (mirror browser/exa pattern)
          if (CLAUDE_SDK_READ_ONLY_FS_TOOLS.has(toolName)) {
            emitSideChannelEvent(conversationId, {
              type: "status",
              phase: "tool_use",
              message: `Filesystem: ${toolName.toLowerCase()}...`,
            });
            return { behavior: "allow", updatedInput: input };
          }

          // Skill tool: auto-allow (invocation itself is safe; the tools it
          // triggers go through their own canUseTool checks)
          if (toolName === "Skill") {
            emitSideChannelEvent(conversationId, {
              type: "status",
              phase: "tool_use",
              message: `Skill: ${(input as { skill?: string }).skill ?? "unknown"}...`,
            });
            return { behavior: "allow", updatedInput: input };
          }
```

`Edit`, `Write`, `Bash`, `TodoWrite` are intentionally NOT in the auto-allow branches — they fall through to `isToolAllowed` → side-channel permission request, matching the existing pattern for unrecognized tools.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/chat/__tests__/engine-sdk-options.test.ts`
Expected: 5/5 tests PASS.

- [ ] **Step 7: Add a canUseTool auto-allow integration test**

Append to the same test file (`engine-sdk-options.test.ts`):

```typescript
import { canUseToolForTest } from "@/lib/chat/engine"; // see step 8

describe("canUseTool auto-allow policy for SDK filesystem tools", () => {
  it("auto-allows Read without a permission request", async () => {
    const result = await canUseToolForTest("Read", { file_path: "/tmp/x" });
    expect(result.behavior).toBe("allow");
  });

  it("auto-allows Grep without a permission request", async () => {
    const result = await canUseToolForTest("Grep", { pattern: "foo" });
    expect(result.behavior).toBe("allow");
  });

  it("does NOT auto-allow Edit (must go through permission flow)", async () => {
    // When the permission flow is in play, canUseToolForTest either blocks
    // waiting on a side-channel response or raises — assert by checking that
    // it does not synchronously return behavior "allow" from the auto-allow
    // branch. In this fake test harness, canUseToolForTest routes to a
    // "requested-permission" sentinel for non-auto-allow tools.
    const result = await canUseToolForTest("Edit", { file_path: "/tmp/x", content: "y" });
    expect(result.behavior).not.toBe("allow");
  });

  it("does NOT auto-allow Bash", async () => {
    const result = await canUseToolForTest("Bash", { command: "ls" });
    expect(result.behavior).not.toBe("allow");
  });
});
```

- [ ] **Step 8: Extract `canUseToolForTest` from engine.ts**

The existing `canUseTool` closure at `engine.ts:317` captures `conversationId` and other per-request state, making it hard to test in isolation. Extract the auto-allow policy into a pure function.

At the top of `src/lib/chat/engine.ts` (near `CLAUDE_SDK_READ_ONLY_FS_TOOLS`), add:

```typescript
import type { ToolPermissionResponse } from "./permission-bridge";

/**
 * Pure auto-allow policy for SDK filesystem + Skill tools. Exposed for tests.
 * Returns `{ behavior: "allow" }` for auto-allowed tools, or
 * `{ behavior: "pending" }` to signal "route through permission flow".
 * The real canUseTool in query() options uses the full side-channel bridge.
 */
export async function canUseToolForTest(
  toolName: string,
  _input: Record<string, unknown>
): Promise<ToolPermissionResponse | { behavior: "pending" }> {
  if (CLAUDE_SDK_READ_ONLY_FS_TOOLS.has(toolName)) {
    return { behavior: "allow" };
  }
  if (toolName === "Skill") {
    return { behavior: "allow" };
  }
  return { behavior: "pending" };
}
```

Note: this helper is **only** the auto-allow policy for SDK filesystem/Skill tools. The full `canUseTool` closure in `query()` options handles ainative MCP, browser, Exa, and the saved-permission fallback. We are not refactoring the full closure — just extracting a testable slice of the new policy.

- [ ] **Step 9: Re-run the full test file to verify**

Run: `npx vitest run src/lib/chat/__tests__/engine-sdk-options.test.ts`
Expected: 9/9 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/chat/engine.ts src/lib/chat/__tests__/engine-sdk-options.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): enable SDK-native skills and filesystem tools on Claude runtime

Adds settingSources: ["user", "project"] and the Claude SDK filesystem tool
set (Skill, Read, Grep, Glob, Edit, Write, Bash, TodoWrite) to the chat
query() options. Read/Grep/Glob auto-allow via the existing browser/exa
read-only pattern; Edit/Write/Bash/TodoWrite gate through the side-channel
permission bridge automatically (no new plumbing). Task tool excluded —
ainative task primitives replace it per §3.3 of the ideas doc.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Hooks-excluded regression test

**Files:**
- Modify: `src/lib/chat/__tests__/engine-sdk-options.test.ts`

Asserts that filesystem `hooks` loading is explicitly not enabled. Q2 scope exclusion.

- [ ] **Step 1: Write the failing test**

Append to `engine-sdk-options.test.ts`:

```typescript
describe("hooks excluded per Q2", () => {
  it("does not declare a hooks field alongside settingSources", async () => {
    const source = await import("fs").then((fs) =>
      fs.readFileSync(
        new URL("../engine.ts", import.meta.url),
        "utf8"
      )
    );
    // Assert that within the query() options block, there is no `hooks:` field.
    // This is a regex-level check because the options object is inline literals.
    const optionsBlock = source.match(/query\(\s*\{[\s\S]*?\}\s*\)/)?.[0] ?? "";
    expect(optionsBlock).toContain("settingSources");
    expect(optionsBlock).not.toMatch(/\bhooks\s*:/);
  });
});
```

- [ ] **Step 2: Run test and verify it passes**

Run: `npx vitest run src/lib/chat/__tests__/engine-sdk-options.test.ts`
Expected: all 10 tests PASS (the new hooks-excluded test passes because Task 1 did not add a `hooks:` key).

- [ ] **Step 3: Sanity-check the guard**

Temporarily add `hooks: {},` to the `query()` options in `engine.ts` (inside the options object). Re-run the test.
Expected: the hooks-excluded test FAILS with the regex matching `hooks:`.
**Revert the temporary addition.** Re-run and confirm all 10 pass again.

- [ ] **Step 4: Commit**

```bash
git add src/lib/chat/__tests__/engine-sdk-options.test.ts
git commit -m "$(cat <<'EOF'
test(chat): regression-guard that Claude SDK hooks are not loaded

Per Q2 scope exclusion on the Chat Context Experience initiative,
filesystem hooks are intentionally not wired to chat. This test
greps the engine.ts source to fail if someone later adds a hooks
field to the query() options.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Tier 0 / CLAUDE.md partition audit (DD-CE-002)

**Files:**
- Modify: `src/lib/chat/system-prompt.ts` (inline doc comment)
- Create: `features/chat-claude-sdk-skills.md` (append audit section)

Performs the partition audit that DD-CE-002 requires and **documents the finding in code**. For this specific codebase, the finding is expected to be "minimal movement needed" — Tier 0 is overwhelmingly ainative-identity, and the repo's current `CLAUDE.md` is a thin pointer file. The audit documents this explicitly so future work can flag any regression (e.g. someone adding project-specific testing rules to `system-prompt.ts` instead of to `CLAUDE.md`).

**What this task is NOT:** speculative editorial rewriting of the system prompt. If the audit finds nothing to move, nothing moves.

- [ ] **Step 1: Audit each block of `STAGENT_SYSTEM_PROMPT`**

Read `src/lib/chat/system-prompt.ts` lines 6-117. For each numbered block below, apply the rubric:

**Rubric:**
- **KEEP in Tier 0** if content is (a) ainative identity, (b) ainative tool catalog / routing, (c) ainative domain semantics (e.g. "delay steps mean X"), or (d) LLM interaction style that applies regardless of project.
- **MOVE to CLAUDE.md** if content is (a) project conventions (coding style, testing rules), (b) repo-specific rules (git workflow, commit format), or (c) anything that a developer editing AGENTS.md would write.

Audit result for this codebase (document below; do not yet edit):

| Block | Lines | Decision | Rationale |
|---|---|---|---|
| Identity | 6 | KEEP | ainative identity |
| Tool catalog | 8-79 | KEEP | ainative primitives |
| When to Use Which Tools | 81-90 | KEEP | Tool routing guidance |
| Approach | 92-98 | KEEP | LLM interaction style |
| Guidelines lines 101-109 | 101-109 | KEEP | All ainative-domain semantics (priority default, approval markers, workflow patterns, delay steps syntax, enrich_table idempotency, create_workflow dedup) |
| Worktree note | 110 | KEEP (borderline) | Mixes ainative file-creation semantics with worktree-awareness. Could argue for moving to CLAUDE.md, but the instruction is fundamentally about how ainative tools should behave, not about the repo's development workflow. |
| Document Pool Awareness | 112-117 | KEEP | ainative workflow patterns |

**Conclusion:** **Zero content moves for this codebase.** The partition is already clean because Tier 0 is deliberately ainative-identity-focused. The audit itself is the deliverable — it establishes the rubric so future additions can be placed correctly.

- [ ] **Step 2: Add the audit as a code comment above `STAGENT_SYSTEM_PROMPT`**

Change the existing comment block at `src/lib/chat/system-prompt.ts:1-5` from:

```typescript
/**
 * Enhanced system prompt for the ainative chat LLM.
 * Provides identity, tool catalog, and intent routing guidance.
 */
```

to:

```typescript
/**
 * Enhanced system prompt for the ainative chat LLM.
 * Provides identity, tool catalog, and intent routing guidance.
 *
 * ## Tier 0 vs CLAUDE.md partition (DD-CE-002)
 *
 * When the chat engine runs on the `claude-code` runtime, the Claude Agent
 * SDK loads project-level `CLAUDE.md` and user-level `~/.claude/CLAUDE.md`
 * via `settingSources: ["user", "project"]`. To avoid double-prompting,
 * this system prompt MUST stay scoped to:
 *
 *   (a) ainative identity
 *   (b) ainative tool catalog and routing
 *   (c) ainative domain semantics (delay steps, enrich_table, workflow dedup)
 *   (d) LLM interaction style
 *
 * Content that is project-specific (coding conventions, testing rules,
 * git workflow, repo-specific gotchas) belongs in `CLAUDE.md` — NOT here.
 *
 * Audit (2026-04-13): every current block in this prompt passes the rubric.
 * No content migration was required for ainative's current CLAUDE.md state.
 * The worktree note on line 110 is borderline and flagged for revisit if
 * CLAUDE.md gains an explicit worktree section.
 *
 * Reference: features/chat-claude-sdk-skills.md (§"Tier 0 vs CLAUDE.md").
 */
```

- [ ] **Step 3: Append audit section to the feature spec**

Append to `features/chat-claude-sdk-skills.md` (after the References section):

```markdown

## Tier 0 vs CLAUDE.md partition audit (DD-CE-002)

Audit performed 2026-04-13 during implementation of this feature.

**Rubric:**
- KEEP in Tier 0 (`src/lib/chat/system-prompt.ts`): ainative identity, tool catalog, tool routing, ainative domain semantics, LLM interaction style.
- MOVE to CLAUDE.md: project conventions, repo-specific rules, testing/git workflow guidance.

**Result for the ainative repo:** zero content migration. Tier 0 blocks all pass the KEEP rubric:

| Block (lines in `system-prompt.ts`) | Decision |
|---|---|
| Identity (6) | Keep |
| Tool catalog (8-79) | Keep |
| When to Use Which Tools (81-90) | Keep |
| Approach (92-98) | Keep |
| Guidelines (101-109) | Keep |
| Worktree note (110) | Keep (borderline) |
| Document Pool Awareness (112-117) | Keep |

The current `CLAUDE.md` at the repo root is a 34-line pointer file referencing `AGENTS.md`. The SDK cannot follow that pointer (AGENTS.md is a Codex convention, not a Claude setting source), so users who expect rich project-convention content to reach the LLM should either:
1. Inline the relevant content into `CLAUDE.md` directly, or
2. Track this in a follow-up editorial pass, separate from this feature.

**Regression guard:** the rubric is documented as a doc comment on `STAGENT_SYSTEM_PROMPT`. Any future contributor adding project-specific rules to `system-prompt.ts` should be caught in code review against this rubric.
```

- [ ] **Step 4: Run tests to confirm no behavior regression**

Run: `npm test -- --run src/lib/chat`
Expected: existing chat tests still pass. Comment and doc changes should not affect any assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/system-prompt.ts features/chat-claude-sdk-skills.md
git commit -m "$(cat <<'EOF'
docs(chat): document Tier 0 vs CLAUDE.md partition rubric (DD-CE-002)

Completes the partition audit required by DD-CE-002. Finding: no content
migration needed for this codebase — Tier 0 is already ainative-identity
scoped. The rubric is codified as a doc comment above STAGENT_SYSTEM_PROMPT
so future additions are caught in code review, and the audit result is
appended to the feature spec.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `listAllProfiles(projectDir)` helper

**Files:**
- Create: `src/lib/agents/profiles/list-all-profiles.ts`
- Create: `src/lib/agents/profiles/__tests__/list-all-profiles.test.ts`

Fuses registry profiles with SDK-discovered filesystem skills (project `.claude/skills/*/SKILL.md` and user `~/.claude/skills/*/SKILL.md`). Dedupes by skill id, with registry profiles winning on collision (they're explicitly curated).

- [ ] **Step 1: Write the failing test**

Create `src/lib/agents/profiles/__tests__/list-all-profiles.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { listAllProfiles } from "@/lib/agents/profiles/list-all-profiles";

describe("listAllProfiles", () => {
  let projectDir: string;
  let userSkillsDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ainative-skills-"));
    userSkillsDir = mkdtempSync(join(tmpdir(), "ainative-user-skills-"));
    mkdirSync(join(projectDir, ".claude", "skills"), { recursive: true });
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(userSkillsDir, { recursive: true, force: true });
  });

  function writeSkill(baseDir: string, name: string, frontmatter: string) {
    mkdirSync(join(baseDir, name), { recursive: true });
    writeFileSync(
      join(baseDir, name, "SKILL.md"),
      `---\n${frontmatter}\n---\n\nbody for ${name}\n`
    );
  }

  it("returns registry profiles when no filesystem skills exist", async () => {
    const result = await listAllProfiles(projectDir, userSkillsDir);
    // Should contain at least one registry profile (builtin)
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => typeof p.id === "string")).toBe(true);
  });

  it("surfaces a project .claude/skills/<name> entry", async () => {
    writeSkill(
      join(projectDir, ".claude", "skills"),
      "my-project-skill",
      `name: my-project-skill\ndescription: Test project skill`
    );
    const result = await listAllProfiles(projectDir, userSkillsDir);
    expect(result.some((p) => p.id === "my-project-skill")).toBe(true);
    const skill = result.find((p) => p.id === "my-project-skill")!;
    expect(skill.name).toBe("my-project-skill");
    expect(skill.description).toBe("Test project skill");
    expect(skill.origin).toBe("filesystem-project");
  });

  it("surfaces a user ~/.claude/skills/<name> entry", async () => {
    writeSkill(
      userSkillsDir,
      "my-user-skill",
      `name: my-user-skill\ndescription: Test user skill`
    );
    const result = await listAllProfiles(projectDir, userSkillsDir);
    expect(result.some((p) => p.id === "my-user-skill")).toBe(true);
    expect(
      result.find((p) => p.id === "my-user-skill")!.origin
    ).toBe("filesystem-user");
  });

  it("dedupes by id — registry profile wins over filesystem skill with same id", async () => {
    // "general" is a known builtin registry profile id; write a filesystem
    // skill with the same id to force a collision.
    writeSkill(
      join(projectDir, ".claude", "skills"),
      "general",
      `name: general\ndescription: This should be overridden by registry`
    );
    const result = await listAllProfiles(projectDir, userSkillsDir);
    const entries = result.filter((p) => p.id === "general");
    expect(entries).toHaveLength(1);
    // Registry description should win (not the filesystem-overridden one)
    expect(entries[0].description).not.toBe("This should be overridden by registry");
  });

  it("logs and skips a malformed SKILL.md (no name field in frontmatter)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    writeSkill(
      join(projectDir, ".claude", "skills"),
      "broken-skill",
      `description: Missing name field — broken`
    );
    const result = await listAllProfiles(projectDir, userSkillsDir);
    expect(result.some((p) => p.id === "broken-skill")).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns an empty-safe result when projectDir does not exist", async () => {
    const result = await listAllProfiles("/nonexistent/path", userSkillsDir);
    // Should still return registry + user skills, no throw
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/agents/profiles/__tests__/list-all-profiles.test.ts`
Expected: all tests fail with "Cannot find module '@/lib/agents/profiles/list-all-profiles'".

- [ ] **Step 3: Implement `listAllProfiles`**

Create `src/lib/agents/profiles/list-all-profiles.ts`:

```typescript
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { listProfiles } from "./registry";
import type { AgentProfile } from "./types";

/**
 * Minimal YAML frontmatter parser — handles the `---\nkey: value\n---\n...`
 * pattern used by SKILL.md files. Returns null if no frontmatter or no `name`.
 */
function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function loadFilesystemSkills(
  skillsDir: string,
  origin: "filesystem-project" | "filesystem-user"
): AgentProfile[] {
  if (!existsSync(skillsDir)) return [];
  const profiles: AgentProfile[] = [];
  for (const entry of readdirSync(skillsDir)) {
    const skillPath = join(skillsDir, entry);
    try {
      if (!statSync(skillPath).isDirectory()) continue;
      const skillMdPath = join(skillPath, "SKILL.md");
      if (!existsSync(skillMdPath)) continue;
      const content = readFileSync(skillMdPath, "utf8");
      const fm = parseFrontmatter(content);
      if (!fm || !fm.name) {
        console.warn(
          `[listAllProfiles] skipping ${skillMdPath}: missing name in frontmatter`
        );
        continue;
      }
      profiles.push({
        id: fm.name,
        name: fm.name,
        description: fm.description ?? "",
        domain: "skill",
        tags: [],
        skillMd: content,
        allowedTools: [],
        mcpServers: [],
        origin,
        scope: origin === "filesystem-project" ? "project" : "user",
        readOnly: true,
        projectDir: origin === "filesystem-project" ? skillsDir : undefined,
      } as AgentProfile);
    } catch (err) {
      console.warn(
        `[listAllProfiles] failed to load skill at ${skillPath}:`,
        (err as Error).message
      );
    }
  }
  return profiles;
}

/**
 * Lists every agent profile reachable from this ainative instance:
 *   1. Registry profiles (builtins + user registry)
 *   2. Project filesystem skills at `<projectDir>/.claude/skills/*/SKILL.md`
 *   3. User filesystem skills at `~/.claude/skills/*/SKILL.md` (or `userSkillsDir` override)
 * Dedupes by id — registry profiles win on collision (they're curated).
 *
 * @param projectDir Absolute path to the active project's working directory
 * @param userSkillsDir Override for user skills dir (tests); defaults to `~/.claude/skills`
 */
export async function listAllProfiles(
  projectDir: string | null | undefined,
  userSkillsDir: string = join(homedir(), ".claude", "skills")
): Promise<AgentProfile[]> {
  const registry = listProfiles();
  const registryIds = new Set(registry.map((p) => p.id));

  const userSkills = loadFilesystemSkills(userSkillsDir, "filesystem-user").filter(
    (p) => !registryIds.has(p.id)
  );

  const projectSkills = projectDir
    ? loadFilesystemSkills(
        join(projectDir, ".claude", "skills"),
        "filesystem-project"
      ).filter((p) => !registryIds.has(p.id) && !userSkills.some((u) => u.id === p.id))
    : [];

  return [...registry, ...userSkills, ...projectSkills];
}
```

- [ ] **Step 4: Ensure `AgentProfile.origin` allows the new values**

Check `src/lib/agents/profiles/types.ts`. The `origin` field is likely already a string union. If it does not include `"filesystem-project"` or `"filesystem-user"`, extend it:

```typescript
// In types.ts, find the origin field and ensure it is:
origin: "builtin" | "registry" | "filesystem-project" | "filesystem-user" | /* preserve any existing values */;
```

Only add values that don't already exist. Do not remove existing values. If the union doesn't narrow to something specific today (e.g., it's a free `string`), leave it alone.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/lib/agents/profiles/__tests__/list-all-profiles.test.ts`
Expected: 6/6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agents/profiles/list-all-profiles.ts src/lib/agents/profiles/__tests__/list-all-profiles.test.ts src/lib/agents/profiles/types.ts
git commit -m "$(cat <<'EOF'
feat(profiles): add listAllProfiles that fuses registry + filesystem skills

Walks <projectDir>/.claude/skills/ and ~/.claude/skills/ for SKILL.md files,
parses frontmatter (name, description), and merges with the existing
registry profile list. Dedupes by id — registry wins on collision.
Malformed frontmatter logs-then-skips rather than throwing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `list_profiles` chat tool to `listAllProfiles`

**Files:**
- Modify: `src/lib/chat/tools/profile-tools.ts:7-28`
- Test: `src/lib/chat/tools/__tests__/profile-tools.test.ts` (create or extend)

- [ ] **Step 1: Write the failing test**

Create or append to `src/lib/chat/tools/__tests__/profile-tools.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agents/profiles/list-all-profiles", () => ({
  listAllProfiles: vi.fn(async (projectDir: string | null) => [
    { id: "general", name: "General", description: "Reg", domain: "general", tags: [] },
    projectDir
      ? {
          id: "project-only",
          name: "Project Only",
          description: "Proj",
          domain: "skill",
          tags: [],
          origin: "filesystem-project",
        }
      : null,
  ].filter(Boolean)),
}));

describe("list_profiles chat tool", () => {
  it("returns fused profiles when called with a projectDir", async () => {
    const { getListProfilesTool } = await import("@/lib/chat/tools/profile-tools");
    const tool = getListProfilesTool("/fake/project");
    const result = await tool.handler({});
    // The tool returns an `ok()` wrapper — unwrap to get the list
    const list = "ok" in result ? (result as { ok: unknown[] }).ok : result;
    expect(Array.isArray(list)).toBe(true);
    expect((list as { id: string }[]).some((p) => p.id === "project-only")).toBe(true);
  });

  it("returns registry-only profiles when projectDir is null", async () => {
    const { getListProfilesTool } = await import("@/lib/chat/tools/profile-tools");
    const tool = getListProfilesTool(null);
    const result = await tool.handler({});
    const list = "ok" in result ? (result as { ok: unknown[] }).ok : result;
    expect(
      (list as { id: string }[]).every((p) => p.id !== "project-only")
    ).toBe(true);
  });
});
```

**Note on test design:** the current `profile-tools.ts` exports tools via `defineTool` at module-top-level, which means they can't be parameterized by `projectDir`. The implementation in Step 3 below introduces a `getListProfilesTool(projectDir)` factory that the engine calls at request time with the conversation's projectDir. Factory + assertion is the only way this test can ask a meaningful question.

- [ ] **Step 2: Run test and verify fail**

Run: `npx vitest run src/lib/chat/tools/__tests__/profile-tools.test.ts`
Expected: fails with "getListProfilesTool is not exported".

- [ ] **Step 3: Update `profile-tools.ts`**

Replace `src/lib/chat/tools/profile-tools.ts:7-28` (the `defineTool("list_profiles", ...)` block) with:

```typescript
import { defineTool, ok } from "./define-tool"; // preserve existing import
import { listAllProfiles } from "@/lib/agents/profiles/list-all-profiles";

/**
 * Factory for the list_profiles tool, parameterized by projectDir so it can
 * surface project filesystem skills alongside registry profiles.
 */
export function getListProfilesTool(projectDir: string | null) {
  return defineTool(
    "list_profiles",
    "List all available agent profiles and filesystem skills with their capabilities and compatible runtimes.",
    {},
    async () => {
      const profiles = await listAllProfiles(projectDir);
      return ok(
        profiles.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          domain: p.domain,
          tags: p.tags,
          origin: (p as { origin?: string }).origin ?? "registry",
        }))
      );
    }
  );
}
```

**Preserve** any other tool exports in this file (e.g. `get_profile`). Only the `list_profiles` block changes. The old top-level `defineTool("list_profiles", ...)` constant (if assigned to a variable and exported from an index) must be removed, and its consumers updated to call `getListProfilesTool(projectDir)` at request time.

- [ ] **Step 4: Find and update consumers of the old `list_profiles` tool export**

Run: `grep -rn "list_profiles\|profile-tools" src/lib/chat/ --include="*.ts"` to find where the tool is registered into the ainative MCP server. Most likely:
- `src/lib/chat/ainative-tools.ts` or similar imports all tools into one array.

Whatever consumes the old tool export, change it to call `getListProfilesTool(projectId)` with the current conversation's project directory. The project directory is available in `engine.ts` via `workspace.cwd` or the resolved `project.workingDirectory` (lines 188-207).

If the current registration pattern is a static array of tools (not per-request), you must thread `projectDir` through. The simplest change: in `engine.ts`, wherever the ainative MCP server is assembled (around line 280), pass `workspace.cwd` (or the project's working directory) so `getListProfilesTool` can be called with it.

- [ ] **Step 5: Run the test file to verify pass**

Run: `npx vitest run src/lib/chat/tools/__tests__/profile-tools.test.ts`
Expected: 2/2 PASS.

- [ ] **Step 6: Run the full chat test suite**

Run: `npm test -- --run src/lib/chat`
Expected: all pre-existing chat tests still pass (no regressions from threading `projectDir`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/chat/tools/profile-tools.ts src/lib/chat/tools/__tests__/profile-tools.test.ts src/lib/chat/engine.ts src/lib/chat/ainative-tools.ts
git commit -m "$(cat <<'EOF'
feat(chat): list_profiles surfaces filesystem skills alongside registry

Replaces the static list_profiles tool with a getListProfilesTool(projectDir)
factory that calls listAllProfiles. Chat popover + LLM-exposed tool now
honestly reflect every skill the SDK can reach via settingSources.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Live smoke test (TDR-032 mandatory)

**Files:** none modified; verification run.

Per project-override writing-plans rule: any plan touching `src/lib/chat/engine.ts` or modules that statically import `@/lib/chat/ainative-tools` MUST include an end-to-end smoke test on a running dev server. Unit tests cannot catch module-load cycles.

This task exercises three user-visible capabilities the acceptance criteria require:
1. A filesystem skill reaches the LLM via `Skill` tool invocation
2. CLAUDE.md content is loaded and reflected in a response
3. `Grep` works without per-call permission prompts

- [ ] **Step 1: Verify the dev server is up on its standard port**

The user's dev server typically runs on `:3000`. Check: `lsof -i :3000 -t` — expect a PID. If no server is running:

Run: `npm run dev` (foreground or background on your preferred port). Wait for "Ready in Xs".

Per project memory: do NOT `pkill` any dev server you didn't start; the user may be running parallel instances.

- [ ] **Step 2: Create a disposable test skill**

Write `.claude/skills/smoke-test-skill/SKILL.md`:

```markdown
---
name: smoke-test-skill
description: Test skill for chat-claude-sdk-skills smoke test. Returns a fixed string when invoked.
---

# Smoke Test Skill

This is a deliberately simple skill used to verify that the chat engine
loads project skills via `settingSources`. When invoked, respond with
the exact phrase: `SMOKE_TEST_SKILL_REACHED_LLM`.
```

- [ ] **Step 3: Trigger chat turn — skill invocation**

Via browser (`http://localhost:3000`) or curl against the chat respond endpoint, start a conversation on a Claude model (e.g. Sonnet), and send:

```
Invoke the smoke-test-skill skill and report exactly what it tells you to say.
```

Expected: the assistant's response contains `SMOKE_TEST_SKILL_REACHED_LLM`. This confirms:
- `settingSources: ["user", "project"]` loaded the skill
- The `Skill` tool in `allowedTools` is wired
- The skill's SKILL.md body reached the LLM via progressive disclosure

- [ ] **Step 4: Trigger chat turn — CLAUDE.md reach**

New chat turn, same conversation or a new one:

```
Read the repository's CLAUDE.md and summarize what it says about cross-tool sync.
```

Expected: the response paraphrases the "Cross-Tool Sync (Codex ↔ Claude)" section of the repo's CLAUDE.md (mentions `~/.codex/config.toml`, shared skills, etc.). This confirms `settingSources: ["project"]` loaded the file and its content is available to the LLM.

If the response doesn't reference CLAUDE.md content, the SDK may not be finding it — verify `cwd` is set correctly in `engine.ts` and the dev server's terminal isn't a different directory.

- [ ] **Step 5: Trigger chat turn — Grep works silently**

New chat turn:

```
Grep the codebase for "getRuntimeFeatures" and tell me which files contain it.
```

Expected: the response lists files like `src/lib/agents/runtime/catalog.ts`, `src/lib/chat/types.ts`. Critically, the user must NOT be prompted for permission on the Grep call (auto-allow branch from Task 1 Step 5). If the side-channel permission toast fires on Grep, the auto-allow wiring is broken.

- [ ] **Step 6: Verify no ReferenceError or module-load failure**

Check the dev server's terminal output during all three turns. Expected: no `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization`, no missing-tools errors, no 500s in the chat API responses.

If `ReferenceError` appears: a module-load cycle was introduced. Trace the import from `engine.ts` → any file that pulls `@/lib/chat/ainative-tools` statically → introduce `await import(...)` at the call site. Reference: TDR-032.

- [ ] **Step 7: Clean up the disposable skill**

Run: `rm -rf .claude/skills/smoke-test-skill`

Confirm nothing else references it: `grep -rn "smoke-test-skill" .` → expect no matches.

- [ ] **Step 8: Append the smoke-test outcome to the feature spec**

Append to `features/chat-claude-sdk-skills.md`:

```markdown

## Smoke test outcomes (YYYY-MM-DD)

Per TDR-032, the following live-environment checks all passed against `npm run dev`:

- **Skill invocation:** created ephemeral `.claude/skills/smoke-test-skill/SKILL.md` with a marker phrase, asked chat to invoke the skill, confirmed the marker phrase reached the LLM.
- **CLAUDE.md reach:** asked chat to summarize the repo's `CLAUDE.md`. Response reflected actual file content (Cross-Tool Sync section).
- **Grep without prompt:** asked chat to grep for `getRuntimeFeatures`. Grep executed and returned results without raising a side-channel permission request.
- **No module-load cycle:** dev server console showed no `ReferenceError` during any of the three turns.

Test skill removed after verification.
```

Replace `YYYY-MM-DD` with today's date.

- [ ] **Step 9: Commit**

```bash
git add features/chat-claude-sdk-skills.md
git commit -m "$(cat <<'EOF'
docs(features): record chat-claude-sdk-skills smoke-test outcomes

Verifies per TDR-032 that the three user-visible capabilities land:
skill invocation reaches the LLM, CLAUDE.md content is loaded via
settingSources, and Grep auto-allows without permission prompts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Feature closeout

**Files:**
- Modify: `features/chat-claude-sdk-skills.md` (status frontmatter)
- Modify: `features/roadmap.md`
- Modify: `features/changelog.md`

- [ ] **Step 1: Flip status in the feature spec frontmatter**

Change `features/chat-claude-sdk-skills.md:3`:

```
status: planned
```

to

```
status: complete
```

- [ ] **Step 2: Update roadmap**

In `features/roadmap.md`, find the Chat Context Experience section row for `chat-claude-sdk-skills` and change its `Status` cell from `planned` to `completed`.

- [ ] **Step 3: Append changelog entry**

Prepend under the `## 2026-04-13` heading in `features/changelog.md`:

```markdown
### Completed — chat-claude-sdk-skills (P0)

Flipped ainative chat on the `claude-code` runtime from "isolation mode" to "SDK-native." Three small changes to `src/lib/chat/engine.ts`: added `settingSources: ["user", "project"]`, added the SDK filesystem tool set (Skill, Read, Grep, Glob, Edit, Write, Bash, TodoWrite) to `allowedTools`, and added a read-only auto-allow branch in `canUseTool` for Read/Grep/Glob (mirroring the browser/exa pattern). Edit/Write/Bash/TodoWrite gate through the existing side-channel permission flow automatically — no new permission plumbing. `Task` subagent tool intentionally excluded; ainative task primitives replace it.

Tier 0 / CLAUDE.md partition audit (DD-CE-002): documented in a doc comment on `STAGENT_SYSTEM_PROMPT`. Finding: zero content migration needed — Tier 0 is already ainative-identity scoped for this codebase.

`list_profiles` chat tool now fuses registry profiles with SDK-discovered filesystem skills from `<projectDir>/.claude/skills/` and `~/.claude/skills/` via a new `listAllProfiles(projectDir)` helper. Dedupes by id — registry wins on collision. Malformed SKILL.md frontmatter logs-then-skips.

Regression guards: hooks-excluded test greps engine.ts source for a `hooks:` key. Auto-allow policy extracted to `canUseToolForTest` for unit coverage. TDR-032 smoke test: skill invocation, CLAUDE.md reach, Grep-without-prompt — all green.

Unblocks: `chat-codex-app-server-skills` (P1), `chat-ollama-native-skills` (P2), `task-runtime-skill-parity` (P1), `chat-file-mentions` (P1), `chat-command-namespace-refactor` (P1).
```

- [ ] **Step 4: Commit**

```bash
git add features/chat-claude-sdk-skills.md features/roadmap.md features/changelog.md
git commit -m "$(cat <<'EOF'
docs(features): close out chat-claude-sdk-skills (P0 complete)

Flips status to complete, updates roadmap, logs changelog entry.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification checklist (run before declaring the plan complete)

- [ ] `npx tsc --noEmit` exits 0 (no new TypeScript errors)
- [ ] `npm test` passes fully; `src/lib/chat/__tests__/engine-sdk-options.test.ts` (10 tests), `src/lib/agents/profiles/__tests__/list-all-profiles.test.ts` (6 tests), `src/lib/chat/tools/__tests__/profile-tools.test.ts` (2 tests) all green
- [ ] Seven commits landed (one per task)
- [ ] Smoke test passed all three checks (skill invocation, CLAUDE.md reach, Grep auto-allow) with no `ReferenceError` in the dev server console
- [ ] Ephemeral `smoke-test-skill` directory removed
- [ ] Feature spec `status: complete`, roadmap updated, changelog entry added
- [ ] Spec acceptance criteria re-read: all nine criteria in `features/chat-claude-sdk-skills.md` green, with `list_profiles` consumer wiring specifically verified in Task 5 Step 4
- [ ] Error & Rescue Registry entries re-read; none triggered, none need new mitigation
