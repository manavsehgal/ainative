# Task Create Profile Validation + Disappearance Spike — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the validation gap in `create_task` (which today accepts any string as `agentProfile`, including runtime IDs like `"anthropic-direct"`), surface stale-profile errors synchronously at `execute_task`, add operator-facing UX for the `list_tasks` project-scoping behavior that is the most probable root cause of the reported "task disappears" symptom, and document the spike findings that corrected the original handoff's "task was deleted" framing.

**Architecture:** Four commits on `main`:
1. Spike addendum into the feature spec (docs-only, no code)
2. Profile validation on `create_task` / `update_task` Zod schemas via `z.string().refine(id => getProfile(id) !== undefined, …)` + synchronous pre-check in `execute_task` for stale stored profiles + unit tests
3. `list_tasks` empty-result note surfacing the active project scope + unit test
4. Flip-to-completed (spec frontmatter + roadmap + changelog)

**Tech Stack:** TypeScript, Zod, Drizzle ORM (SQLite), Vitest.

---

## What already exists

Verified by reading the current codebase, not trusting the spec's line numbers blindly.

| What | Where | Evidence |
|---|---|---|
| `create_task` Zod schema with unvalidated `agentProfile` | `src/lib/chat/tools/task-tools.ts:91-96` | `agentProfile: z.string().optional()` — accepts any string. Compare to `assignedAgent` (runtime) at `:85-90` which has a post-parse check via `isAgentRuntimeId()` in the handler body at `:100-104`. |
| `update_task` has the same gap | `src/lib/chat/tools/task-tools.ts:163-168` | Same `z.string().optional()` pattern; no validation at all. |
| `execute_task` does not read or validate `agentProfile` | `src/lib/chat/tools/task-tools.ts:238-285` | Only validates `assignedAgent` (runtime). The stored `task.agentProfile` is ignored at queue time and passes through to the runtime where it eventually fails with a runtime-level error via `buildTaskQueryContext`. |
| `list_tasks` silent project scoping | `src/lib/chat/tools/task-tools.ts:41-54` | `effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined` — if truthy, filters by project. No explanation returned when the filter produces 0 rows. This is the prime candidate for the user-reported "task disappeared" symptom. |
| `getProfile` / `listProfiles` — sync, cached | `src/lib/agents/profiles/registry.ts:239-245` | `getProfile(id): AgentProfile \| undefined` and `listProfiles(): AgentProfile[]`. Both synchronous. Backed by `ensureLoaded()` which uses a filesystem-signature cache at `:224-233` — first call reads the disk, subsequent calls return from memory. |
| Profile registry is loaded from `~/.claude/skills/` | `src/lib/agents/profiles/registry.ts:33-38, 143-218` | `SKILLS_DIR = ~/.claude/skills`; `scanProfiles()` reads every subdir's `profile.yaml` and returns a `Map<string, AgentProfile>`. |
| Builtin profiles (20) | `src/lib/agents/profiles/builtins/` | `general`, `code-reviewer`, `researcher`, `data-analyst`, `devops-engineer`, `document-writer`, `financial-analyst`, `health-fitness-coach`, `learning-coach`, `marketing-strategist`, `operations-coordinator`, `project-manager`, `sales-researcher`, `shopping-assistant`, `sweep`, `technical-writer`, `travel-planner`, `upgrade-assistant`, `customer-support-agent`, `content-creator`. Use `"general"` as the known-good test case. |
| Runtime IDs (for negative test) | `src/lib/agents/runtime/catalog.ts` → `SUPPORTED_AGENT_RUNTIMES` | Includes `"anthropic-direct"` — which is the exact value the handoff documented as the historic bug trigger. |
| No task deletion anywhere in `src/` | verified by grep | `grep -r "delete(tasks)" src/` → 0 results. Every failure path in `claude-agent.ts` (lines 130, 418-420, 745-748, 809-811) preserves the row with `status: "failed"` and a `failureReason`. |
| Every runtime reads `task.agentProfile ?? "general"` | `claude-agent.ts:521`, `openai-direct.ts:199`, `openai-codex.ts:143`, `ollama-adapter.ts:169`, `anthropic-direct.ts:272` | The `?? "general"` fallback only triggers when `task.agentProfile` is `null`. A non-null invalid string (`"anthropic-direct"`) passes through and fails at runtime, not at queue time — which is the exact gap AC #5 targets. |
| `STAGENT_DATA_DIR` per-process isolation | `src/lib/utils/ainative-paths.ts:4-6`, `src/lib/db/index.ts:9-18` | `getAinativeDataDir()` reads `process.env.STAGENT_DATA_DIR` once at module load. Different processes (main vs. domain clones) hit different SQLite files. Per `MEMORY.md → shared-ainative-data-dir.md`, this is intentional — fix is operator-facing messaging, not a scoping change. Out of scope for this feature. |
| Test file `task-tools.test.ts` does NOT yet exist | `ls src/lib/chat/tools/__tests__/` | Current contents: `enrich-table-tool.test.ts`, `schedule-tools.test.ts` (shipped in Task 2), `workflow-tools-dedup.test.ts`. We create a fresh `task-tools.test.ts`. |

## NOT in scope

