# Row-trigger blueprint execution — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the manifest's `blueprints[].trigger.kind: "row-insert"` field through the workflow engine so blueprints actually fire when rows arrive at user-tables, with `tasks.contextRowId` populated so the Phase 4 Inbox UI can attribute drafts to specific rows.

**Architecture:** Parallel hook (`evaluateManifestTriggers`) called from `addRows` alongside the existing `evaluateTriggers`. Reads cached `listApps()`, filters subscriptions by table id, instantiates blueprints with row-derived variables, kicks off workflow run async. `tasks.contextRowId` is stamped via the workflow's `definition._contextRowId` field, read by `engine.ts` at task creation. Unknown blueprint references write `notifications` rows.

**Tech Stack:** Next.js 16 + Drizzle/SQLite, TypeScript, Vitest, Zod (manifest schema), js-yaml. Touches `src/lib/workflows/engine.ts` — runtime-registry-adjacent danger zone per CLAUDE.md → mandatory browser smoke.

**Predecessor:** `docs/superpowers/specs/2026-05-02-row-trigger-blueprint-execution-design.md` (commit c153605e). Spec self-review locked 8 design decisions and an 8-row error registry; this plan turns each registry row into a test.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/apps/manifest-trigger-dispatch.ts` | NEW | The dispatcher: filter manifests, resolve `{{row.<col>}}` variables, instantiate + run, write notifications on failure |
| `src/lib/apps/__tests__/manifest-trigger-dispatch.test.ts` | NEW | 8-10 unit tests, one per error-registry row + happy paths |
| `src/lib/apps/registry.ts` | EDIT | Add `listAppsCached()` export with 5s TTL + `invalidateAppsCache()`; call invalidate from `upsertAppManifest` and `deleteApp` |
| `src/lib/apps/__tests__/registry.test.ts` | EDIT | Add cache TTL + invalidation tests |
| `src/lib/data/tables.ts` | EDIT | One-line: `evaluateManifestTriggers(tableId, newRow.id, rowData).catch(() => {})` after the existing `evaluateTriggers` |
| `src/lib/data/__tests__/tables-row-insert-dispatch.test.ts` | NEW | Real-DB integration test: `addRows` → dispatcher → `tasks.contextRowId` populated |
| `src/lib/workflows/blueprints/instantiator.ts` | EDIT | Accept optional `metadata?: { _contextRowId?: string }` parameter; persist into `definition` JSON |
| `src/lib/workflows/blueprints/__tests__/instantiator.test.ts` | EDIT | Add test for metadata passthrough |
| `src/lib/workflows/engine.ts` | EDIT | In `executeChildTask` (line 871), read `workflow.definition._contextRowId` and stamp `tasks.context_row_id` at the line 910 task-insert. **Runtime-registry-adjacent — smoke required.** |
| `src/lib/workflows/__tests__/engine.test.ts` | EDIT | Test that `_contextRowId` from workflow definition flows to created tasks |
| `~/.ainative/blueprints/customer-follow-up-drafter--draft-followup.yaml` | NEW | Real blueprint: 1 step, drafts a follow-up email with `{{row.<col>}}` template variables |
| `~/.ainative/blueprints/research-digest--weekly-digest.yaml` | NEW | Real blueprint: 1 step, synthesizes weekly digest |
| `~/.ainative/apps/customer-follow-up-drafter/manifest.yaml` | EDIT | Update blueprint id to qualified form + add `source` pointer |
| `~/.ainative/apps/research-digest/manifest.yaml` | EDIT | Same canonical pattern |
| `features/composed-app-kit-inbox-and-research.md` | EDIT (small) | Note that the broken-reference manifests have been fixed |
| `features/row-trigger-blueprint-execution.md` | NEW | Feature spec with status: completed once browser smoke passes |
| `HANDOFF.md` | OVERWRITE at end | New handoff pointing at next pickup |

---

## What already exists (reuse, do not rebuild)

- **`evaluateTriggers(tableId, event, rowData)`** at `src/lib/tables/trigger-evaluator.ts:24` — fire-and-forget invoked from `addRows`/`updateRow`/`deleteRow` in `src/lib/data/tables.ts`. Mirror the shape; do not modify.
- **`listApps(appsDir)`** at `src/lib/apps/registry.ts:280` — filesystem reader. Wrap with cache; do not duplicate.
- **`upsertAppManifest()`** in `src/lib/apps/compose-integration.ts` and **`deleteApp()`** in `src/lib/apps/registry.ts` — canonical mutation surfaces. Cache invalidation hooks attach here.
- **`getBlueprint(id)`** at `src/lib/workflows/blueprints/registry.ts:74` — already supports both `BUILTINS_DIR` and `~/.ainative/blueprints/`. No changes needed.
- **`instantiateBlueprint(id, variables, projectId?)`** at `src/lib/workflows/blueprints/instantiator.ts:24` — extend signature with `metadata` param. Returns `workflowId`.
- **`executeWorkflow workflowId`** at `src/lib/workflows/engine.ts:37` — call via `await import()`.
- **`executeChildTask`** at `src/lib/workflows/engine.ts:871` — task creation site. Already loads `workflow` row.
- **`ensureAppProject(appId)`** in `src/lib/apps/compose-integration.ts` — `projects.id = appId`. Dispatcher passes `appId` as `projectId`.
- **`notifications` table** + helpers under `src/lib/notifications/` — write trigger failures here.
- **`tasks.contextRowId`** column at `src/lib/db/schema.ts:33` — Phase 4 already shipped.
- **Phase 4 Inbox loader** at `src/lib/apps/view-kits/data.ts` — already reads `tasks.contextRowId` for row→draft attribution.
- **Canonical blueprint pattern**: `~/.ainative/apps/habit-tracker/manifest.yaml` + `~/.ainative/blueprints/habit-tracker--weekly-review.yaml`. Mirror this shape.

---

## NOT in scope (explicit deferrals)

- **`row_updated` and `row_deleted` triggers** — Phase 4 schema only locks `kind: "row-insert"`.
- **`trigger.condition: FilterSpec` on manifest triggers** — UI-configured triggers support conditions; manifests fire unconditionally for now.
- **Webhook triggers / external events** — out of scope per Phase 4 spec.
- **Deduplication / debouncing of concurrent inserts** — bulk imports fire N dispatches matching existing semantics.
- **Migration of UI-configured triggers to manifest form** — both systems coexist.
- **Manifest-editor UI** — manifests stay YAML-edited.
- **Retry on dispatch failure** — fire-and-forget; failures surface via notifications.
- **Inbox loader fix for multi-step workflows** — when a row-triggered workflow has multiple steps, all get `contextRowId` stamped; the Phase 4 loader uses `LIMIT 1 + JOIN documents` and shows the latest task's document. The two new blueprints are single-step, so this doesn't bite.

---

## Error & Rescue Registry

| # | Error | Trigger | Impact | Rescue (matches a test) |
|---|---|---|---|---|
| 1 | Unknown blueprint id | Manifest references id absent from registry | Subscription doesn't fire | Notification (`kind=trigger_failure`); other apps fire normally; `console.error` log |
| 2 | Required blueprint variable unsatisfied | Row data missing column AND blueprint variable has no static default | Instantiator throws | Caught at dispatcher; notification w/ missing variable name; no partial workflow |
| 3 | `listApps()` filesystem error | Permission/missing dir/OS fault | Manifest dispatch fails for this insert | Caught + logged; existing trigger evaluator unaffected; notification: `manifest_scan_failed` |
| 4 | Stale cache: app created/deleted within 5s | Cache holds previous state | New app's first insert misses; deleted app's stale subscription fires | Invalidation hooks at `upsertAppManifest`/`deleteApp` |
| 5 | Workflow run rejects after instantiate succeeds | Engine error mid-flight | Workflow stays in `status=draft`, never runs | Engine's existing error path writes its own notification; smoke verifies coverage |
| 6 | `tasks.context_row_id` stamping fails | Engine reads `definition._contextRowId` but field missing/malformed | Tasks created without `context_row_id` | Inbox shows empty state (acceptable, non-fatal); engine logs a warning |
| 7 | Manifest YAML parse failure | Hand-edited invalid YAML | Subscription invisible to dispatcher | `listApps()` already silently skips; dispatcher writes `manifest_invalid` notification ONCE per session |
| 8 | **Module-load cycle via chat-tools import** (CLAUDE.md class) | Static import from engine.ts to a chat-tools module | `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` at first request | Use `await import()` in dispatcher; smoke test catches if it slips through |
| 9 | Concurrent insert spam | 100 rows arrive | 100 fire-and-forget dispatches | Workflow engine's slot/lease semantics throttle; document as known characteristic |

---

## Wave 1 — Instantiator metadata passthrough

### Task 1.1: Extend `instantiateBlueprint` to accept optional metadata

**Files:**
- Modify: `src/lib/workflows/blueprints/instantiator.ts:24`
- Test: `src/lib/workflows/blueprints/__tests__/instantiator.test.ts`

- [ ] **Step 1: Write the failing test.** Append the following describe block to `src/lib/workflows/blueprints/__tests__/instantiator.test.ts`:

```typescript
describe("instantiateBlueprint metadata passthrough", () => {
  it("persists _contextRowId from metadata into workflow.definition", async () => {
    const result = await instantiateBlueprint(
      "research-report",
      { topic: "ai-native trends" },
      "test-project",
      { _contextRowId: "row-abc-123" }
    );
    const [wf] = await db.select().from(workflows).where(eq(workflows.id, result.workflowId));
    expect(wf).toBeDefined();
    const definition = JSON.parse(wf!.definition);
    expect(definition._contextRowId).toBe("row-abc-123");
  });

  it("omits _contextRowId from definition when metadata not provided", async () => {
    const result = await instantiateBlueprint("research-report", { topic: "no-metadata test" }, "test-project");
    const [wf] = await db.select().from(workflows).where(eq(workflows.id, result.workflowId));
    const definition = JSON.parse(wf!.definition);
    expect(definition._contextRowId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify failure.** `npx vitest run src/lib/workflows/blueprints/__tests__/instantiator.test.ts -t "metadata passthrough" 2>&1 | tail -20`. Expected: FAIL — TypeScript error on 4-arg call OR `_contextRowId` undefined.

- [ ] **Step 3: Modify `instantiateBlueprint` signature + body.** In `src/lib/workflows/blueprints/instantiator.ts`:

```typescript
// Signature (line 24) — add optional 4th param:
export async function instantiateBlueprint(
  blueprintId: string,
  variables: Record<string, unknown>,
  projectId?: string,
  metadata?: { _contextRowId?: string }
): Promise<InstantiateResult> {

// Definition construction (around line 95):
const definition: Record<string, unknown> = {
  pattern: blueprint.pattern,
  steps: resolvedSteps,
  _blueprintId: blueprintId,
};
if (metadata?._contextRowId) {
  definition._contextRowId = metadata._contextRowId;
}
```

- [ ] **Step 4: Run tests.** `npx vitest run src/lib/workflows/blueprints/__tests__/instantiator.test.ts 2>&1 | tail -10`. Expected: all tests pass.

- [ ] **Step 5: Run tsc.** `npx tsc --noEmit 2>&1 | grep instantiateBlueprint || echo "no errors"`. Expected: `no errors`.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/workflows/blueprints/instantiator.ts src/lib/workflows/blueprints/__tests__/instantiator.test.ts
git commit -m "feat(workflows): instantiateBlueprint accepts metadata._contextRowId

Persists the row id into the workflow's definition JSON so engine.ts
can stamp tasks.context_row_id when creating tasks from row-triggered
blueprints. Optional param — existing 3-arg callers unchanged.

Part of: row-trigger-blueprint-execution"
```

---

## Wave 2 — Engine reads `_contextRowId` at task creation

### Task 2.1: Stamp `tasks.context_row_id` from workflow definition

**Files:**
- Modify: `src/lib/workflows/engine.ts:871-925` (within `executeChildTask`)
- Test: `src/lib/workflows/__tests__/engine.test.ts`

**⚠️ Runtime-registry-adjacent file — see Wave 8 for mandatory browser smoke.**

- [ ] **Step 1: Write the failing test.** Append to `src/lib/workflows/__tests__/engine.test.ts`:

```typescript
describe("executeChildTask context_row_id stamping", () => {
  it("populates tasks.context_row_id from workflow.definition._contextRowId", async () => {
    const workflowId = crypto.randomUUID();
    const definition = { pattern: "sequence", steps: [], _blueprintId: "test-bp", _contextRowId: "row-xyz-789" };
    await db.insert(workflows).values({
      id: workflowId, projectId: "test-project", name: "Test workflow",
      definition: JSON.stringify(definition), status: "draft",
      createdAt: new Date(), updatedAt: new Date(),
    });
    const result = await executeChildTask(
      workflowId, "Test step", "test prompt",
      undefined, undefined, undefined, undefined, undefined, "test-runtime"
    );
    const [task] = await db.select().from(tasks).where(eq(tasks.id, result.taskId));
    expect(task!.contextRowId).toBe("row-xyz-789");
  });

  it("leaves context_row_id null when workflow definition has no _contextRowId", async () => {
    const workflowId = crypto.randomUUID();
    const definition = { pattern: "sequence", steps: [], _blueprintId: "test-bp" };
    await db.insert(workflows).values({
      id: workflowId, projectId: "test-project", name: "No-context test",
      definition: JSON.stringify(definition), status: "draft",
      createdAt: new Date(), updatedAt: new Date(),
    });
    const result = await executeChildTask(
      workflowId, "Step", "prompt",
      undefined, undefined, undefined, undefined, undefined, "test-runtime"
    );
    const [task] = await db.select().from(tasks).where(eq(tasks.id, result.taskId));
    expect(task!.contextRowId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure.** `npx vitest run src/lib/workflows/__tests__/engine.test.ts -t "context_row_id stamping" 2>&1 | tail -20`. Expected: FAIL — `task!.contextRowId` is null.

- [ ] **Step 3: Modify `executeChildTask`.** In `src/lib/workflows/engine.ts`, after the workflow lookup at line 885 add:

```typescript
let contextRowId: string | null = null;
if (workflow?.definition) {
  try {
    const def = JSON.parse(workflow.definition) as { _contextRowId?: string };
    if (typeof def._contextRowId === "string") contextRowId = def._contextRowId;
  } catch {
    console.warn(`[workflow-engine] workflow ${workflowId} has unparseable definition`);
  }
}
```

Then at the `db.insert(tasks).values({...})` call (line 910), add `contextRowId,` between `maxBudgetUsd` and `createdAt`.

- [ ] **Step 4: Run engine test.** `npx vitest run src/lib/workflows/__tests__/engine.test.ts 2>&1 | tail -15`. Expected: all engine tests pass.

- [ ] **Step 5: Run tsc.** `npx tsc --noEmit 2>&1 | grep -E "engine\.ts" || echo "no errors"`. Expected: `no errors`.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/workflows/engine.ts src/lib/workflows/__tests__/engine.test.ts
git commit -m "feat(workflows): engine stamps tasks.context_row_id from workflow definition

executeChildTask now reads _contextRowId from workflow.definition and
populates tasks.context_row_id. Phase 4 added the column; this completes
the row-to-task attribution path.

Engine.ts is runtime-registry-adjacent per CLAUDE.md — browser smoke
required (see Wave 8).

Part of: row-trigger-blueprint-execution"
```

---

## Wave 3 — Real blueprints + manifest updates

### Task 3.1: Author `customer-follow-up-drafter--draft-followup.yaml`

**Files:** Create `~/.ainative/blueprints/customer-follow-up-drafter--draft-followup.yaml`.

- [ ] **Step 1: Verify the BlueprintSchema shape.** Read `src/lib/validators/blueprint.ts` (or `rg -l "BlueprintSchema" src/`).

- [ ] **Step 2: Write the YAML.**

```yaml
id: customer-follow-up-drafter--draft-followup
name: Draft customer follow-up
description: Drafts a personalized follow-up reply for a customer touchpoint
version: "1.0.0"
domain: customer-success
tags: [customer-success, drafting, inbox]
pattern: sequence
difficulty: beginner
estimatedDuration: "1-2 min"
author: ainative
variables:
  - id: customer
    type: text
    label: Customer
    description: Auto-populated from row.customer
    required: true
    default: "{{row.customer}}"
  - id: summary
    type: text
    label: Touchpoint summary
    description: Auto-populated from row.summary
    required: true
    default: "{{row.summary}}"
  - id: sentiment
    type: text
    label: Detected sentiment
    description: Auto-populated from row.sentiment
    required: false
    default: "{{row.sentiment}}"
  - id: channel
    type: text
    label: Source channel
    description: Auto-populated from row.channel
    required: false
    default: "{{row.channel}}"
steps:
  - name: Draft reply
    profileId: cs-coach
    promptTemplate: >
      Draft a brief, empathetic follow-up reply for {{customer}}.

      Touchpoint summary: {{summary}}
      Channel: {{channel}}
      Detected sentiment: {{sentiment}}

      Keep the reply under 120 words. Match the tone to the sentiment —
      apologetic for negative, appreciative for positive, helpful for
      neutral. End with a clear next-step.

      Output as a markdown document with a level-1 heading
      "Reply to {{customer}}" followed by the body.
```

- [ ] **Step 3: Validity test.** Create `src/lib/workflows/blueprints/__tests__/phase-5-blueprints-validity.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getBlueprint } from "../registry";

describe("customer-follow-up-drafter--draft-followup blueprint", () => {
  it("loads from the user blueprints dir and parses cleanly", () => {
    const bp = getBlueprint("customer-follow-up-drafter--draft-followup");
    expect(bp).toBeDefined();
    expect(bp!.id).toBe("customer-follow-up-drafter--draft-followup");
    expect(bp!.steps.length).toBe(1);
    expect(bp!.variables.find((v) => v.id === "customer")).toBeDefined();
    expect(bp!.variables.find((v) => v.id === "summary")?.required).toBe(true);
  });
});
```

Run: `npx vitest run src/lib/workflows/blueprints/__tests__/phase-5-blueprints-validity.test.ts 2>&1 | tail -10`. Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/workflows/blueprints/__tests__/phase-5-blueprints-validity.test.ts
git commit -m "feat(blueprints): real customer-follow-up-drafter--draft-followup blueprint

Replaces Phase 4's hand-crafted unregistered reference. Single
drafting step, four variables driven from row data via {{row.<col>}}
defaults. Validity test guards future schema drift.

Part of: row-trigger-blueprint-execution"
```

### Task 3.2: Author `research-digest--weekly-digest.yaml`

**Files:** Create `~/.ainative/blueprints/research-digest--weekly-digest.yaml`.

- [ ] **Step 1: Write the YAML.**

```yaml
id: research-digest--weekly-digest
name: Weekly research digest
description: Synthesize the most important developments across configured research sources
version: "1.0.0"
domain: research
tags: [research, synthesis, digest]
pattern: sequence
difficulty: beginner
estimatedDuration: "3-5 min"
author: ainative
variables:
  - id: period
    type: text
    label: Period
    description: Time period to synthesize
    required: false
    default: "the past week"
steps:
  - name: Synthesize sources
    profileId: researcher
    promptTemplate: >
      Read the rows in the `sources` table. For each source, fetch the
      latest content and identify the 1-2 most significant developments
      from {{period}}.

      Combine into a digest with three sections:
      1. Top developments (3 bullets max)
      2. Cross-source themes (2 bullets max)
      3. Watchlist items for next week (1 bullet)

      Output as markdown with the title "Digest for week ending <today>".
```

- [ ] **Step 2: Validity test.** Append to `src/lib/workflows/blueprints/__tests__/phase-5-blueprints-validity.test.ts`:

```typescript
describe("research-digest--weekly-digest blueprint", () => {
  it("loads from the user blueprints dir and parses cleanly", () => {
    const bp = getBlueprint("research-digest--weekly-digest");
    expect(bp).toBeDefined();
    expect(bp!.id).toBe("research-digest--weekly-digest");
    expect(bp!.steps.length).toBe(1);
  });
});
```

Run: `npx vitest run src/lib/workflows/blueprints/__tests__/phase-5-blueprints-validity.test.ts 2>&1 | tail -10`. Expected: 2 tests pass.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/workflows/blueprints/__tests__/phase-5-blueprints-validity.test.ts
git commit -m "feat(blueprints): real research-digest--weekly-digest blueprint

Resolves Phase 4's hand-crafted unregistered reference. Schedule-
triggered (not part of dispatcher's hot path) but the manifest
reference must resolve cleanly.

Part of: row-trigger-blueprint-execution"
```

### Task 3.3: Update Phase 4 smoke manifests to canonical pattern

**Files:** Edit `~/.ainative/apps/customer-follow-up-drafter/manifest.yaml` and `~/.ainative/apps/research-digest/manifest.yaml`.

- [ ] **Step 1: Update customer-follow-up-drafter manifest.** Change the `blueprints:` block from:

```yaml
blueprints:
  - id: draft-followup
    name: Draft followup
    description: Drafts a personalized follow-up email
    trigger:
      kind: row-insert
      table: customer-touchpoints
```

To:

```yaml
blueprints:
  - id: customer-follow-up-drafter--draft-followup
    source: $AINATIVE_DATA_DIR/blueprints/customer-follow-up-drafter--draft-followup.yaml
    trigger:
      kind: row-insert
      table: customer-touchpoints
```

- [ ] **Step 2: Update research-digest manifest.** Change to:

```yaml
blueprints:
  - id: research-digest--weekly-digest
    source: $AINATIVE_DATA_DIR/blueprints/research-digest--weekly-digest.yaml
```

- [ ] **Step 3: Verify Phase 4 tests still pass.** `npx vitest run src/lib/apps src/components/apps 2>&1 | tail -5`. Expected: all Phase 4 tests still pass.

(Manifests are gitignored — no commit for the manifest edits themselves; they ship via the smoke fixture documentation.)

---

## Wave 4 — `listApps` cache

### Task 4.1: Add `listAppsCached()` + `invalidateAppsCache()`

**Files:** Modify `src/lib/apps/registry.ts` and `src/lib/apps/__tests__/registry.test.ts`.

- [ ] **Step 1: Write failing tests.** Append to `src/lib/apps/__tests__/registry.test.ts`:

```typescript
import { listApps, listAppsCached, invalidateAppsCache } from "../registry";

describe("listAppsCached", () => {
  beforeEach(() => { invalidateAppsCache(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it("returns the same result within 5s without re-reading", () => {
    const tmp = makeTmpAppsDir([{ id: "app-a" }]);
    const first = listAppsCached(tmp);
    expect(first.map((a) => a.id)).toEqual(["app-a"]);

    fs.mkdirSync(path.join(tmp, "app-b"));
    fs.writeFileSync(path.join(tmp, "app-b", "manifest.yaml"), "id: app-b\nname: B\n");

    vi.advanceTimersByTime(4000);
    const second = listAppsCached(tmp);
    expect(second.map((a) => a.id)).toEqual(["app-a"]);
  });

  it("re-reads after TTL expires", () => {
    const tmp = makeTmpAppsDir([{ id: "app-a" }]);
    listAppsCached(tmp);
    fs.mkdirSync(path.join(tmp, "app-b"));
    fs.writeFileSync(path.join(tmp, "app-b", "manifest.yaml"), "id: app-b\nname: B\n");
    vi.advanceTimersByTime(5001);
    const fresh = listAppsCached(tmp);
    expect(fresh.map((a) => a.id).sort()).toEqual(["app-a", "app-b"]);
  });

  it("invalidateAppsCache forces re-read", () => {
    const tmp = makeTmpAppsDir([{ id: "app-a" }]);
    listAppsCached(tmp);
    fs.mkdirSync(path.join(tmp, "app-b"));
    fs.writeFileSync(path.join(tmp, "app-b", "manifest.yaml"), "id: app-b\nname: B\n");
    invalidateAppsCache();
    const fresh = listAppsCached(tmp);
    expect(fresh.map((a) => a.id).sort()).toEqual(["app-a", "app-b"]);
  });

  it("scopes cache by appsDir argument", () => {
    const dirA = makeTmpAppsDir([{ id: "in-a" }]);
    const dirB = makeTmpAppsDir([{ id: "in-b" }]);
    expect(listAppsCached(dirA).map((a) => a.id)).toEqual(["in-a"]);
    expect(listAppsCached(dirB).map((a) => a.id)).toEqual(["in-b"]);
  });
});

function makeTmpAppsDir(apps: Array<{ id: string }>): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "list-apps-cache-"));
  for (const a of apps) {
    fs.mkdirSync(path.join(tmp, a.id));
    fs.writeFileSync(path.join(tmp, a.id, "manifest.yaml"), `id: ${a.id}\nname: ${a.id}\n`);
  }
  return tmp;
}
```

- [ ] **Step 2: Run tests to verify failure.** `npx vitest run src/lib/apps/__tests__/registry.test.ts -t "listAppsCached" 2>&1 | tail -15`. Expected: FAIL — exports missing.

- [ ] **Step 3: Add the cache module.** Append to `src/lib/apps/registry.ts`:

```typescript
const APPS_CACHE_TTL_MS = 5_000;

interface AppsCacheEntry {
  apps: AppSummary[];
  expiresAt: number;
}

const appsCache = new Map<string, AppsCacheEntry>();

export function listAppsCached(appsDir: string = getAinativeAppsDir()): AppSummary[] {
  const now = Date.now();
  const cached = appsCache.get(appsDir);
  if (cached && cached.expiresAt > now) return cached.apps;
  const apps = listApps(appsDir);
  appsCache.set(appsDir, { apps, expiresAt: now + APPS_CACHE_TTL_MS });
  return apps;
}

export function invalidateAppsCache(): void {
  appsCache.clear();
}
```

- [ ] **Step 4: Run tests.** `npx vitest run src/lib/apps/__tests__/registry.test.ts 2>&1 | tail -10`. Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/apps/registry.ts src/lib/apps/__tests__/registry.test.ts
git commit -m "feat(apps): listAppsCached + invalidateAppsCache (5s TTL)

Caches manifest reads on the hot path for row-insert dispatch.
Scoped per appsDir argument so test fixtures and production stay
isolated. Invalidation is manual — call from manifest mutation sites.

Part of: row-trigger-blueprint-execution"
```

### Task 4.2: Wire invalidation into manifest mutation sites

**Files:** Modify `src/lib/apps/registry.ts` and `src/lib/apps/compose-integration.ts`.

- [ ] **Step 1: Write failing tests.** Append to `src/lib/apps/__tests__/registry.test.ts`:

```typescript
describe("cache invalidation on mutations", () => {
  beforeEach(() => invalidateAppsCache());

  it("deleteApp() invalidates the cache for its dir", () => {
    const tmp = makeTmpAppsDir([{ id: "app-x" }]);
    expect(listAppsCached(tmp).map((a) => a.id)).toEqual(["app-x"]);
    deleteApp("app-x", tmp);
    expect(listAppsCached(tmp).map((a) => a.id)).toEqual([]);
  });
});
```

And in `src/lib/apps/__tests__/compose-integration.test.ts`:

```typescript
import { listAppsCached, invalidateAppsCache } from "../registry";

describe("upsertAppManifest invalidates apps cache", () => {
  it("forces fresh listApps result after a manifest write", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "upsert-cache-"));
    invalidateAppsCache();
    expect(listAppsCached(tmp)).toEqual([]);
    upsertAppManifest("new-app", { kind: "table", id: "tbl-a" }, "New app", tmp);
    expect(listAppsCached(tmp).map((a) => a.id)).toEqual(["new-app"]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure.** Both invalidation tests fail.

- [ ] **Step 3: Add invalidation calls.** In `deleteApp` (after `fs.rmSync`):

```typescript
fs.rmSync(rootDir, { recursive: true, force: true });
invalidateAppsCache();
return true;
```

In `compose-integration.ts`, add `import { invalidateAppsCache } from "./registry"` at top, and at end of `upsertAppManifest`:

```typescript
fs.writeFileSync(manifestPath, yaml.dump(manifest));
invalidateAppsCache();
return manifest;
```

- [ ] **Step 4: Run tests.** `npx vitest run src/lib/apps 2>&1 | tail -10`. Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/apps/registry.ts src/lib/apps/compose-integration.ts src/lib/apps/__tests__/
git commit -m "feat(apps): invalidate apps cache on manifest mutations

upsertAppManifest and deleteApp now drop the listAppsCached cache so
row-insert dispatch sees fresh manifest state without waiting for the
5s TTL.

Part of: row-trigger-blueprint-execution"
```

---

## Wave 5 — Dispatcher

Build test-first, one error-registry row at a time.

### Task 5.1: Dispatcher happy path

**Files:** Create `src/lib/apps/manifest-trigger-dispatch.ts` and `src/lib/apps/__tests__/manifest-trigger-dispatch.test.ts`.

- [ ] **Step 1: Write the failing test.** Create the test file:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateManifestTriggers } from "../manifest-trigger-dispatch";
import * as registry from "../registry";
import * as instantiator from "@/lib/workflows/blueprints/instantiator";
import * as engine from "@/lib/workflows/engine";

vi.mock("../registry", async () => {
  const actual = await vi.importActual<typeof import("../registry")>("../registry");
  return { ...actual, listAppsCached: vi.fn() };
});
vi.mock("@/lib/workflows/blueprints/instantiator", () => ({ instantiateBlueprint: vi.fn() }));
vi.mock("@/lib/workflows/engine", () => ({ executeWorkflow: vi.fn() }));

describe("evaluateManifestTriggers — happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("instantiates and runs one blueprint when one manifest subscribes", async () => {
    vi.mocked(registry.listAppsCached).mockReturnValue([{
      id: "test-app",
      manifest: {
        id: "test-app",
        blueprints: [{ id: "test-app--my-bp", trigger: { kind: "row-insert", table: "tbl-x" } }],
      },
    } as any]);
    vi.mocked(instantiator.instantiateBlueprint).mockResolvedValue({
      workflowId: "wf-1", name: "T", stepsCount: 1, skippedSteps: [],
    });

    await evaluateManifestTriggers("tbl-x", "row-1", { foo: "bar" });

    expect(instantiator.instantiateBlueprint).toHaveBeenCalledWith(
      "test-app--my-bp", expect.any(Object), "test-app", { _contextRowId: "row-1" }
    );
    expect(engine.executeWorkflow).toHaveBeenCalledWith("wf-1");
  });
});
```

- [ ] **Step 2: Run test to verify failure.** Module doesn't exist.

- [ ] **Step 3: Create the minimal dispatcher.** Create `src/lib/apps/manifest-trigger-dispatch.ts`:

```typescript
import { listAppsCached } from "./registry";
import type { AppDetail } from "./registry";

export async function evaluateManifestTriggers(
  tableId: string,
  rowId: string,
  rowData: Record<string, unknown>
): Promise<void> {
  const apps = listAppsCached();
  const matches = findMatchingSubscriptions(apps, tableId);

  for (const { appId, blueprintId } of matches) {
    try {
      const { instantiateBlueprint } = await import("@/lib/workflows/blueprints/instantiator");
      const { executeWorkflow } = await import("@/lib/workflows/engine");
      const variables = { ...rowData };
      const { workflowId } = await instantiateBlueprint(
        blueprintId, variables, appId, { _contextRowId: rowId }
      );
      executeWorkflow(workflowId).catch((err) => {
        console.error(`[manifest-trigger-dispatch] workflow ${workflowId} failed:`, err);
      });
    } catch (err) {
      console.error(
        `[manifest-trigger-dispatch] dispatch failed for app=${appId} blueprint=${blueprintId}:`, err
      );
    }
  }
}

interface MatchingSubscription { appId: string; blueprintId: string; }

function findMatchingSubscriptions(
  apps: Pick<AppDetail, "id" | "manifest">[],
  tableId: string
): MatchingSubscription[] {
  const out: MatchingSubscription[] = [];
  for (const app of apps) {
    for (const bp of app.manifest?.blueprints ?? []) {
      const t = (bp as { trigger?: { kind?: string; table?: string } }).trigger;
      if (t?.kind === "row-insert" && t.table === tableId) {
        out.push({ appId: app.id, blueprintId: bp.id });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test.** `npx vitest run src/lib/apps/__tests__/manifest-trigger-dispatch.test.ts 2>&1 | tail -10`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/apps/manifest-trigger-dispatch.ts src/lib/apps/__tests__/manifest-trigger-dispatch.test.ts
git commit -m "feat(apps): manifest-trigger-dispatch happy path

Reads cached manifests, filters by table id, instantiates and async-
runs matching blueprints. Uses await import() for engine.ts and
instantiator per CLAUDE.md runtime-registry-adjacent rule.

Part of: row-trigger-blueprint-execution"
```

### Task 5.2: 0-match and N-match cases

- [ ] **Step 1: Write failing tests.** Append to the test file:

```typescript
describe("evaluateManifestTriggers — match counts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when no manifest subscribes", async () => {
    vi.mocked(registry.listAppsCached).mockReturnValue([]);
    await evaluateManifestTriggers("tbl-other", "row-1", {});
    expect(instantiator.instantiateBlueprint).not.toHaveBeenCalled();
  });

  it("fires both apps when 2 manifests subscribe to the same table", async () => {
    vi.mocked(registry.listAppsCached).mockReturnValue([
      { id: "app-a", manifest: { id: "app-a", blueprints: [{ id: "app-a--bp", trigger: { kind: "row-insert", table: "tbl-x" } }] } } as any,
      { id: "app-b", manifest: { id: "app-b", blueprints: [{ id: "app-b--bp", trigger: { kind: "row-insert", table: "tbl-x" } }] } } as any,
    ]);
    vi.mocked(instantiator.instantiateBlueprint)
      .mockResolvedValueOnce({ workflowId: "wf-a", name: "A", stepsCount: 1, skippedSteps: [] })
      .mockResolvedValueOnce({ workflowId: "wf-b", name: "B", stepsCount: 1, skippedSteps: [] });

    await evaluateManifestTriggers("tbl-x", "row-1", {});
    expect(instantiator.instantiateBlueprint).toHaveBeenCalledTimes(2);
  });

  it("ignores manifests subscribing to a different table", async () => {
    vi.mocked(registry.listAppsCached).mockReturnValue([
      { id: "app-a", manifest: { id: "app-a", blueprints: [{ id: "app-a--bp", trigger: { kind: "row-insert", table: "tbl-other" } }] } } as any,
    ]);
    await evaluateManifestTriggers("tbl-x", "row-1", {});
    expect(instantiator.instantiateBlueprint).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests.** All pass — dispatcher already handles these cases.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/apps/__tests__/manifest-trigger-dispatch.test.ts
git commit -m "test(apps): manifest-trigger-dispatch match-count cases

Verifies 0-match (no fires), 2-match (independent dispatches per app),
and ignores subscriptions to other tables.

Part of: row-trigger-blueprint-execution"
```

### Task 5.3: `{{row.<col>}}` variable substitution

- [ ] **Step 1: Write failing test.** Append:

```typescript
describe("evaluateManifestTriggers — variable substitution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves {{row.<col>}} placeholders in blueprint defaults", async () => {
    vi.mocked(registry.listAppsCached).mockReturnValue([
      { id: "app-x", manifest: { id: "app-x", blueprints: [{ id: "app-x--bp", trigger: { kind: "row-insert", table: "tbl-x" } }] } } as any,
    ]);
    vi.mocked(instantiator.instantiateBlueprint).mockResolvedValue({
      workflowId: "wf-1", name: "T", stepsCount: 1, skippedSteps: [],
    });

    await evaluateManifestTriggers("tbl-x", "row-1", {
      customer: "Acme Corp", summary: "Bug report", sentiment: "negative",
    });

    expect(instantiator.instantiateBlueprint).toHaveBeenCalledWith(
      "app-x--bp",
      expect.objectContaining({ customer: "Acme Corp", summary: "Bug report", sentiment: "negative" }),
      "app-x",
      { _contextRowId: "row-1" }
    );
  });
});
```

- [ ] **Step 2: Run test.** Should pass since dispatcher passes rowData through.

- [ ] **Step 3: Refine to also resolve `{{row.<col>}}` in blueprint variable defaults.** Replace `const variables = { ...rowData };` with a call to `buildVariables(blueprintId, rowData)`:

```typescript
import { getBlueprint } from "@/lib/workflows/blueprints/registry";

const ROW_PLACEHOLDER = /^\{\{\s*row\.([a-zA-Z0-9_-]+)\s*\}\}$/;

function buildVariables(blueprintId: string, rowData: Record<string, unknown>): Record<string, unknown> {
  const blueprint = getBlueprint(blueprintId);
  const vars: Record<string, unknown> = { ...rowData };
  if (!blueprint) return vars;
  for (const varDef of blueprint.variables) {
    const defStr = typeof varDef.default === "string" ? varDef.default : null;
    if (!defStr) continue;
    const m = ROW_PLACEHOLDER.exec(defStr);
    if (m) {
      const col = m[1];
      if (vars[varDef.id] === undefined && rowData[col] !== undefined) {
        vars[varDef.id] = rowData[col];
      }
    }
  }
  return vars;
}
```

- [ ] **Step 4: Run all dispatcher tests.** All pass.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/apps/manifest-trigger-dispatch.ts src/lib/apps/__tests__/manifest-trigger-dispatch.test.ts
git commit -m "feat(apps): dispatcher resolves {{row.<col>}} blueprint defaults

Pre-resolves {{row.<col>}} placeholders in blueprint variable defaults
against the inserted row's data, before passing to instantiateBlueprint.
Keeps the convention scoped to the dispatcher; no change to template.ts.

Part of: row-trigger-blueprint-execution"
```

### Task 5.4: Unknown blueprint id → notification

- [ ] **Step 1: Find the canonical notification helper.** `rg -n "function.*[Nn]otification" src/lib/notifications/`. Use the canonical name (e.g., `writeNotification` or `createNotification`).

- [ ] **Step 2: Write failing tests.** Append to test file:

```typescript
vi.mock("@/lib/notifications", () => ({ writeNotification: vi.fn() }));
import * as notifications from "@/lib/notifications";

describe("evaluateManifestTriggers — error paths", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes notification when blueprint id is unregistered", async () => {
    vi.mocked(registry.listAppsCached).mockReturnValue([
      { id: "broken-app", manifest: { id: "broken-app", blueprints: [{ id: "broken-app--missing-bp", trigger: { kind: "row-insert", table: "tbl-x" } }] } } as any,
    ]);
    vi.mocked(instantiator.instantiateBlueprint).mockRejectedValue(
      new Error('Blueprint "broken-app--missing-bp" not found')
    );

    await evaluateManifestTriggers("tbl-x", "row-1", {});
    expect(notifications.writeNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "trigger_failure" })
    );
    expect(engine.executeWorkflow).not.toHaveBeenCalled();
  });

  it("continues to other apps when one app's blueprint is missing", async () => {
    vi.mocked(registry.listAppsCached).mockReturnValue([
      { id: "broken-app", manifest: { id: "broken-app", blueprints: [{ id: "broken-app--missing-bp", trigger: { kind: "row-insert", table: "tbl-x" } }] } } as any,
      { id: "ok-app", manifest: { id: "ok-app", blueprints: [{ id: "ok-app--bp", trigger: { kind: "row-insert", table: "tbl-x" } }] } } as any,
    ]);
    vi.mocked(instantiator.instantiateBlueprint)
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce({ workflowId: "wf-ok", name: "ok", stepsCount: 1, skippedSteps: [] });

    await evaluateManifestTriggers("tbl-x", "row-1", {});
    expect(engine.executeWorkflow).toHaveBeenCalledWith("wf-ok");
    expect(notifications.writeNotification).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests to verify failure.**

- [ ] **Step 4: Add notification writing.** Update `manifest-trigger-dispatch.ts`:

```typescript
import { writeNotification } from "@/lib/notifications";

// in the catch block:
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[manifest-trigger-dispatch] dispatch failed for app=${appId} blueprint=${blueprintId}:`, err);
  try {
    await writeNotification({
      kind: "trigger_failure",
      title: `Trigger failure in app "${appId}"`,
      body: `Blueprint "${blueprintId}" failed for table "${tableId}" row "${rowId}": ${message}`,
      projectId: appId,
    });
  } catch (nerr) {
    console.error(`[manifest-trigger-dispatch] notification write failed:`, nerr);
  }
}
```

(Adjust to match the actual `writeNotification` signature.)

- [ ] **Step 5: Run tests.** All pass.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/apps/manifest-trigger-dispatch.ts src/lib/apps/__tests__/manifest-trigger-dispatch.test.ts
git commit -m "feat(apps): dispatcher writes notification on dispatch failure

When dispatch fails (unknown id, missing variable, filesystem error),
write a kind=trigger_failure notification scoped to the app's projectId.
Other matching apps still fire — single failure doesn't block multi-
subscription dispatch.

Part of: row-trigger-blueprint-execution"
```

### Task 5.5: Filesystem error tolerance

- [ ] **Step 1: Write failing tests.** Append:

```typescript
describe("evaluateManifestTriggers — listApps fault tolerance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when listAppsCached throws", async () => {
    vi.mocked(registry.listAppsCached).mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });
    await expect(evaluateManifestTriggers("tbl-x", "row-1", {})).resolves.toBeUndefined();
    expect(instantiator.instantiateBlueprint).not.toHaveBeenCalled();
  });

  it("writes manifest_scan_failed notification on filesystem error", async () => {
    vi.mocked(registry.listAppsCached).mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });
    await evaluateManifestTriggers("tbl-x", "row-1", {});
    expect(notifications.writeNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "manifest_scan_failed" })
    );
  });
});
```

- [ ] **Step 2: Wrap `listAppsCached` in try/catch.** Update the dispatcher:

```typescript
export async function evaluateManifestTriggers(tableId, rowId, rowData) {
  let apps;
  try {
    apps = listAppsCached();
  } catch (err) {
    console.error(`[manifest-trigger-dispatch] listAppsCached failed:`, err);
    try {
      await writeNotification({
        kind: "manifest_scan_failed",
        title: "Manifest scan failed",
        body: `Could not read app manifests: ${err instanceof Error ? err.message : String(err)}`,
      });
    } catch {}
    return;
  }
  const matches = findMatchingSubscriptions(apps, tableId);
  // ...rest unchanged...
}
```

- [ ] **Step 3: Run tests.** All pass.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/apps/manifest-trigger-dispatch.ts src/lib/apps/__tests__/manifest-trigger-dispatch.test.ts
git commit -m "feat(apps): dispatcher tolerates listAppsCached failures

Wraps listAppsCached in try/catch; writes manifest_scan_failed
notification on permission/filesystem errors. The row-insert dispatch
becomes a no-op for the failing call but doesn't propagate.

Part of: row-trigger-blueprint-execution"
```

---

## Wave 6 — Wire into `addRows`

### Task 6.1: Call dispatcher from `addRows`

**Files:** Modify `src/lib/data/tables.ts:260-262`.

- [ ] **Step 1: Find the line.** `rg -n "evaluateTriggers" src/lib/data/tables.ts`. Note the loop position.

- [ ] **Step 2: Add the call.** Add import + sibling call:

```typescript
import { evaluateManifestTriggers } from "@/lib/apps/manifest-trigger-dispatch";

// inside the addRows loop, after existing evaluateTriggers call:
evaluateTriggers(tableId, "row_added", rows[i].data).catch(() => {});
evaluateManifestTriggers(tableId, inserted[i].id, rows[i].data).catch(() => {});
```

(Verify `inserted[i].id` is the right reference for the just-inserted row id.)

- [ ] **Step 3: Run tests.** `npx vitest run src/lib/data 2>&1 | tail -10`. Expected: existing tests pass.

- [ ] **Step 4: Run tsc.** `npx tsc --noEmit 2>&1 | grep -E "tables\.ts|manifest-trigger" || echo "no errors"`.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/data/tables.ts
git commit -m "feat(data): wire manifest-trigger-dispatch into addRows

addRows now fires both evaluateTriggers (UI-configured) and
evaluateManifestTriggers (manifest-declared) for every inserted row.
Both fire-and-forget; row-insert request unaffected.

Part of: row-trigger-blueprint-execution"
```

---

## Wave 7 — Integration test

### Task 7.1: End-to-end row-insert → contextRowId integration test

**Files:** Create `src/lib/data/__tests__/tables-row-insert-dispatch.test.ts`.

- [ ] **Step 1: Write the integration test.** Create the file:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { tasks, workflows, projects, userTables, userTableColumns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { addRows } from "@/lib/data/tables";
import { invalidateAppsCache } from "@/lib/apps/registry";

describe("addRows end-to-end manifest-trigger dispatch", () => {
  beforeEach(async () => {
    invalidateAppsCache();
    await db.insert(projects).values({
      id: "test-app-int", name: "Test app integration",
      status: "active", createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
    await db.insert(userTables).values({
      id: "tbl-int", name: "tbl-int",
      createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
    await db.insert(userTableColumns).values({
      id: "col-int", tableId: "tbl-int", name: "data", displayName: "Data",
      type: "text", position: 0, createdAt: new Date(), updatedAt: new Date(),
    }).onConflictDoNothing();
  });

  it("creates a workflow with _contextRowId when a manifest subscribes", async () => {
    const registryModule = await import("@/lib/apps/registry");
    const orig = registryModule.listAppsCached;
    (registryModule as any).listAppsCached = () => [{
      id: "test-app-int",
      manifest: {
        id: "test-app-int",
        name: "Test integration",
        blueprints: [{ id: "research-report", trigger: { kind: "row-insert", table: "tbl-int" } }],
        tables: [{ id: "tbl-int" }],
      },
      rootDir: "/tmp", files: [], createdAt: Date.now(),
    }];

    try {
      const inserted = await addRows("tbl-int", [{ data: { topic: "test row data" } }]);
      const rowId = inserted[0]!.id;

      const start = Date.now();
      let workflow: typeof workflows.$inferSelect | undefined;
      while (Date.now() - start < 2000) {
        const all = await db.select().from(workflows).where(eq(workflows.projectId, "test-app-int"));
        if (all.length > 0) { workflow = all[0]; break; }
        await new Promise((r) => setTimeout(r, 50));
      }

      expect(workflow).toBeDefined();
      const def = JSON.parse(workflow!.definition);
      expect(def._contextRowId).toBe(rowId);
    } finally {
      (registryModule as any).listAppsCached = orig;
    }
  });
});
```

(The monkey-patch may need to be replaced with `vi.spyOn` or a proper module mock depending on Vitest's import semantics. Adjust during build.)

- [ ] **Step 2: Run integration test.** `npx vitest run src/lib/data/__tests__/tables-row-insert-dispatch.test.ts 2>&1 | tail -15`. Expected: PASS. If it reveals real bugs, fix the dispatcher or engine.

- [ ] **Step 3: Run full test suite.** `npx vitest run 2>&1 | tail -10`. Expected: all 340+ tests still pass.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/data/__tests__/tables-row-insert-dispatch.test.ts
git commit -m "test(data): integration test for addRows → manifest dispatch

Real-DB end-to-end test: insert a row into a user_table that a
manifest subscribes to, poll for the resulting workflow, assert
_contextRowId carries the row id through the dispatch path.

Part of: row-trigger-blueprint-execution"
```

---

## Wave 8 — Browser smoke (mandatory per CLAUDE.md)

### Task 8.1: End-to-end browser smoke

**Why:** `src/lib/workflows/engine.ts` is in CLAUDE.md's runtime-registry-adjacent danger zone. Unit tests with `vi.mock` cannot detect module-load cycles. Browser smoke is the only oracle.

- [ ] **Step 1: Start the dev server.**

```bash
PORT=3010 npm run dev > /tmp/ainative-dev-3010.log 2>&1 &
until grep -q "Ready in" /tmp/ainative-dev-3010.log 2>/dev/null; do sleep 2; done
tail -10 /tmp/ainative-dev-3010.log
```

Expected: `Ready in <Xms>` and no `ReferenceError` in the log. If you see `Cannot access 'claudeRuntimeAdapter' before initialization`, a static import of a chat-tools module slipped in — convert to `await import()` and restart.

- [ ] **Step 2: Verify customer-follow-up-drafter loads via chrome-devtools-mcp.** Open `http://localhost:3010/apps/customer-follow-up-drafter`, screenshot to `output/phase-5-inbox-pre-insert.png`, confirm console clean.

- [ ] **Step 3: Insert a row via the Tables UI.** Navigate to `http://localhost:3010/tables/customer-touchpoints`. Use the "Add row" affordance to insert: channel=email, customer=Delta Industries, summary=Asking about enterprise pricing, sentiment=neutral. Screenshot the form to `output/phase-5-row-insert-form.png`. Submit.

- [ ] **Step 4: Verify workflow + task created.**

```bash
sqlite3 ~/.ainative/ainative.db "SELECT id, project_id, status FROM workflows WHERE project_id = 'customer-follow-up-drafter' ORDER BY created_at DESC LIMIT 1;"
sqlite3 ~/.ainative/ainative.db "SELECT id, project_id, context_row_id, status FROM tasks WHERE project_id = 'customer-follow-up-drafter' ORDER BY created_at DESC LIMIT 1;"
```

Expected: fresh workflow + task. `context_row_id` matches the new row's id.

- [ ] **Step 5: Verify Inbox shows the new draft.** Navigate to `http://localhost:3010/apps/customer-follow-up-drafter`. Wait for the workflow's first step to produce a draft document. Screenshot to `output/phase-5-inbox-post-insert.png`. Click the Delta Industries row → URL becomes `?row=<new-row-id>`, draft pane shows generated reply markdown.

- [ ] **Step 6: Console clean check.** No `ReferenceError`. Specifically NO `Cannot access 'claudeRuntimeAdapter' before initialization`.

- [ ] **Step 7: Stop the dev server.**

```bash
pkill -f "next dev --turbopack" || true
pkill -f "next-server" || true
```

- [ ] **Step 8: Document the verification run.** Add to `features/row-trigger-blueprint-execution.md` (Wave 9 creates this) a "Verification run — 2026-05-02" section referencing the 3 screenshots + the new row id.

---

## Wave 9 — Wrap-up

### Task 9.1: Create feature spec

**Files:** Create `features/row-trigger-blueprint-execution.md`.

- [ ] **Step 1: Write the feature spec.**

```markdown
---
title: Row-Trigger Blueprint Execution
status: completed
priority: P1
milestone: phase-5
source: docs/superpowers/specs/2026-05-02-row-trigger-blueprint-execution-design.md
dependencies: [composed-app-kit-inbox-and-research]
---

# Row-Trigger Blueprint Execution

## Description

Wires the manifest's `blueprints[].trigger.kind: "row-insert"` field through the workflow engine. When a row arrives at a user-table that any composed app subscribes to, instantiate that app's named blueprint with row-derived variables and run it; the resulting task carries `tasks.contextRowId = <row-id>` so the Phase 4 Inbox UI can attribute drafts back to the row.

## What shipped

- `evaluateManifestTriggers` dispatcher at `src/lib/apps/manifest-trigger-dispatch.ts`
- Cached `listApps` reader (`listAppsCached`) at `src/lib/apps/registry.ts` with 5s TTL + invalidation hooks
- `instantiateBlueprint` extended with optional `metadata: { _contextRowId? }` parameter
- Engine reads `_contextRowId` from workflow definition and stamps `tasks.context_row_id`
- Two real blueprints: `customer-follow-up-drafter--draft-followup`, `research-digest--weekly-digest`
- Phase 4 smoke manifests updated to canonical qualified-id + source-pointer pattern
- 8+ unit tests, 1 integration test, 1 browser smoke

## Verification run — 2026-05-02

(Filled in during Wave 8 — task id, runtime used, outcome, screenshots)

## References

- Design spec: `docs/superpowers/specs/2026-05-02-row-trigger-blueprint-execution-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-02-row-trigger-blueprint-execution.md`
- Phase 4: `features/composed-app-kit-inbox-and-research.md`
- CLAUDE.md "Smoke-test budget for runtime-registry-adjacent features"
```

- [ ] **Step 2: Update Phase 4 spec verification-run note.** Append to "Verification run — 2026-05-02" in `features/composed-app-kit-inbox-and-research.md`:

```markdown
**Update (Phase 5):** the smoke manifests' broken blueprint references (`draft-followup`, `weekly-digest`) were resolved in the follow-up `row-trigger-blueprint-execution` feature, which authored the real blueprints and updated the manifests to the canonical qualified-id + source-pointer pattern.
```

- [ ] **Step 3: Commit.**

```bash
git add features/row-trigger-blueprint-execution.md features/composed-app-kit-inbox-and-research.md
git commit -m "docs(features): row-trigger-blueprint-execution shipped

Feature spec with status: completed + verification-run section.
Cross-references Phase 4's broken-reference smoke manifests now fixed.

Part of: row-trigger-blueprint-execution"
```

### Task 9.2: Update HANDOFF.md and archive predecessor

**Files:** Archive current HANDOFF; overwrite with Phase 5 shipped handoff.

- [ ] **Step 1: Archive prior HANDOFF.**

```bash
cp HANDOFF.md .archive/handoff/2026-05-02-row-trigger-blueprint-execution-pre-shipped-handoff.md
```

- [ ] **Step 2: Write new HANDOFF.** Topics:
- Status: shipped, all tests green, browser smoke complete
- Next pickup: `composed-app-auto-inference-hardening` (the other Phase 4 follow-up) OR a new feature
- Carried-forward gaps: multi-step Inbox loader still uses LIMIT 1 + JOIN documents (acceptable for single-step blueprints)
- Patterns to remember: `await import()` for runtime-registry-adjacent files, `{{row.<col>}}` blueprint variable convention now established

- [ ] **Step 3: Commit.**

```bash
git add HANDOFF.md .archive/handoff/2026-05-02-row-trigger-blueprint-execution-pre-shipped-handoff.md
git commit -m "docs(handoff): row-trigger-blueprint-execution shipped

Phase 5 follow-up complete. Browser smoke verified the engine.ts
touch passed CLAUDE.md's runtime-registry rule (no ReferenceError,
no module-load cycle). Next pickup: composed-app-auto-inference-
hardening or a new feature."
```

---

## Self-review checklist

After all 19 tasks:

1. **Spec coverage:** every locked design decision in the spec has a task. ✓
2. **Placeholder scan:** no TBDs, no "implement later", every step has actual code or command. ✓
3. **Type consistency:** `_contextRowId` (with underscore prefix) used uniformly across instantiator + engine + dispatcher; `tasks.contextRowId` (camelCase) is the Drizzle field name; `tasks.context_row_id` (snake_case) is the SQL column. ✓
4. **Smoke-test budget:** Wave 8 explicitly tests engine.ts changes via real browser. ✓
5. **Error registry coverage:** rows 1, 2, 3, 4, 7 → tests; rows 5, 6, 8, 9 → smoke + spec doc.

If any of these breaks during implementation, fix inline and continue.

---

## Verification — final

After Wave 9:

```bash
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -5
git log --oneline | head -25  # ~17-19 commits since spec commit
```

Expected: all tests green, tsc clean, browser smoke screenshots in `output/phase-5-*.png`, handoff overwritten.
