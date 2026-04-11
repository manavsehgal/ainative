# Schedule maxTurns API Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing `schedules.maxTurns` column on the `create_schedule` and `update_schedule` MCP tool input schemas so operators can tune per-schedule turn budgets via chat instead of editing the DB by hand.

**Architecture:** Two Zod input-schema additions (one append to `create_schedule`, one `.optional().nullable()` field on `update_schedule`) plus a single `maxTurns: args.maxTurns ?? null` line in the insert payload. `get_schedule` already echoes the column because it does `db.select().from(schedules)` which returns every column on the row — verified, no change there. The scheduler-side plumbing (`scheduler.ts:284`, `:535`) and DB column (`schema.ts:237-239`) already exist.

**Tech Stack:** TypeScript, Zod, Drizzle ORM (SQLite), Vitest.

---

## What already exists

Confirmed by reading the current codebase (not trusting the spec's line numbers blindly):

| What | Where | Evidence |
|---|---|---|
| `maxTurns` column on `schedules` table | `src/lib/db/schema.ts:237-239` | `maxTurns: integer("max_turns")` with doc comment "NULL inherits the global MAX_TURNS setting" |
| Scheduler handoff schedule→task at firing time | `src/lib/schedules/scheduler.ts:535` | (unverified by this plan — spec asserts it, and nothing in this plan touches it) |
| Firing metrics capture `maxTurnsAtFiring` | `src/lib/schedules/scheduler.ts:284` | (same — don't touch) |
| `get_schedule` returns full row | `src/lib/chat/tools/schedule-tools.ts:186-191` | `db.select().from(schedules).where(eq(schedules.id, ...))` — returns every column, including any we add downstream. No schema change needed on read. |
| `create_schedule` input Zod schema | `src/lib/chat/tools/schedule-tools.ts:49-72` | Current fields: `name`, `prompt`, `interval`, `projectId`, `assignedAgent`, `agentProfile`, `maxFirings`, `expiresInHours`. Insert payload at `:139-155` uses `args.maxFirings ?? null` pattern — we mirror that for `maxTurns`. |
| `update_schedule` input Zod schema | `src/lib/chat/tools/schedule-tools.ts:205-219` | Uses conditional-set pattern `if (args.X !== undefined) updates.X = args.X` at `:230-235`. No existing field in this file currently supports explicit-null-to-clear; we introduce the pattern via `.optional().nullable()` on `maxTurns`. |
| `defineTool` factory used by all chat tools | `src/lib/chat/tool-registry.ts:42-52` | Returns `{name, description, zodShape, inputSchema, handler}`. Tests can look up a tool by name and invoke `tool.handler(args)` directly after validating with `z.object(tool.zodShape).safeParse(args)`. |
| Test pattern for mocking `@/lib/db` + `drizzle-orm` | `src/lib/chat/tools/__tests__/workflow-tools-dedup.test.ts:10-54` | Uses `vi.hoisted` + thenable query-builder stub. We can reuse the same shape, extending it with `.insert()` and `.update()` spy methods. |

## NOT in scope

- **`maxRunDurationSec` parallel control** (column at `schema.ts:241`). Same shape of problem, but explicitly out per spec's Scope Boundaries. File separately if wanted.
- **UI surface changes** in `src/components/schedules/`. Spec says "chat-tool access only for now."
- **Global-default admin setting overrides.** Spec Scope Boundaries.
- **Migrating historical schedules with `maxTurns: null`.** Spec Scope Boundaries — nulls fall back to system default by design.
- **Changing the system default `MAX_TURNS`.** Out of scope.
- **Smoke test against a running dev server.** Not required per TDR-032 / writing-plans override — this file is pure Zod schema additions, no static imports change, no runtime-registry adjacency. Unit tests are sufficient.

## Error & Rescue Registry

| Failure mode | Recovery |
|---|---|
| Zod accepts out-of-range value (10 > N or N > 500) | `.min(10).max(500)` in the Zod field. Unit test asserts rejection at 9 and 501. |
| Operator passes `maxTurns: null` on update and the DB write silently drops it | The `.optional().nullable()` Zod schema permits `null`. The conditional-set pattern `if (args.maxTurns !== undefined) updates.maxTurns = args.maxTurns` then writes an explicit `null`. Unit test asserts `updates.maxTurns === null` after a clear-to-null call. |
| Operator omits `maxTurns` on update and the existing value gets clobbered to null | Same conditional-set pattern — `args.maxTurns` is `undefined` (not `null`), the `!== undefined` guard skips the write, existing value untouched. Unit test asserts `updates.maxTurns` is not set when the field is omitted. |
| Test file creation collides with existing test file | `ls src/lib/chat/tools/__tests__/` confirms `schedule-tools.test.ts` does not exist. Create fresh. |
| Zod `.nullable()` interacts unexpectedly with `.optional()` | Both must be present. `.optional()` alone: undefined OK, null rejected. `.nullable()` alone: null OK, undefined required. `.optional().nullable()`: both undefined and null are valid. The persistence test for clear-to-null catches this. |

---

## File Structure

Files modified:

- `src/lib/chat/tools/schedule-tools.ts` — add `maxTurns` to two Zod schemas, add one line to the create insert payload.

Files created:

- `src/lib/chat/tools/__tests__/schedule-tools.test.ts` — fresh test file with Zod-validation tests (no DB mock needed) + persistence tests (mocked DB, mocked drizzle operators, mocked dynamic imports).

Files NOT touched (explicitly):

- `src/lib/db/schema.ts` — column already exists
- `src/lib/db/bootstrap.ts` — column already exists in the schedules CREATE TABLE
- `src/lib/schedules/scheduler.ts` — handoff already plumbed
- Any component under `src/components/schedules/` — UI is out of scope
- `features/roadmap.md`, `features/changelog.md`, `features/schedule-maxturns-api-control.md` frontmatter — handled in the separate flip-to-completed commit per handoff rule #8

---

## Task 1: Zod schema additions + insert payload wiring

**Files:**
- Modify: `src/lib/chat/tools/schedule-tools.ts` (three small edits)

- [ ] **Step 1.1: Add `maxTurns` to `create_schedule` Zod input**

In `src/lib/chat/tools/schedule-tools.ts` at the existing `create_schedule` input schema (currently ends at line 72 with `expiresInHours`), append:

```ts
maxTurns: z
  .number()
  .int()
  .min(10)
  .max(500)
  .optional()
  .describe("Hard cap on turns per firing (10-500). Omit to inherit the system default."),
```

Place it immediately after the `expiresInHours` field so the create and update schemas stay structurally parallel.

- [ ] **Step 1.2: Add `maxTurns` to `update_schedule` Zod input**

Same file, at the existing `update_schedule` input schema (currently ends at line 218 with `agentProfile`), append:

```ts
maxTurns: z
  .number()
  .int()
  .min(10)
  .max(500)
  .optional()
  .nullable()
  .describe("Hard cap on turns per firing (10-500). Pass null to clear an override back to the system default."),
```

The `.nullable()` is load-bearing — without it, Zod rejects explicit `null` from the client. With it, `undefined` still means "field not provided, don't touch" and `null` means "clear to inherit default."

- [ ] **Step 1.3: Thread `maxTurns` into the insert values in `create_schedule`**

In the `db.insert(schedules).values({...})` call (currently lines 139-155), add a single line alongside the existing `maxFirings: args.maxFirings ?? null`:

```ts
maxTurns: args.maxTurns ?? null,
```

Do not change anything else in that call. Do not reorder fields.

- [ ] **Step 1.4: Thread `maxTurns` into the conditional-set block in `update_schedule`**

In the `updates` construction (currently lines 230-235, right after `if (args.agentProfile !== undefined) updates.agentProfile = args.agentProfile;`), add:

```ts
if (args.maxTurns !== undefined) updates.maxTurns = args.maxTurns;
```

The `!== undefined` check is deliberate — it distinguishes "field omitted" (undefined, skip) from "explicit clear" (null, write). Do not collapse this to a truthy check.

- [ ] **Step 1.5: Type check**

Run: `npx tsc --noEmit 2>&1 | tail -5; echo exit=$?`

Expected: `exit=0`, or if there are pre-existing errors they should be at the handoff-documented lines (`task-file lines 83/407-410/431/668/669`) and completely unrelated to `schedule-tools.ts`.

---

## Task 2: Unit tests

**Files:**
- Create: `src/lib/chat/tools/__tests__/schedule-tools.test.ts`

- [ ] **Step 2.1: Write the test scaffold with mocks**

Create `src/lib/chat/tools/__tests__/schedule-tools.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

interface ScheduleRow {
  id: string;
  maxTurns: number | null;
  [key: string]: unknown;
}

const { mockState } = vi.hoisted(() => ({
  mockState: {
    rows: [] as ScheduleRow[],
    lastInsertValues: null as Record<string, unknown> | null,
    lastUpdateValues: null as Record<string, unknown> | null,
  },
}));

// Minimal drizzle query builder — supports select/insert/update chains
// used by schedule-tools.ts. Insert + update calls record their payloads
// into mockState for assertions.
vi.mock("@/lib/db", () => {
  const selectBuilder = {
    from() { return this; },
    where() { return this; },
    orderBy() { return this; },
    limit() { return this; },
    get() { return Promise.resolve(mockState.rows[0]); },
    then<TResolve>(resolve: (rows: ScheduleRow[]) => TResolve) {
      return Promise.resolve(mockState.rows).then(resolve);
    },
  };
  return {
    db: {
      select: () => selectBuilder,
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          mockState.lastInsertValues = v;
          mockState.rows = [{ id: "sched-1", maxTurns: null, ...v } as ScheduleRow];
          return Promise.resolve();
        },
      }),
      update: () => ({
        set: (v: Record<string, unknown>) => {
          mockState.lastUpdateValues = v;
          mockState.rows[0] = { ...mockState.rows[0], ...v } as ScheduleRow;
          return { where: () => Promise.resolve() };
        },
      }),
      delete: () => ({ where: () => Promise.resolve() }),
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  schedules: {
    id: "id",
    status: "status",
    projectId: "projectId",
    updatedAt: "updatedAt",
    cronExpression: "cronExpression",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  and: () => ({}),
  desc: () => ({}),
}));

// Dynamic imports inside the tool handlers — mock each.
vi.mock("@/lib/schedules/interval-parser", () => ({
  parseInterval: () => "*/30 * * * *",
  computeNextFireTime: () => new Date("2026-04-11T10:00:00Z"),
  computeStaggeredCron: (cron: string) => ({
    cronExpression: cron,
    offsetApplied: 0,
    collided: false,
  }),
}));

vi.mock("@/lib/schedules/nlp-parser", () => ({
  parseNaturalLanguage: () => null,
}));

vi.mock("@/lib/schedules/prompt-analyzer", () => ({
  analyzePromptEfficiency: () => [],
}));

import { scheduleTools } from "../schedule-tools";

function getTool(name: string) {
  const tools = scheduleTools({ projectId: "proj-1" } as never);
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  return tool;
}

function parseArgs(toolName: string, args: unknown) {
  const tool = getTool(toolName);
  return z.object(tool.zodShape).safeParse(args);
}

beforeEach(() => {
  mockState.rows = [];
  mockState.lastInsertValues = null;
  mockState.lastUpdateValues = null;
});
```

- [ ] **Step 2.2: Run the scaffold to confirm mocks resolve**

Run: `npx vitest run src/lib/chat/tools/__tests__/schedule-tools.test.ts 2>&1 | tail -20`

Expected: "No test found in file" or similar — this confirms the file compiles and imports resolve. If it fails on an import error, fix the mocks before adding tests.

- [ ] **Step 2.3: Add Zod range-validation tests**

Append these describe block:

```ts
describe("create_schedule maxTurns Zod validation", () => {
  const base = {
    name: "test",
    prompt: "hello",
    interval: "every 30 minutes",
  };

  it("accepts a valid maxTurns value", () => {
    const result = parseArgs("create_schedule", { ...base, maxTurns: 50 });
    expect(result.success).toBe(true);
  });

  it("accepts omitted maxTurns (inherit default)", () => {
    const result = parseArgs("create_schedule", base);
    expect(result.success).toBe(true);
  });

  it("rejects maxTurns below 10", () => {
    const result = parseArgs("create_schedule", { ...base, maxTurns: 9 });
    expect(result.success).toBe(false);
  });

  it("rejects maxTurns above 500", () => {
    const result = parseArgs("create_schedule", { ...base, maxTurns: 501 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer maxTurns", () => {
    const result = parseArgs("create_schedule", { ...base, maxTurns: 50.5 });
    expect(result.success).toBe(false);
  });

  it("rejects explicit null on create (only update supports clear-to-null)", () => {
    const result = parseArgs("create_schedule", { ...base, maxTurns: null });
    expect(result.success).toBe(false);
  });
});

describe("update_schedule maxTurns Zod validation", () => {
  const base = { scheduleId: "sched-1" };

  it("accepts a valid maxTurns value", () => {
    const result = parseArgs("update_schedule", { ...base, maxTurns: 100 });
    expect(result.success).toBe(true);
  });

  it("accepts explicit null to clear an override", () => {
    const result = parseArgs("update_schedule", { ...base, maxTurns: null });
    expect(result.success).toBe(true);
  });

  it("accepts omitted maxTurns (unchanged)", () => {
    const result = parseArgs("update_schedule", base);
    expect(result.success).toBe(true);
  });

  it("rejects out-of-range maxTurns on update", () => {
    const result = parseArgs("update_schedule", { ...base, maxTurns: 9 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2.4: Run validation tests and verify they pass**

Run: `npx vitest run src/lib/chat/tools/__tests__/schedule-tools.test.ts 2>&1 | tail -20`

Expected: All tests in both describe blocks pass. If "rejects explicit null on create" fails, the `create_schedule` schema accidentally has `.nullable()` — remove it.

- [ ] **Step 2.5: Add persistence tests for create-with-value**

Append:

```ts
describe("create_schedule maxTurns persistence", () => {
  it("writes maxTurns to the insert payload when provided", async () => {
    const tool = getTool("create_schedule");
    await tool.handler({
      name: "test",
      prompt: "hello",
      interval: "every 30 minutes",
      maxTurns: 75,
    });
    expect(mockState.lastInsertValues).not.toBeNull();
    expect(mockState.lastInsertValues?.maxTurns).toBe(75);
  });

  it("writes null to maxTurns when omitted (inherit default)", async () => {
    const tool = getTool("create_schedule");
    await tool.handler({
      name: "test",
      prompt: "hello",
      interval: "every 30 minutes",
    });
    expect(mockState.lastInsertValues?.maxTurns).toBe(null);
  });
});
```

- [ ] **Step 2.6: Add persistence tests for update-to-new-value and clear-to-null**

Append:

```ts
describe("update_schedule maxTurns persistence", () => {
  beforeEach(() => {
    // Seed an existing schedule row for the "get existing" path.
    mockState.rows = [{
      id: "sched-1",
      name: "existing",
      status: "active",
      maxTurns: 50,
    } as ScheduleRow];
  });

  it("writes the new maxTurns value when provided", async () => {
    const tool = getTool("update_schedule");
    await tool.handler({ scheduleId: "sched-1", maxTurns: 120 });
    expect(mockState.lastUpdateValues?.maxTurns).toBe(120);
  });

  it("writes null when explicitly clearing the override", async () => {
    const tool = getTool("update_schedule");
    await tool.handler({ scheduleId: "sched-1", maxTurns: null });
    expect(mockState.lastUpdateValues).not.toBeNull();
    expect("maxTurns" in (mockState.lastUpdateValues ?? {})).toBe(true);
    expect(mockState.lastUpdateValues?.maxTurns).toBe(null);
  });

  it("does not touch maxTurns when the field is omitted", async () => {
    const tool = getTool("update_schedule");
    await tool.handler({ scheduleId: "sched-1", name: "renamed" });
    expect("maxTurns" in (mockState.lastUpdateValues ?? {})).toBe(false);
  });
});
```

- [ ] **Step 2.7: Run all tests and verify they pass**

Run: `npx vitest run src/lib/chat/tools/__tests__/schedule-tools.test.ts 2>&1 | tail -30`

Expected: Every test passes. Typical count: 6 (create validation) + 4 (update validation) + 2 (create persistence) + 3 (update persistence) = 15 tests.

If any persistence test fails because a dynamic import (interval-parser, nlp-parser, prompt-analyzer) returns an unexpected shape, extend the corresponding mock with whatever additional exports the handler touches. Do not change the handler.

- [ ] **Step 2.8: Type check again**

Run: `npx tsc --noEmit 2>&1 | tail -5; echo exit=$?`

Expected: `exit=0` or pre-existing errors only (see Task 1 Step 1.5).

- [ ] **Step 2.9: Run a wider sanity test to catch accidental regressions in neighboring files**

Run: `npx vitest run src/lib/chat/tools/__tests__/ 2>&1 | tail -15`

Expected: `schedule-tools.test.ts`, `enrich-table-tool.test.ts`, and `workflow-tools-dedup.test.ts` all pass. If enrich-table or workflow-tools-dedup breaks, something structural happened — stop and investigate before committing.

---

## Task 3: Commit

- [ ] **Step 3.1: Stage the two files and verify the diff**

Run: `git status && git diff --stat src/lib/chat/tools/schedule-tools.ts src/lib/chat/tools/__tests__/schedule-tools.test.ts`

Expected: Exactly two files changed — `schedule-tools.ts` (modified) and `schedule-tools.test.ts` (new). No other files touched.

- [ ] **Step 3.2: Commit**

```bash
git add src/lib/chat/tools/schedule-tools.ts src/lib/chat/tools/__tests__/schedule-tools.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): expose schedules.maxTurns on create/update MCP schemas

The schedules.maxTurns column, scheduler handoff, and firing metrics
already exist — only the chat-tool input schemas were missing, so
operators had no way to tune per-schedule turn budgets without direct
DB access.

Adds maxTurns (10-500, optional) to create_schedule and the same
field with .nullable() to update_schedule, so an explicit null clears
an override back to the system default. get_schedule already echoes
the column because it returns the full row.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3.3: Verify commit landed**

Run: `git log --oneline -3`

Expected: The new commit is HEAD. `git status` is clean.

---

## Task 4: Flip to completed + roadmap + changelog

This is a **separate commit** per handoff rule #8, not folded into Task 3.

- [ ] **Step 4.1: Update spec frontmatter**

In `features/schedule-maxturns-api-control.md`, change the frontmatter:

```yaml
status: planned
```

to:

```yaml
status: completed
```

- [ ] **Step 4.2: Update roadmap row**

In `features/roadmap.md`, find the row for `schedule-maxturns-api-control` (likely under a Platform Hardening or post-MVP section) and flip its `Status` column from `planned` to `completed`. If the row is absent, add it in the right section.

- [ ] **Step 4.3: Prepend a changelog entry**

In `features/changelog.md`, under today's date section (`## 2026-04-11`), add under a `### Completed` subsection (create if absent):

```markdown
- `schedule-maxturns-api-control` — exposed per-schedule maxTurns (10-500, clear-to-null) on create_schedule / update_schedule MCP tools. 15 unit tests covering Zod validation + persistence paths.
```

If a `## 2026-04-11` section does not yet exist, create it at the top above the previous date.

- [ ] **Step 4.4: Ship verification**

Walk through the spec's Acceptance Criteria checklist and confirm each one has a concrete implementation or test:

- [ ] `create_schedule` accepts optional `maxTurns` (10-500) — Task 1 Step 1.1 + test Step 2.3
- [ ] `update_schedule` accepts same field, supports explicit null — Task 1 Step 1.2 + tests Step 2.3 + 2.6
- [ ] `get_schedule` reflects the user-set value — confirmed in "What already exists" above (no code change needed; it selects the full row)
- [ ] Scheduler threads maxTurns from schedule to task — pre-existing, not touched
- [ ] Null/unset falls back to system default — pre-existing behavior unchanged
- [ ] Out-of-range values rejected with Zod error — test Step 2.3
- [ ] Unit test covers create-with-value, update-to-new-value, clear-to-null — tests Step 2.5 + 2.6

- [ ] **Step 4.5: Commit the flip**

```bash
git add features/schedule-maxturns-api-control.md features/roadmap.md features/changelog.md
git commit -m "$(cat <<'EOF'
docs(features): flip schedule-maxturns-api-control to completed

Chat-tool schemas for create_schedule / update_schedule now expose
the existing maxTurns column. Ship-verified against all 7 acceptance
criteria — the surface was two Zod field additions plus one insert
payload line.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4.6: Push both commits**

Run: `git push origin main`

Expected: Two commits pushed, no hook failures. If a hook fails, **do not retry with `--no-verify`** — diagnose, fix, and push again.

- [ ] **Step 4.7: Verify remote is in sync**

Run: `git log --oneline origin/main..HEAD`

Expected: Empty output (local and remote match).

---

## Verification before declaring done

- [ ] `npx vitest run src/lib/chat/tools/__tests__/schedule-tools.test.ts` — all ~15 tests green
- [ ] `npx tsc --noEmit` — exit 0 or pre-existing-errors-only
- [ ] `git log --oneline -3` shows both new commits
- [ ] `git status` is clean
- [ ] Spec frontmatter matches roadmap row matches changelog entry (all three say "completed" for this feature under 2026-04-11)
- [ ] No changes landed in `src/lib/db/schema.ts`, `src/lib/db/bootstrap.ts`, `src/lib/schedules/scheduler.ts`, or any UI file

## Self-review notes

- The `update_schedule` `.optional().nullable()` pattern is new for this file. Worth flagging in the code review that it's a deliberate introduction, not a typo.
- The test file uses a simpler query-builder stub than `workflow-tools-dedup.test.ts` because the create/update handlers don't need `.limit()` / `.orderBy()`. If the test fails because the handler chains an unexpected method, add a passthrough on the builder.
- If the handler's dynamic import of `@/lib/schedules/interval-parser` calls an export we haven't mocked (e.g. some helper other than `parseInterval` / `computeNextFireTime` / `computeStaggeredCron`), add it to the mock with a minimal stub.
- **Do not** add `maxTurns` persistence tests that require the scheduler to actually fire — that's integration scope and the spec explicitly leaves the scheduler-side code untouched (regression by existing scheduler tests).