- **`schedule-tools.ts:agentProfile` validation.** Same bug class (`z.string().optional()`) exists at `schedule-tools.ts:63`, and the fix is the same 5-line pattern. Explicitly outside the spec title and Included list. File a follow-up after Task 3 if wanted.
- **`STAGENT_DATA_DIR` changes.** Per spec Scope Boundaries: "Any change to the domain-clone `STAGENT_DATA_DIR` isolation model (even if the spike finds it is the cause — the fix there is error messaging, not isolation changes)."
- **Adding a health-check/startup log for the active data dir.** Infrastructure-level change affecting all instances; not task-validation feature work. File separately if wanted.
- **Adding projectId filter to `get_task`.** Would harm AC #4 ("No task returned from `create_task` is unfindable via `get_task` within the same data-dir + project scope") and break intentional lookup-by-ID. Do not do this.
- **Removing `list_tasks` project scoping entirely.** Breaks intentional per-project isolation for other tool calls. The remediation is messaging, not behavior change.
- **A task cleanup/GC retention policy.** No such policy exists today (verified by grep — no `delete(tasks)` anywhere). Do not build one speculatively per spec Excluded list.
- **Refactoring the runtime-vs-profile taxonomy.** Explicit spec Excluded.
- **Profile validation on `execute_task` args** (not on the stored task row). Already handled — `execute_task` validates `args.assignedAgent` via `isAgentRuntimeId` at `:252-256`; the gap is on the stored `task.agentProfile`, not on the tool's own args.
- **Smoke test against a running dev server.** `task-tools.ts` imports from `@/lib/agents/runtime/catalog` (pre-existing static) and this plan adds a new static import from `@/lib/agents/profiles/registry`. The registry file's import tree (`@/lib/validators/profile`, `./compatibility`, `./types`, `./project-profiles`, `@/lib/environment/data`, `@/lib/db`, `@/lib/db/schema`, `drizzle-orm`) does not transitively reach `runtime/catalog` or `claude-agent.ts`, so no cycle. Per TDR-032's smoke-test budget policy, this file does not meet the adjacency criteria. Unit tests are sufficient.

## Error & Rescue Registry

| Failure mode | Recovery |
|---|---|
| Zod `.refine()` attached to `z.string().optional()` receives `undefined` when field omitted and rejects it | Attach refinement to `z.string()` *before* `.optional()` — refinement only runs when the field is present. Pattern: `z.string().refine(fn, {...}).optional()`. |
| `getProfile()` returns `undefined` for a builtin ID because `ensureBuiltins()` hasn't been called yet | `getProfile` calls `ensureLoaded()` internally which calls `ensureBuiltins()`. First call is self-initializing. Tests mock `@/lib/agents/profiles/registry` directly so this concern doesn't apply to them. |
| Stale stored `task.agentProfile` from a pre-fix task with `"anthropic-direct"` breaks `execute_task` with a runtime-level error instead of a synchronous chat-tool error | `execute_task` handler calls `getProfile(task.agentProfile)` after the task lookup and before the queue-and-fire path. If `task.agentProfile !== null` and `getProfile(task.agentProfile) === undefined`, return `err(...)` synchronously. Do not update the task row (status transition is the caller's decision). |
| `list_tasks` note message leaks into clients that don't expect it | The note is a sibling field in the response envelope (`{tasks: [...], note: "..."}`), not an injected string. Only added when zero results AND a project filter is active, so existing happy-path consumers are untouched. |
| Test file collides with an existing test file | `ls src/lib/chat/tools/__tests__/` confirms `task-tools.test.ts` does not exist. Create fresh. |
| New static import of `@/lib/agents/profiles/registry` introduces a module-load cycle | Manually trace the registry file's imports against `runtime/catalog` and `claude-agent.ts`. Registry only imports: validators/profile, compatibility, types, project-profiles, environment/data, db, db/schema, drizzle-orm — none reach the runtime registry. Safe. If `tsc --noEmit` surfaces a new error after the change, stop and investigate before committing. |

---

## File Structure

Files modified:
- `src/lib/chat/tools/task-tools.ts` — three logical edits: (a) add `.refine()` to `create_task.agentProfile`, (b) add `.refine()` to `update_task.agentProfile`, (c) add synchronous stale-profile check in `execute_task` handler, (d) add empty-result note in `list_tasks` handler.
- `features/task-create-profile-validation.md` — append the spike addendum into the References section; flip frontmatter `status:` at the end.
- `features/roadmap.md` — flip the row status.
- `features/changelog.md` — prepend a completed entry under 2026-04-11.

Files created:
- `src/lib/chat/tools/__tests__/task-tools.test.ts` — fresh test file following the `schedule-tools.test.ts` pattern that just shipped in commit `ed783bb` / `649db6d`.

Files NOT touched (explicitly):
- `src/lib/agents/profiles/registry.ts` — read-only consumer
- `src/lib/agents/runtime/catalog.ts` — existing runtime validator, used but not modified
- `src/lib/agents/claude-agent.ts` or any runtime adapter — the `task.agentProfile ?? "general"` fallback is fine as-is; we add validation at the queue gate, not at the runtime
- `src/lib/db/schema.ts`, `src/lib/db/bootstrap.ts` — no schema change
- `src/lib/chat/tools/schedule-tools.ts` — same bug class but explicitly excluded
- Any UI file — chat/MCP tool access only

---

## Task 1: Spike addendum into the spec (docs-only, no code)

This commit lands first per the handoff rule "grooming separate from implementation." It is the written evidence that satisfies spec AC #3 ("The investigation spike documents the actual cause …") and corrects the handoff's false framing before any remediation code is merged.

**Files:**
- Modify: `features/task-create-profile-validation.md` (append addendum to References section)

- [ ] **Step 1.1: Append the spike addendum**

Open `features/task-create-profile-validation.md`. Find the References section, which currently ends with a placeholder line:

```markdown
- **Spike addendum (to be filled in by spike subtask):** _actual root cause + file:line evidence_
```

Replace that single line with the full addendum below. Do not remove any other lines in the References section.

```markdown
- **Spike addendum — 2026-04-11**

  A codebase walk performed in the controller session before any code changes ruled out the handoff's original "task was deleted" framing and identified two actual root-cause candidates for the reported disappearance symptom.

  **Ruled out: task deletion.**
  - No `db.delete(tasks)` anywhere in `src/` (grep confirmed; prior Explore pass had already established this).
  - Every failure path in `src/lib/agents/claude-agent.ts` preserves the row with `status: "failed"` and a `failureReason`:
    - `:130` — partial-update path annotating a mid-stream error
    - `:418-420` — stream-exhaustion safety net
    - `:745-748` — OAuth/auth failure (`failureReason: "auth_failed"`)
    - `:809-811` — generic handler via `classifyError`
  - `create_task` at `src/lib/chat/tools/task-tools.ts:110-126` is a single `db.insert()` with no transaction wrapper. The subsequent read-back at `:123-126` confirms the insert before returning, so a silently-failed insert would surface as an empty result at creation time, not post-creation.

  **Root cause 1 (probable primary — UX-level):** `list_tasks` silently filters by `ctx.projectId`.
  - `src/lib/chat/tools/task-tools.ts:41` computes `effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined`. If truthy, `:43-44` applies `eq(tasks.projectId, effectiveProjectId)` as a WHERE clause.
  - `get_task` at `:223-227` has no projectId filter — tasks are findable by ID regardless of active project scope.
  - Most likely user path: `create_task` under project A → `list_tasks` in a new session with `ctx.projectId = B` (or a different chat context) → empty result → perceived disappearance. The task is still in the DB and still findable by ID; the operator just does not know the filter is active.
  - **Remediation in this feature:** `list_tasks` returns a sibling `note` field in its response envelope when `effectiveProjectId` is set and zero rows are returned, naming the active scope and suggesting `projectId: null` or `get_task <id>` as alternatives. No behavior change, only messaging.

  **Root cause 2 (probable secondary — infrastructure-level):** `STAGENT_DATA_DIR` per-process isolation.
  - `src/lib/utils/ainative-paths.ts:4-6`: `getAinativeDataDir()` reads `process.env.STAGENT_DATA_DIR || ~/.ainative`.
  - `src/lib/db/index.ts:9-13`: the DB is opened from `join(dataDir, "ainative.db")` **once at module load**. The var is baked in per-process.
  - Per `MEMORY.md → shared-ainative-data-dir.md`, the user runs domain clones (`ainative-wealth`, `ainative-growth`, `ainative-venture`) which set this var to different paths. A task created in one process is physically in a different SQLite file than a task queried from another process. This is architecturally intentional — the three domain clones isolate state so wealth/growth/venture do not leak into each other.
  - **Remediation in this feature: none.** Per the Excluded list, domain-clone isolation changes are out of scope. A follow-up feature (outside this batch) could add an operator-facing startup log echoing the active data dir, or a `get_stagent_info` health-check tool. Not in this commit.

  **Ruled out: transaction rollback.** Not a transaction; single insert. If the insert fails, the error surfaces immediately at `create_task` return time.

  **Conclusion:** The profile validation gap (the primary spec ask) is unchanged in scope. The disappearance symptom is best addressed by the `list_tasks` empty-result note (added in this feature) plus operator-facing infrastructure discoverability (deferred). Failed-state preservation (AC #3) is verification-only — the code already does it correctly on every failure path identified.
```

- [ ] **Step 1.2: Verify the spec parses correctly**

Run `head -100 features/task-create-profile-validation.md` and confirm the YAML frontmatter is still valid (no trailing `---` issues, no mid-line breakage). Run `grep -c '^## ' features/task-create-profile-validation.md` — expected count: the same as before the edit (the addendum is a bullet inside the References section, not a new H2).

- [ ] **Step 1.3: Commit**

```bash
git add features/task-create-profile-validation.md
git commit -m "$(cat <<'EOF'
docs(features): add spike addendum for task disappearance symptom

Codebase walk confirmed the original handoff's "task was deleted"
framing is false — no db.delete(tasks) exists anywhere in src/, and
every failure path in claude-agent.ts preserves the row with
status: "failed" and a failureReason. create_task is not wrapped in
a transaction, so rollback is also ruled out.

The actual root cause is a two-layer UX + infrastructure issue.
Primary: list_tasks silently filters by ctx.projectId, so a task
created under project A is hidden when the user asks "list my tasks"
under project B — still findable by get_task <id> but perceived as
disappeared. Secondary: STAGENT_DATA_DIR per-process isolation means
different domain-clone processes hit different SQLite files; this is
intentional (MEMORY.md → shared-ainative-data-dir) and out of scope
for this feature.

Remediation in this feature is the list_tasks empty-result note
plus the profile validation gap that is the primary spec ask.
Operator-facing data-dir discoverability is deferred to a separate
feature.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit lands on `main`, `git status` clean. Verify with `git log --oneline -1`.

---

## Task 2: Profile validation (create_task, update_task, execute_task) + tests

**Files:**
- Modify: `src/lib/chat/tools/task-tools.ts`
- Create: `src/lib/chat/tools/__tests__/task-tools.test.ts`

### Code changes

- [ ] **Step 2.1: Add a new static import at the top of `task-tools.ts`**

After the existing imports from `@/lib/agents/runtime/catalog` (around line 11), add:

```ts
import { getProfile, listProfiles } from "@/lib/agents/profiles/registry";
```

Rationale: `getProfile` is synchronous and cached. A static import here does not cycle with the runtime registry — verified against the registry's own import tree. Do not use a dynamic `await import()` — that pattern is only required for files that sit inside the `runtime/catalog` load cycle, and `task-tools.ts` is a leaf consumer.

- [ ] **Step 2.2: Add a private helper for the validation refinement**

Near the top of the file (after the `VALID_TASK_STATUSES` constant around line 20), add:

```ts
/**
 * Zod refinement shared by create_task and update_task for the agentProfile
 * field. Returns true for valid registered profile IDs. The error message
 * lists a truncated sample of valid IDs from the registry so operators can
 * self-correct without cross-referencing docs.
 */
function isValidAgentProfile(id: string): boolean {
  return getProfile(id) !== undefined;
}

function agentProfileErrorMessage(invalid: string): string {
  const valid = listProfiles()
    .map((p) => p.id)
    .sort();
  const sample = valid.slice(0, 8).join(", ");
  const more = valid.length > 8 ? `, and ${valid.length - 8} more` : "";
  return `Invalid agentProfile "${invalid}". Valid profiles: ${sample}${more}. Run list_profiles (or inspect ~/.claude/skills/) to see the full set.`;
}
```

- [ ] **Step 2.3: Wire the refinement into `create_task.agentProfile`**

Replace the existing field at lines 91-96 (`agentProfile: z.string().optional().describe(...)`) with:

```ts
agentProfile: z
  .string()
  .refine(isValidAgentProfile, {
    message: "Invalid agentProfile (not in profile registry). See list_profiles.",
  })
  .optional()
  .describe(
    "Agent profile ID (e.g. general, code-reviewer, researcher). Validated against the profile registry."
  ),
```

**Important:** `.refine(...)` goes BEFORE `.optional()` so the refinement only runs when the field is present. Reversing the order makes Zod pass `undefined` into the refine callback, which the `isValidAgentProfile` helper would reject — breaking the "omit to use default" path.

The in-schema message is intentionally short because a long rendered string makes the tool description noisy. The richer error (with listed profile IDs) is produced by a post-parse check in the handler body (next step).

- [ ] **Step 2.4: Add a richer error path in the `create_task` handler body**

At the top of the `create_task` handler's `try` block (just after line 99, before the `assignedAgent` runtime check at `:100-104`), add:

```ts
if (args.agentProfile !== undefined && !isValidAgentProfile(args.agentProfile)) {
  return err(agentProfileErrorMessage(args.agentProfile));
}
```

This is belt-and-suspenders: the Zod refinement catches the bad value at parse time (giving the short message), and the handler body catches it again with the richer enumerated message if the parse layer is bypassed by a direct handler call. The test suite exercises the handler directly so this path matters for test assertions.

- [ ] **Step 2.5: Wire the same refinement into `update_task.agentProfile`**

Same pattern at lines 163-168:

```ts
agentProfile: z
  .string()
  .refine(isValidAgentProfile, {
    message: "Invalid agentProfile (not in profile registry). See list_profiles.",
  })
  .optional()
  .describe(
    "Agent profile ID (e.g. general, code-reviewer, researcher). Validated against the profile registry."
  ),
```

Add the same richer-error handler check at the top of the `update_task` try block (just before the existing `assignedAgent` check at `:172-176`):

```ts
if (args.agentProfile !== undefined && !isValidAgentProfile(args.agentProfile)) {
  return err(agentProfileErrorMessage(args.agentProfile));
}
```

- [ ] **Step 2.6: Add synchronous stale-profile check in `execute_task`**

In the `execute_task` handler body, after the task is fetched (just after line 264, where the `task` variable is available but before the `runtimeId` resolution at `:267`), add:

```ts
if (task.agentProfile && !isValidAgentProfile(task.agentProfile)) {
  return err(
    `Task ${args.taskId} has an invalid agentProfile "${task.agentProfile}" (not in profile registry). ` +
    `Fix with update_task { taskId, agentProfile: "<valid-id>" } before retrying. ${agentProfileErrorMessage(task.agentProfile).split(". ").slice(1).join(". ")}`
  );
}
```

Rationale: `task.agentProfile` may be `null` (acceptable — every runtime falls back to `"general"`). Only check when it is a non-null string. Do not mutate the task row; the caller decides whether to fix the profile or cancel the task.

- [ ] **Step 2.7: Add empty-result note to `list_tasks`**

This is the UX remediation for root cause #1 identified in the spike. In the `list_tasks` handler, replace the current `return ok(result);` at line 54 with:

```ts
if (result.length === 0 && effectiveProjectId) {
  return ok({
    tasks: [],
    note: `No tasks found in project ${effectiveProjectId}. ` +
      `Use projectId: null to list tasks from any project, ` +
      `or get_task <id> to look up a specific task directly.`,
  });
}
return ok(result);
```

**Important:** Do not change the happy-path return shape (`result` is an array). The note is only injected on the empty-with-filter path, wrapped in a new envelope shape. Clients that always read `result` as an array will still work on the happy path. The envelope change is localized to a known-empty case so existing happy-path consumers never see it.

- [ ] **Step 2.8: Type check**

`npx tsc --noEmit 2>&1 | tail -5; echo exit=$?`. Expected: `exit=0` or pre-existing-only errors (the known set from handoff: `claude-agent.test.ts:83, 408-410, 432, 669`; `chat-session-provider.test.tsx` module-not-found; `schedule-tools.ts` "await has no effect" spurious IDE diagnostics).

### Test file

- [ ] **Step 2.9: Create the test scaffold**

Create `src/lib/chat/tools/__tests__/task-tools.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
  agentProfile: string | null;
  assignedAgent: string | null;
  [key: string]: unknown;
}

const { mockState } = vi.hoisted(() => ({
  mockState: {
    rows: [] as TaskRow[],
    lastInsertValues: null as Record<string, unknown> | null,
    lastUpdateValues: null as Record<string, unknown> | null,
  },
}));

vi.mock("@/lib/db", () => {
  const selectBuilder = {
    from() { return this; },
    where() { return this; },
    orderBy() { return this; },
    limit() {
      return Promise.resolve(mockState.rows);
    },
    get() { return Promise.resolve(mockState.rows[0]); },
    then<TResolve>(resolve: (rows: TaskRow[]) => TResolve) {
      return Promise.resolve(mockState.rows).then(resolve);
    },
  };
  return {
    db: {
      select: () => selectBuilder,
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          mockState.lastInsertValues = v;
          mockState.rows = [{
            id: "task-1",
            title: "",
            status: "planned",
            projectId: null,
            agentProfile: null,
            assignedAgent: null,
            ...v,
          } as TaskRow];
          return Promise.resolve();
        },
      }),
      update: () => ({
        set: (v: Record<string, unknown>) => {
          mockState.lastUpdateValues = v;
          if (mockState.rows[0]) {
            mockState.rows[0] = { ...mockState.rows[0], ...v } as TaskRow;
          }
          return { where: () => Promise.resolve() };
        },
      }),
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  tasks: {
    id: "id",
    projectId: "projectId",
    status: "status",
    priority: "priority",
    createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  and: () => ({}),
  desc: () => ({}),
}));

// Mock the profile registry: accept "general" and "code-reviewer",
// reject everything else. listProfiles returns a small known set.
vi.mock("@/lib/agents/profiles/registry", () => {
  const validIds = new Set(["general", "code-reviewer", "researcher"]);
  return {
    getProfile: (id: string) =>
      validIds.has(id)
        ? { id, name: id, description: "test", tags: [], skillMd: "", allowedTools: [], mcpServers: {}, systemPrompt: "" }
        : undefined,
    listProfiles: () => Array.from(validIds).map((id) => ({ id, name: id })),
  };
});

// Mock the runtime catalog so isAgentRuntimeId is deterministic in tests.
vi.mock("@/lib/agents/runtime/catalog", () => ({
  DEFAULT_AGENT_RUNTIME: "claude",
  SUPPORTED_AGENT_RUNTIMES: ["claude", "anthropic-direct", "openai-direct"],
  isAgentRuntimeId: (id: string) => ["claude", "anthropic-direct", "openai-direct"].includes(id),
}));

// Mock the router so execute_task's dynamic import doesn't explode.
vi.mock("@/lib/agents/router", () => ({
  executeTaskWithAgent: () => Promise.resolve(),
}));

import { taskTools } from "../task-tools";

function getTool(name: string) {
  const tools = taskTools({ projectId: undefined } as never);
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

function parseArgs(toolName: string, args: unknown) {
  const tool = getTool(toolName);
  return z.object(tool.zodShape).safeParse(args);
}

function callHandler(toolName: string, args: unknown) {
  const tool = getTool(toolName);
  return tool.handler(args);
}

function getToolResultText(result: { content: Array<{ type: string; text: string }>; isError?: boolean }) {
  return result.content[0]?.text ?? "";
}

beforeEach(() => {
  mockState.rows = [];
  mockState.lastInsertValues = null;
  mockState.lastUpdateValues = null;
});
```

- [ ] **Step 2.10: Smoke-run the scaffold**

`npx vitest run src/lib/chat/tools/__tests__/task-tools.test.ts 2>&1 | tail -20`. Expected: "no tests found" or similar. If imports fail, extend mocks with whatever is missing. Do not change source code.

- [ ] **Step 2.11: Add `create_task` validation tests**

```ts
describe("create_task agentProfile Zod validation", () => {
  const base = { title: "test task" };

  it("accepts a valid profile id", () => {
    const result = parseArgs("create_task", { ...base, agentProfile: "general" });
    expect(result.success).toBe(true);
  });

  it("accepts another valid profile id", () => {
    const result = parseArgs("create_task", { ...base, agentProfile: "code-reviewer" });
    expect(result.success).toBe(true);
  });

  it("accepts omitted agentProfile", () => {
    const result = parseArgs("create_task", base);
    expect(result.success).toBe(true);
  });

  it("rejects a runtime id passed as agentProfile", () => {
    const result = parseArgs("create_task", { ...base, agentProfile: "anthropic-direct" });
    expect(result.success).toBe(false);
  });

  it("rejects an arbitrary invalid string", () => {
    const result = parseArgs("create_task", { ...base, agentProfile: "not-a-profile" });
    expect(result.success).toBe(false);
  });
});

describe("create_task handler-level error messages", () => {
  it("returns a descriptive error naming the invalid value and listing valid profile ids", async () => {
    const result = await callHandler("create_task", {
      title: "test task",
      agentProfile: "anthropic-direct",
    });
    expect(result.isError).toBe(true);
    const text = getToolResultText(result);
    expect(text).toContain("anthropic-direct");
    expect(text).toMatch(/code-reviewer|general|researcher/);
  });

  it("inserts a task when agentProfile is valid", async () => {
    const result = await callHandler("create_task", {
      title: "test task",
      agentProfile: "general",
    });
    expect(result.isError).toBeFalsy();
    expect(mockState.lastInsertValues?.agentProfile).toBe("general");
  });

  it("inserts with null agentProfile when omitted", async () => {
    await callHandler("create_task", { title: "test task" });
    expect(mockState.lastInsertValues?.agentProfile).toBe(null);
  });
});
```

- [ ] **Step 2.12: Add `update_task` validation tests**

```ts
describe("update_task agentProfile Zod validation", () => {
  const base = { taskId: "task-1" };

  it("accepts a valid profile id", () => {
    const result = parseArgs("update_task", { ...base, agentProfile: "researcher" });
    expect(result.success).toBe(true);
  });

  it("rejects a runtime id", () => {
    const result = parseArgs("update_task", { ...base, agentProfile: "anthropic-direct" });
    expect(result.success).toBe(false);
  });
});

describe("update_task handler-level agentProfile validation", () => {
  beforeEach(() => {
    mockState.rows = [{
      id: "task-1",
      title: "existing",
      status: "planned",
      projectId: null,
      agentProfile: null,
      assignedAgent: null,
    } as TaskRow];
  });

  it("returns a descriptive error when the new agentProfile is invalid", async () => {
    const result = await callHandler("update_task", {
      taskId: "task-1",
      agentProfile: "anthropic-direct",
    });
    expect(result.isError).toBe(true);
    expect(getToolResultText(result)).toContain("anthropic-direct");
  });

  it("updates when the new agentProfile is valid", async () => {
    const result = await callHandler("update_task", {
      taskId: "task-1",
      agentProfile: "code-reviewer",
    });
    expect(result.isError).toBeFalsy();
    expect(mockState.lastUpdateValues?.agentProfile).toBe("code-reviewer");
  });
});
```

- [ ] **Step 2.13: Add `execute_task` stale-profile tests**

```ts
describe("execute_task stale agentProfile surfacing", () => {
  it("returns synchronous error when the stored task.agentProfile is invalid", async () => {
    mockState.rows = [{
      id: "task-1",
      title: "stale task",
      status: "planned",
      projectId: null,
      agentProfile: "anthropic-direct", // invalid — a runtime id
      assignedAgent: null,
    } as TaskRow];

    const result = await callHandler("execute_task", { taskId: "task-1" });
    expect(result.isError).toBe(true);
    const text = getToolResultText(result);
    expect(text).toContain("anthropic-direct");
    expect(text).toContain("update_task");
  });

  it("queues execution when task.agentProfile is valid", async () => {
    mockState.rows = [{
      id: "task-1",
      title: "ok task",
      status: "planned",
      projectId: null,
      agentProfile: "general",
      assignedAgent: null,
    } as TaskRow];

    const result = await callHandler("execute_task", { taskId: "task-1" });
    expect(result.isError).toBeFalsy();
  });

  it("queues execution when task.agentProfile is null (runtime falls back to general)", async () => {
    mockState.rows = [{
      id: "task-1",
      title: "ok task",
      status: "planned",
      projectId: null,
      agentProfile: null,
      assignedAgent: null,
    } as TaskRow];

    const result = await callHandler("execute_task", { taskId: "task-1" });
    expect(result.isError).toBeFalsy();
  });
});
```

- [ ] **Step 2.14: Add `list_tasks` empty-result note tests**

```ts
describe("list_tasks empty-result note", () => {
  it("returns a note when a project filter is active and zero rows result", async () => {
    mockState.rows = [];
    const tool = getTool("list_tasks");
    // Invoke via a ctx that has a projectId, mimicking a scoped chat session.
    const tools = taskTools({ projectId: "proj-active" } as never);
    const list = tools.find((t) => t.name === "list_tasks")!;
    const result = await list.handler({});
    expect(result.isError).toBeFalsy();
    const text = getToolResultText(result);
    expect(text).toContain("proj-active");
    expect(text).toContain("projectId: null");
    // Also confirm the envelope shape: tasks is an empty array and note is present
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({ tasks: [], note: expect.stringContaining("proj-active") });
  });

  it("returns the plain array (no note) when a project filter is active and rows are returned", async () => {
    mockState.rows = [{
      id: "task-1",
      title: "existing",
      status: "planned",
      projectId: "proj-active",
      agentProfile: null,
      assignedAgent: null,
    } as TaskRow];

    const tools = taskTools({ projectId: "proj-active" } as never);
    const list = tools.find((t) => t.name === "list_tasks")!;
    const result = await list.handler({});
    const parsed = JSON.parse(getToolResultText(result));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it("returns the plain array (no note) when no filter is active and zero rows result", async () => {
    mockState.rows = [];
    const tools = taskTools({ projectId: undefined } as never);
    const list = tools.find((t) => t.name === "list_tasks")!;
    const result = await list.handler({});
    const parsed = JSON.parse(getToolResultText(result));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });
});
```

**Note for the implementer:** the `ok()` helper returns `{ content: [{ type: "text", text: JSON.stringify(payload) }] }`. Confirm by reading `src/lib/chat/tools/helpers.ts` before running the tests. If the payload is stored differently, adjust the `getToolResultText` helper and the `JSON.parse` calls accordingly.

- [ ] **Step 2.15: Add `get_task` AC #4 regression test**

```ts
describe("get_task AC #4: failed tasks remain findable", () => {
  it("finds a task regardless of status (including failed)", async () => {
    mockState.rows = [{
      id: "task-1",
      title: "a failed task",
      status: "failed",
      projectId: "proj-other",
      agentProfile: null,
      assignedAgent: null,
    } as TaskRow];

    const result = await callHandler("get_task", { taskId: "task-1" });
    expect(result.isError).toBeFalsy();
    const text = getToolResultText(result);
    expect(text).toContain("task-1");
    expect(text).toContain("failed");
  });

  it("does not apply a project filter (returns the task even when stored under a different project)", async () => {
    mockState.rows = [{
      id: "task-1",
      title: "cross-project task",
      status: "completed",
      projectId: "proj-A",
      agentProfile: null,
      assignedAgent: null,
    } as TaskRow];

    // Call with a ctx that has projectId = B — get_task should still find it.
    const tools = taskTools({ projectId: "proj-B" } as never);
    const tool = tools.find((t) => t.name === "get_task")!;
    const result = await tool.handler({ taskId: "task-1" });
    expect(result.isError).toBeFalsy();
  });
});
```

- [ ] **Step 2.16: Run the full test file and verify all pass**

`npx vitest run src/lib/chat/tools/__tests__/task-tools.test.ts 2>&1 | tail -40`

Expected: all tests pass. Typical count: 5 (create Zod) + 3 (create handler) + 2 (update Zod) + 2 (update handler) + 3 (execute stale) + 3 (list_tasks note) + 2 (get_task AC#4) = 20 tests.

If a test fails on an unexpected mock shape, extend the mock rather than changing source code. Common sources of friction: the `ok()` helper's actual text format (read `helpers.ts` to confirm), the drizzle `update().set().where()` chain shape, and whether `list_tasks` uses `.limit(50)` on its builder chain (if so, the `limit` stub needs to return the rows, which it already does).

- [ ] **Step 2.17: Regression sanity — adjacent tests still pass**

`npx vitest run src/lib/chat/tools/__tests__/ 2>&1 | tail -20`. Expected: task-tools + schedule-tools + workflow-tools-dedup + enrich-table-tool all green.

- [ ] **Step 2.18: Type check**

`npx tsc --noEmit 2>&1 | tail -5; echo exit=$?`. Expected: exit 0 or pre-existing-only.

- [ ] **Step 2.19: Verify diff scope**

`git status` should show:
- Modified: `src/lib/chat/tools/task-tools.ts`
- New: `src/lib/chat/tools/__tests__/task-tools.test.ts`

And nothing else.

- [ ] **Step 2.20: Commit**

```bash
git add src/lib/chat/tools/task-tools.ts src/lib/chat/tools/__tests__/task-tools.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): validate agentProfile against profile registry

create_task and update_task previously accepted any string as
agentProfile, including runtime ids like "anthropic-direct" that are
guaranteed to fail at execution time with no feedback at creation
time. Both tools now run a Zod .refine() against the profile registry
and the handler body also returns a richer error enumerating the
valid profile ids so operators can self-correct without reading docs.

execute_task now also runs a synchronous stale-profile check on the
stored task.agentProfile before queuing — this catches tasks created
before this fix (or via a direct DB write) that carry invalid profile
values, surfacing the error in the immediate chat-tool response
instead of letting them fail later at runtime.

list_tasks now returns a sibling "note" field in its response
envelope when a project filter is active and the result is empty,
explaining that tasks may exist in other projects and suggesting
projectId: null or get_task as alternatives. This addresses the
most probable root cause of the originally-reported "task disappears
after creation" symptom, which the spike addendum documented in the
preceding commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

Verify: `git log --oneline -3`.

---

## Task 3: Flip to completed + roadmap + changelog

**Files:**
- Modify: `features/task-create-profile-validation.md` (frontmatter only)
- Modify: `features/roadmap.md`
- Modify: `features/changelog.md`

- [ ] **Step 3.1: Flip spec frontmatter**

In `features/task-create-profile-validation.md`, change `status: planned` to `status: completed` in the YAML frontmatter.

- [ ] **Step 3.2: Update roadmap row**

In `features/roadmap.md`, find the row for `task-create-profile-validation` and change its Status column from `planned` to `completed`.

- [ ] **Step 3.3: Prepend changelog entry**

In `features/changelog.md`, under the existing `## 2026-04-11` section, add a `### Completed — task-create-profile-validation (P1)` subsection above the existing `### Completed — schedule-maxturns-api-control (P2)` entry. Content:

```markdown
### Completed — task-create-profile-validation (P1)

Closed the profile validation gap at `create_task` and `update_task` — both previously accepted any string as `agentProfile`, including runtime ids like `"anthropic-direct"` that are guaranteed to fail at execution time. Both tools now run a Zod `.refine()` against the profile registry via the new shared `isValidAgentProfile` helper, and the handler body returns a richer enumerated error so operators can self-correct without reading docs.

`execute_task` now runs a synchronous stale-profile check on the stored `task.agentProfile` before queuing, surfacing the error in the immediate chat-tool response instead of letting it fail later at runtime. `list_tasks` now returns a sibling `note` field on empty-result-with-active-filter responses, addressing the most probable UX-level root cause of the original "task disappears after creation" symptom the spike addendum documented.

**Spike conclusion:** The original handoff's "task was deleted" framing was false — no `db.delete(tasks)` exists anywhere in `src/`, and every failure path in `claude-agent.ts` preserves the row with `status: "failed"` and a `failureReason`. Real root causes are (1) `list_tasks` silent project-scoping by `ctx.projectId` (fixed in this feature via the empty-result note) and (2) `STAGENT_DATA_DIR` per-process domain-clone isolation (intentional per `MEMORY.md → shared-ainative-data-dir.md`, remediation deferred to a separate feature).

**Commits:**
- `<SHA-task1>` — `docs(features): add spike addendum for task disappearance symptom`
- `<SHA-task2>` — `feat(chat): validate agentProfile against profile registry`

**Verification:**
- `npx vitest run src/lib/chat/tools/__tests__/task-tools.test.ts` → 20/20 passing
- Adjacent `src/lib/chat/tools/__tests__/` suite → all green (task-tools + schedule-tools + workflow-tools-dedup + enrich-table-tool)
- `npx tsc --noEmit` → exit 0 or pre-existing-only
- No smoke test required — `task-tools.ts` is a leaf consumer of `profiles/registry.ts`, no runtime-registry adjacency per TDR-032.
```

Replace `<SHA-task1>` and `<SHA-task2>` with the actual commit SHAs from `git log --oneline -5` before committing.

- [ ] **Step 3.4: Ship verification walk-through**

Walk through the spec's Acceptance Criteria and confirm:

1. `create_task` rejects invalid `agentProfile` values with descriptive error — Step 2.3, Step 2.4, tests Step 2.11
2. New test in `task-tools.test.ts` asserts `create_task` rejects `"anthropic-direct"` — test Step 2.11 `"rejects a runtime id passed as agentProfile"`
3. Spike documents actual cause before code — Task 1 commit lands first
4. No task from `create_task` is unfindable via `get_task` — tests Step 2.15 (existing `get_task` behavior verified unchanged; no project filter)
5. `execute_task` surfaces validation/profile errors synchronously — Step 2.6, tests Step 2.13
6. Existing task-tools tests still pass — Step 2.17 adjacent regression check
7. List_tasks note documenting the project-scoping root cause fix — Step 2.7, tests Step 2.14

- [ ] **Step 3.5: Commit the flip**

```bash
git add features/task-create-profile-validation.md features/roadmap.md features/changelog.md
git commit -m "$(cat <<'EOF'
docs(features): flip task-create-profile-validation to completed

create_task and update_task now validate agentProfile against the
profile registry, execute_task surfaces stale-profile errors
synchronously, and list_tasks explains the active project scope
when a filter yields zero rows. Ship-verified against all 6 spec
acceptance criteria including the spike documentation requirement.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3.6: Push all three commits as a stack**

```bash
git push origin main
```

Expected: three commits pushed — the spike addendum, the feature commit, and the flip commit (plus this plan file if we commit it). No hook failures. Verify with `git log --oneline origin/main..HEAD` (should be empty after push).

---

## Verification before declaring done

- [ ] `npx vitest run src/lib/chat/tools/__tests__/task-tools.test.ts` → ~20 tests green
- [ ] Adjacent `src/lib/chat/tools/__tests__/` suite → all green
- [ ] `npx tsc --noEmit` → exit 0 or pre-existing-only
- [ ] `git log --oneline origin/main..HEAD` → empty (remote in sync)
- [ ] Spec frontmatter matches roadmap row matches changelog entry (all three say "completed")
- [ ] The spike addendum is present in the spec's References section with file:line citations
- [ ] `list_tasks` note only appears on empty-with-filter path, not happy path
- [ ] No changes to `schema.ts`, `bootstrap.ts`, `claude-agent.ts`, `runtime/`, or any UI file

## Self-review notes

- The `.refine()` order (`.refine().optional()` not `.optional().refine()`) is load-bearing. If an implementer reverses it, the handler receives `undefined` through the refine callback and the omit-to-default path breaks. Test Step 2.11 "accepts omitted agentProfile" will catch this.
- The handler-body richer-error check is intentionally redundant with the Zod refinement. The Zod layer fires for callers that go through `tool-registry`'s validation wrapper; the handler layer fires for direct handler calls (including all tests in this file). Both paths must return the richer enumerated message.
- The `execute_task` check uses `task.agentProfile && !isValidAgentProfile(...)` — short-circuits on `null`, which is the valid "use runtime default" state. Do not change to `task.agentProfile !== null` or similar without re-reading the every-runtime `?? "general"` fallback pattern.
- The `list_tasks` envelope change is **only** on the empty-with-filter branch. Happy-path callers reading `result.tasks[0]` will break; happy-path callers reading `result[0]` will work. The current happy-path return is a raw array, so we keep that shape.
- The plan file (`docs/superpowers/plans/2026-04-11-task-create-profile-validation.md`) is committed separately as a `docs(plan)` commit before the spike-addendum commit, matching the precedent from Task 2 (commit `484c2ea`). Controller handles this — not the implementer.
