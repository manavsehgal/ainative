# Composed App Auto-Inference Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the column-shape probes feeding `pickKit`'s decision table by adding two new probes (`hasNotificationShape`, `hasMessageShape`), extend `rule5_inbox` to optionally consult hero-table shape, and expand the inference test matrix with negative + conjunction + edge cases plus a golden-master lock for every shipped starter app.

**Architecture:** Pure-function additions to `src/lib/apps/view-kits/inference.ts`. Two new probes follow the existing tiered-match pattern (`semantic` → `type` → name regex). `rule5_inbox` gains an optional `schemas` parameter; when provided, the rule fires on hero-table shape OR blueprint id (existing behavior preserved when `schemas` is omitted, but `pickKit` always passes it). All changes are additive: zero changes to persistence, no migrations, no new types beyond the loose `semantic?: string` field already defined on `ColumnSchemaRef`.

**Tech Stack:** TypeScript, Vitest. No Next.js, no DB, no runtime adapters.

**Spec source:** `features/composed-app-auto-inference-hardening.md` (status: planned at plan time).

**Scope:** REDUCE per scope challenge. v1 = probe completion + test matrix expansion only. Diagnostics route, trace API, settings toggle, and copy-as-view generator are explicitly deferred to a follow-up feature gated on a real misfire report.

---

## NOT in scope

| Deferred | Why deferred |
|----------|--------------|
| `/apps/[id]/inference` diagnostics route | Diagnostic UX, not behavior change. Speculative until a misfire report exists. Spec wants 3-4× LOC for a tool that may never be hit; defer to follow-up feature gated on field signal. |
| `pickKit({trace: true})` overload + `InferenceTrace` type | Trace API is consumed only by the deferred diagnostics page. Designing it without a real failing case in hand risks getting the shape wrong. |
| `apps.showInferenceDiagnostics` settings toggle | Gates the deferred diagnostics route. No route → no setting. |
| "Copy as `view:` field" generator button | Surface on the deferred diagnostics page. Defer with the route. |
| Persisting `column.config.semantic` through chat tools / column edit UI | Today probes read `c.semantic` from the inference-time projection; persistence isn't wired and isn't required for the probe path to harden. Spec calls this "opt-in"; no current writer exists. |
| Tightening `Semantic` to a TypeScript union (`"currency" \| "date" \| ...`) | Current shape is `semantic?: string`. Tightening would force migration of every `ColumnSchemaRef` callsite. Loose string is forgiving and the probes do exact equality checks anyway. Defer until persistence lands. |
| Adding new kit ids or rules | Spec explicitly caps at 6 kits + 6 rules. Hardening tightens probes only. |
| Telemetry-driven kit selection | Anti-pattern per spec. |
| Auto-migrating existing column configs to add `semantic` | Opt-in only per spec. |
| Manifest authoring UX in chat | Separate feature: `composed-app-manifest-authoring-tools`. |
| LLM-based "explain why this kit" | Trace is mechanical, not generative — and trace itself is deferred. |

---

## What already exists (do NOT rebuild)

| Artifact | Location | Status |
|----------|----------|--------|
| `pickKit(manifest, columnSchemas): KitId` | `src/lib/apps/view-kits/inference.ts:14` | First-match-wins decision table over 6 rules. Keep as-is; only `rule5_inbox` call site updates. |
| `hasCurrency`, `hasDate`, `hasBoolean` probes | `src/lib/apps/view-kits/inference.ts:90-114` | Already use tiered match (semantic → type → name regex). Pattern to mirror in new probes. |
| `CURRENCY_NAME_RE`, `DATE_NAME_RE`, `BOOLEAN_NAME_RE` | `src/lib/apps/view-kits/inference.ts:83-85` | Module-level regex constants. New regexes follow same convention. |
| `INBOX_BLUEPRINT_RE` | `src/lib/apps/view-kits/inference.ts:88` | Already includes `notification\|message\|follow-up\|drafter\|inbox\|triage`. Rule5 today consults this. New shape probes complement (don't replace) it. |
| `ColumnSchemaRef.columns[].semantic?: string` | `src/lib/apps/view-kits/types.ts:32` | Loose `string` type. Probes check exact equality (`=== "notification"`). No tightening required. |
| Existing probe tests | `src/lib/apps/view-kits/__tests__/inference.test.ts:33-64` | 6 tests for hasCurrency/hasDate/hasBoolean. New probes mirror this shape. |
| Per-rule unit tests | `src/lib/apps/view-kits/__tests__/inference.test.ts:66-186` | 18 tests covering rules 1-6 with positive + some negative cases. Plan extends with conjunction + near-miss negatives. |
| Starter-app golden-master tests | `src/lib/apps/view-kits/__tests__/inference.test.ts:239-360` | 6 fixtures: habit-tracker, weekly-portfolio-check-in, customer-follow-up-drafter, research-digest, finance-pack, reading-radar. Plan audits gaps and locks down. |
| Plan format precedent | `docs/superpowers/plans/2026-05-02-profile-runtime-default-resolution.md` | Same structure (NOT in scope, What already exists, tasks with TDD steps, verification table). |

---

## Pre-flight starter audit (proves rule5 extension is regression-safe)

Before extending `rule5_inbox`, audit the 5 shipped starters' hero columns against the new `hasNotificationShape` + `hasMessageShape` predicates. Any starter where the extended rule5 would fire AND that starter's current expected kit is NOT `inbox` would mean the extension flips kit selection. The audit:

| Starter | Hero columns | Notification shape? | Message shape? | Currently selected by | Risk |
|---------|--------------|---------------------|----------------|-----------------------|------|
| habit-tracker | habit, category, frequency, current_streak, best_streak, start_date, active | ✗ | ✗ | rule2_tracker | none |
| weekly-portfolio-check-in | ticker, qty, account | ✗ | ✗ | rule4_coach | none |
| customer-follow-up-drafter | channel, customer, summary, sentiment | ✗ | ✓ (`summary`) | rule5_inbox (blueprint id) | already inbox — no flip |
| research-digest | name, url, cadence | ✗ | ✗ | rule3_research | none |
| finance-pack | date, amount, category | ✗ | ✗ | rule1_ledger | none |
| reading-radar | title, url, date, completed, notes | ✗ | ✓ (`notes`)? | rule2_tracker (rule2 fires before rule5) | rule2 still wins by ordering — no flip |

Conclusion: the rule5 extension cannot flip any shipped starter. Golden-master tests in Task 7 verify.

---

## Error & Rescue Registry

| Failure mode | Surface | Recovery |
|--------------|---------|----------|
| New probe matches a starter's hero column unintentionally | Test failure in Task 7 golden-master fixture | Tighten the probe regex (e.g., add `(^|_)` boundaries) to exclude the false positive; re-run tests. |
| `rule5_inbox` extension flips a starter's kit | Test failure in Task 7 golden-master fixture | Either tighten new probes OR keep rule5 blueprint-only and emit a separate inbox-shape rule at lower precedence — re-evaluate during impl. |
| `c.semantic === "X"` accepts unknown values silently | No surface (loose `string` type) | Acceptable — probe is exact-equality, unknown semantics simply don't match. Tightening to a union deferred (see NOT in scope). |
| TypeScript signature change in `rule5_inbox` breaks external callers | `npx tsc --noEmit` failure | Only caller is `pickKit` itself (verified by grep before commit). Update both in same commit (Task 3). |

**No smoke-test step required.** This plan touches `src/lib/apps/view-kits/inference.ts` and its test file only — none of the runtime-registry-adjacent modules listed in CLAUDE.md (`claude-agent.ts`, `runtime/*.ts`, `engine.ts`, `loop-executor.ts`, modules importing `@/lib/chat/ainative-tools`). Module-load cycle risk is zero. Unit tests are sufficient verification.

---

## Files touched

| File | Change | Lines (approx) |
|------|--------|----------------|
| `src/lib/apps/view-kits/inference.ts` | Add 2 probes + 2 regex constants; extend `rule5_inbox` signature & body; pass `schemas` to rule5 in `pickKit` | +30 |
| `src/lib/apps/view-kits/__tests__/inference.test.ts` | Add ~12-15 tests across probes / per-rule negatives / conjunctions / golden-masters | +200 |
| `features/composed-app-auto-inference-hardening.md` | Update status frontmatter + acceptance-criteria checkboxes for shipped items only | +/- 10 |

---

## Task list

### Task 1: Add `hasNotificationShape` probe (TDD)

**Files:**
- Modify: `src/lib/apps/view-kits/inference.ts` (add probe + regex; export probe)
- Modify: `src/lib/apps/view-kits/__tests__/inference.test.ts` (add tests)

- [ ] **Step 1.1: Write failing tests for `hasNotificationShape`**

Append to `src/lib/apps/view-kits/__tests__/inference.test.ts` inside the `describe("column-shape probes", ...)` block:

```ts
  it("hasNotificationShape: matches semantic=notification", () => {
    expect(hasNotificationShape([{ name: "x", semantic: "notification" }])).toBe(true);
  });
  it("hasNotificationShape: matches name patterns", () => {
    expect(hasNotificationShape([{ name: "read" }])).toBe(true);
    expect(hasNotificationShape([{ name: "unread" }])).toBe(true);
    expect(hasNotificationShape([{ name: "seen" }])).toBe(true);
    expect(hasNotificationShape([{ name: "is_read" }])).toBe(true);
    expect(hasNotificationShape([{ name: "delivered_at" }])).toBe(false); // date-shaped, not notification
    expect(hasNotificationShape([{ name: "notified" }])).toBe(true);
  });
  it("hasNotificationShape: ignores neutral columns", () => {
    expect(hasNotificationShape([{ name: "title" }, { name: "amount" }])).toBe(false);
  });
  it("hasNotificationShape: does NOT match substrings inside larger words", () => {
    // "ready", "spread", "seenname" should not falsely match
    expect(hasNotificationShape([{ name: "ready_state" }])).toBe(false);
    expect(hasNotificationShape([{ name: "spreadsheet" }])).toBe(false);
  });
```

Add `hasNotificationShape` to the existing import statement at the top of the file:

```ts
import {
  hasBoolean,
  hasCurrency,
  hasDate,
  hasNotificationShape, // NEW
  pickKit,
  rule1_ledger,
  rule2_tracker,
  rule3_research,
  rule4_coach,
  rule5_inbox,
  rule6_multiBlueprint,
} from "../inference";
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: tests fail with `hasNotificationShape is not a function` (or `is not exported from "../inference"`).

- [ ] **Step 1.3: Implement `hasNotificationShape` and the regex**

In `src/lib/apps/view-kits/inference.ts`, add the regex constant alongside existing ones (after `BOOLEAN_NAME_RE` at line ~85):

```ts
const NOTIFICATION_NAME_RE = /(^|_)(read|unread|seen|notified|notification)(_|$)/i;
```

Add the probe function after `hasBoolean` (after line ~113):

```ts
export function hasNotificationShape(cols: Col[]): boolean {
  return cols.some(
    (c) => c.semantic === "notification" || NOTIFICATION_NAME_RE.test(c.name)
  );
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: all `hasNotificationShape` tests pass; existing tests still pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/apps/view-kits/inference.ts src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
feat(view-kits): add hasNotificationShape probe for inbox inference

Adds a tiered-match probe (semantic → name regex with word boundaries) for
notification-shaped columns. Used by the rule5_inbox extension in a
follow-up commit. Probe only — no rule wiring yet, so no behavior change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `hasMessageShape` probe (TDD)

**Files:**
- Modify: `src/lib/apps/view-kits/inference.ts`
- Modify: `src/lib/apps/view-kits/__tests__/inference.test.ts`

- [ ] **Step 2.1: Write failing tests**

Append inside the `describe("column-shape probes", ...)` block:

```ts
  it("hasMessageShape: matches semantic=message-body", () => {
    expect(hasMessageShape([{ name: "x", semantic: "message-body" }])).toBe(true);
  });
  it("hasMessageShape: matches name patterns", () => {
    expect(hasMessageShape([{ name: "body" }])).toBe(true);
    expect(hasMessageShape([{ name: "message" }])).toBe(true);
    expect(hasMessageShape([{ name: "subject" }])).toBe(true);
    expect(hasMessageShape([{ name: "summary" }])).toBe(true);
    expect(hasMessageShape([{ name: "draft_body" }])).toBe(true);
    expect(hasMessageShape([{ name: "email_subject" }])).toBe(true);
  });
  it("hasMessageShape: ignores neutral columns", () => {
    expect(hasMessageShape([{ name: "title" }, { name: "qty" }])).toBe(false);
  });
  it("hasMessageShape: does NOT match substrings inside larger words", () => {
    expect(hasMessageShape([{ name: "embodied" }])).toBe(false);
    expect(hasMessageShape([{ name: "anybody" }])).toBe(false);
  });
```

Add `hasMessageShape` to the import statement.

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: tests fail with `hasMessageShape is not a function`.

- [ ] **Step 2.3: Implement `hasMessageShape` and the regex**

In `src/lib/apps/view-kits/inference.ts`, after `NOTIFICATION_NAME_RE`:

```ts
const MESSAGE_NAME_RE = /(^|_)(body|message|subject|summary|content)(_|$)/i;
```

Add the probe after `hasNotificationShape`:

```ts
export function hasMessageShape(cols: Col[]): boolean {
  return cols.some(
    (c) => c.semantic === "message-body" || MESSAGE_NAME_RE.test(c.name)
  );
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: all `hasMessageShape` tests pass; previously green tests still green.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/apps/view-kits/inference.ts src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
feat(view-kits): add hasMessageShape probe for inbox inference

Tiered-match probe (semantic → name regex with word boundaries) for
message-body-shaped columns. Used by rule5_inbox extension in next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Extend `rule5_inbox` to consult hero-table shape

**Files:**
- Modify: `src/lib/apps/view-kits/inference.ts:69-71` (rule5 signature + body); line ~26 (`pickKit` call site)
- Modify: `src/lib/apps/view-kits/__tests__/inference.test.ts` (extend rule5 tests; add starter regression tests)

- [ ] **Step 3.1: Write failing tests for the rule5 extension**

In the `describe("rule5_inbox — drafter / follow-up / inbox blueprint", ...)` block (line ~164), update the `cols` helper usage and add new tests. Append to the block:

```ts
  it("fires when hero has notification+message shape (no inbox blueprint id)", () => {
    const m = makeManifest({
      blueprints: [{ id: "process-rows" }],
      tables: [{ id: "t1" }],
    });
    expect(
      rule5_inbox(
        m,
        cols("t1", [{ name: "subject" }, { name: "body" }, { name: "read" }])
      )
    ).toBe(true);
  });
  it("does not fire on shape alone when only message shape present (no notification)", () => {
    const m = makeManifest({
      blueprints: [{ id: "process-rows" }],
      tables: [{ id: "t1" }],
    });
    expect(rule5_inbox(m, cols("t1", [{ name: "summary" }]))).toBe(false);
  });
  it("does not fire on shape alone when only notification shape present (no message)", () => {
    const m = makeManifest({
      blueprints: [{ id: "process-rows" }],
      tables: [{ id: "t1" }],
    });
    expect(rule5_inbox(m, cols("t1", [{ name: "read" }]))).toBe(false);
  });
  it("blueprint-id path still wins regardless of shape", () => {
    const m = makeManifest({ blueprints: [{ id: "follow-up-drafter" }] });
    expect(rule5_inbox(m, [])).toBe(true);
  });
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: failures show `rule5_inbox` is being called with 2 args but accepts only 1, OR shape-only path returns false (depending on TypeScript strictness mode).

- [ ] **Step 3.3: Update `rule5_inbox` signature and body**

In `src/lib/apps/view-kits/inference.ts`, replace lines 69-71:

```ts
export function rule5_inbox(
  m: AppManifest,
  schemas?: ColumnSchemaRef[]
): boolean {
  if (m.blueprints.some((b) => INBOX_BLUEPRINT_RE.test(b.id))) return true;
  if (!schemas) return false;
  const heroId = m.tables[0]?.id;
  if (!heroId) return false;
  const cols = lookupColumns(schemas, heroId);
  if (!cols) return false;
  return hasNotificationShape(cols) && hasMessageShape(cols);
}
```

Update the `pickKit` call site (line ~26) to pass `columnSchemas`:

```ts
  if (rule5_inbox(manifest, columnSchemas)) return "inbox";
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: all rule5 tests pass; existing pickKit / starter tests still green (Task 7 will lock that down explicitly).

- [ ] **Step 3.5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | rg "view-kits|inference"
```

Expected: no output (no errors in scope).

- [ ] **Step 3.6: Commit**

```bash
git add src/lib/apps/view-kits/inference.ts src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
feat(view-kits): rule5_inbox consults hero-table shape

rule5_inbox now also fires when the hero table has BOTH notification-shape
AND message-shape columns, even without an inbox-style blueprint id. Both
predicates are required to avoid false positives on tables with only a
'summary' or only a 'read' column.

Existing blueprint-id path is preserved and remains the first check, so
behavior for all shipped starters is unchanged (verified by golden-master
fixtures in next commit).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Test matrix — explicit-semantic vs regex-only differentiation

**Files:**
- Modify: `src/lib/apps/view-kits/__tests__/inference.test.ts`

These tests prove the tiered-match precedence: a column with `semantic: "currency"` matches even when its name is unrelated, and a column with neutral `semantic` matches only via name regex.

- [ ] **Step 4.1: Write tests**

Append a new describe block after the existing `column-shape probes` block:

```ts
describe("column-shape probes — tiered match precedence", () => {
  it("hasCurrency: explicit semantic wins regardless of name", () => {
    expect(hasCurrency([{ name: "wibble", semantic: "currency" }])).toBe(true);
  });
  it("hasCurrency: name pattern wins when semantic is unset", () => {
    expect(hasCurrency([{ name: "monthly_revenue" }])).toBe(true);
  });
  it("hasCurrency: neither tier hits → false", () => {
    expect(hasCurrency([{ name: "wibble" }])).toBe(false);
  });
  it("hasDate: type=date wins regardless of semantic/name", () => {
    expect(hasDate([{ name: "wibble", type: "date" }])).toBe(true);
    expect(hasDate([{ name: "wibble", type: "datetime" }])).toBe(true);
  });
  it("hasDate: explicit semantic wins when type is unset", () => {
    expect(hasDate([{ name: "wibble", semantic: "date" }])).toBe(true);
  });
  it("hasBoolean: type=boolean wins regardless of name", () => {
    expect(hasBoolean([{ name: "wibble", type: "boolean" }])).toBe(true);
  });
});
```

- [ ] **Step 4.2: Run tests to verify they pass**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: 6 new tests pass. (No code change needed — these test existing behavior; they're locking in the contract.)

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
test(view-kits): lock tiered-match precedence for shape probes

Explicit assertions that semantic/type/regex tiers fire in the documented
order. Catches accidental tier swaps in future probe edits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Test matrix — per-rule negative near-misses

**Files:**
- Modify: `src/lib/apps/view-kits/__tests__/inference.test.ts`

Each new test asserts a manifest that LOOKS like it should match a rule but specifically doesn't. Catches over-eager probe regressions.

- [ ] **Step 5.1: Write tests**

Append a new describe block:

```ts
describe("decision table — per-rule negative near-misses", () => {
  // Rule 1 near-miss: currency column on a NON-hero table → should NOT fire.
  it("rule1_ledger: currency on a non-hero table does not fire", () => {
    const m = makeManifest({
      tables: [{ id: "t-hero" }, { id: "t-side" }],
      blueprints: [{ id: "bp" }],
    });
    expect(
      rule1_ledger(m, [
        { tableId: "t-hero", columns: [{ name: "title" }] },
        { tableId: "t-side", columns: [{ name: "amount" }] },
      ])
    ).toBe(false);
  });

  // Rule 2 near-miss: date alone (no boolean) does not fire.
  it("rule2_tracker: date without boolean does not fire", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      schedules: [{ id: "s" }],
    });
    expect(rule2_tracker(m, cols("t1", [{ name: "start_date" }]))).toBe(false);
  });

  // Rule 2 near-miss: boolean alone (no date) does not fire.
  it("rule2_tracker: boolean without date does not fire", () => {
    const m = makeManifest({
      tables: [{ id: "t1" }],
      schedules: [{ id: "s" }],
    });
    expect(rule2_tracker(m, cols("t1", [{ name: "completed" }]))).toBe(false);
  });

  // Rule 3 near-miss: schedule + non-document blueprint id does not fire.
  it("rule3_research: schedule + 'process-rows' blueprint does not fire", () => {
    const m = makeManifest({
      blueprints: [{ id: "process-rows" }],
      schedules: [{ id: "s" }],
    });
    expect(rule3_research(m)).toBe(false);
  });

  // Rule 4 near-miss: schedule + non-coach profile does not fire.
  it("rule4_coach: schedule + 'researcher' profile does not fire", () => {
    const m = makeManifest({
      profiles: [{ id: "researcher" }],
      schedules: [{ id: "s", runs: "profile:researcher" }],
    });
    expect(rule4_coach(m)).toBe(false);
  });

  // Rule 5 near-miss: drafter-shape blueprint id without "drafter" trigger word.
  it("rule5_inbox: blueprint 'weekly-review' does not fire on shape alone (no schemas)", () => {
    const m = makeManifest({ blueprints: [{ id: "weekly-review" }] });
    expect(rule5_inbox(m)).toBe(false);
  });

  // Rule 6 near-miss: 2 blueprints WITH a hero table does NOT fire (hero present).
  it("rule6_multiBlueprint: 2 blueprints WITH hero table does not fire", () => {
    const m = makeManifest({
      blueprints: [{ id: "a" }, { id: "b" }],
      tables: [{ id: "t1" }],
    });
    expect(rule6_multiBlueprint(m)).toBe(false);
  });
});
```

- [ ] **Step 5.2: Run tests to verify they pass**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: 7 new tests pass.

- [ ] **Step 5.3: Commit**

```bash
git add src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
test(view-kits): per-rule negative near-miss matrix

One near-miss assertion per rule covering the most likely false-positive
shape: rule1 currency-on-non-hero, rule2 date-without-boolean,
rule3 schedule-without-document-blueprint, rule4 schedule-without-coach,
rule5 weekly-review-without-shape, rule6 multi-blueprint-with-hero.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Test matrix — conjunction first-match-wins

**Files:**
- Modify: `src/lib/apps/view-kits/__tests__/inference.test.ts`

Conjunction tests prove the decision table's deterministic ordering: when N rules would all match, the lowest-numbered rule wins.

- [ ] **Step 6.1: Write tests**

Append to the existing `describe("pickKit — first-match-wins decision table", ...)` block (line ~209):

```ts
  it("ledger wins over inbox when both could fire", () => {
    // Hero has currency (rule1) AND notification+message shape (rule5)
    const m = makeManifest({
      tables: [{ id: "t1" }],
      blueprints: [{ id: "bp" }],
    });
    expect(
      pickKit(
        m,
        cols("t1", [
          { name: "amount" },
          { name: "subject" },
          { name: "body" },
          { name: "read" },
        ])
      )
    ).toBe("ledger");
  });

  it("research wins over coach when both could fire", () => {
    // schedule + digest blueprint (rule3) + coach profile (rule4)
    const m = makeManifest({
      profiles: [{ id: "weekly-coach" }],
      blueprints: [{ id: "weekly-digest" }],
      schedules: [{ id: "s" }],
    });
    expect(pickKit(m, [])).toBe("research");
  });

  it("inbox wins over multi-blueprint hub when both could fire", () => {
    // 2 blueprints, no hero table (rule6 trigger), but one blueprint matches inbox regex (rule5)
    const m = makeManifest({
      blueprints: [{ id: "follow-up-drafter" }, { id: "weekly-review" }],
      tables: [],
    });
    expect(pickKit(m, [])).toBe("inbox");
  });

  it("coach wins over inbox-shape when both could fire", () => {
    // Coach profile + schedule (rule4) AND hero with notification+message shape (rule5)
    const m = makeManifest({
      profiles: [{ id: "support-coach" }],
      schedules: [{ id: "s" }],
      tables: [{ id: "t1" }],
      blueprints: [{ id: "process-rows" }],
    });
    expect(
      pickKit(
        m,
        cols("t1", [{ name: "subject" }, { name: "body" }, { name: "read" }])
      )
    ).toBe("coach");
  });
```

- [ ] **Step 6.2: Run tests to verify they pass**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: 4 new conjunction tests pass.

- [ ] **Step 6.3: Commit**

```bash
git add src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
test(view-kits): conjunction first-match-wins matrix

Four new conjunction cases: ledger>inbox, research>coach, inbox>hub,
coach>inbox. Locks in the rule ordering against accidental shuffling.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Test matrix — golden-master starter audit (lock down)

**Files:**
- Modify: `src/lib/apps/view-kits/__tests__/inference.test.ts`

Audit the existing 6 starter-app fixtures (lines 239-360). For each, confirm:
1. The `expect(pickKit(...))` assertion still passes after the rule5 extension.
2. The fixture's hero columns reflect the actual seeded starter (as shipped).

This catches any unintentional flip from the rule5 hardening.

- [ ] **Step 7.1: Run the existing 6 starter tests as-is**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts -t "starter intent fixtures"
```

Expected: all 6 pass. If any fail, STOP and either tighten the new probe regexes or add a `view.kit` declaration to the failing starter manifest (document choice in commit message).

- [ ] **Step 7.2: Audit gap — verify no shipped starter is missing a fixture**

Compare `~/.ainative/apps/*/manifest.yaml` ids against the test fixtures:

```bash
ls ~/.ainative/apps/ | sort
```

Then compare to test ids. Currently expected (from existing tests): habit-tracker, weekly-portfolio-check-in, customer-follow-up-drafter, research-digest, finance-pack, reading-radar.

If a seeded app exists in `~/.ainative/apps/` without a corresponding fixture, add one. Use this template:

```ts
  it("<starter-id> → <expected-kit>", () => {
    const m = makeManifest({
      id: "<starter-id>",
      profiles: [/* from manifest profiles[] */],
      blueprints: [/* from manifest blueprints[] */],
      tables: [/* from manifest tables[] */],
      schedules: [/* from manifest schedules[] */],
    });
    const colMap: ColumnSchemaRef[] = [
      {
        tableId: "<hero-table-id>",
        columns: [/* from manifest tables[0].columns[] */],
      },
    ];
    expect(pickKit(m, colMap)).toBe("<expected-kit>");
  });
```

- [ ] **Step 7.3: Add explicit "no-match → workflow-hub fallback" tests**

Append to the `describe("pickKit — first-match-wins decision table", ...)` block (or as new block):

```ts
describe("pickKit — workflow-hub fallback (no rule matches)", () => {
  it("empty manifest falls through to workflow-hub", () => {
    expect(pickKit(makeManifest(), [])).toBe("workflow-hub");
  });
  it("manifest with only profiles falls through", () => {
    expect(pickKit(makeManifest({ profiles: [{ id: "x" }] }), [])).toBe("workflow-hub");
  });
  it("manifest with only one blueprint and no schedules/tables falls through", () => {
    expect(
      pickKit(makeManifest({ blueprints: [{ id: "lonely" }] }), [])
    ).toBe("workflow-hub");
  });
});
```

- [ ] **Step 7.4: Run all inference tests**

```bash
npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts
```

Expected: 100% pass (target 40+ tests after all additions; spec floor was 25-35).

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/apps/view-kits/__tests__/inference.test.ts
git commit -m "$(cat <<'EOF'
test(view-kits): golden-master audit + no-match fallback lock

Audited 6 shipped starter-app fixtures against the rule5 extension —
no flips. Added 3 no-match fallback assertions (empty manifest,
profiles-only, single-blueprint) to lock the workflow-hub fallback path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Final verification + spec status update

**Files:**
- Modify: `features/composed-app-auto-inference-hardening.md` (status + acceptance criteria for shipped scope only)

- [ ] **Step 8.1: Run full test suite**

```bash
npm test 2>&1 | tail -20
```

Expected: same pre-existing failures from the previous handoff (`router.test.ts`, `blueprint.test.ts`, `settings.test.ts`) — zero new failures.

- [ ] **Step 8.2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (exit 0).

- [ ] **Step 8.3: Update spec frontmatter and acceptance criteria**

Edit `features/composed-app-auto-inference-hardening.md`:

- Change `status: planned` → `status: in-progress` (because items 3+4 are deferred to a follow-up — leave `in-progress` so the deferred work stays visible)
- Check off these acceptance-criteria boxes:
  - `[x] hasCurrency, hasDate, hasBoolean, hasNotificationShape, hasMessageShape probes use tiered match (semantic → format → regex), with tests for each tier`
  - `[x] Inference test suite has ≥25 cases; positive + negative + conjunction + edge + golden-master coverage`
  - `[x] All existing starter apps still resolve to their expected kit (no regression)`
- Leave UNCHECKED (these are explicitly deferred to follow-up):
  - `userTableColumns.config.semantic is documented and accepted` (persistence not touched)
  - `pickKit(...).options.trace returns an InferenceTrace object` (trace API deferred)
  - `/apps/[id]/inference route renders the trace ...` (route deferred)
  - `Copy as view: field button ...` (deferred)
  - `Settings page has an apps.showInferenceDiagnostics toggle` (deferred)
  - `Unit tests for the trace serialization` (deferred)

Add a new line in the `## References` section near the bottom:

```md
- Implementation plan: `docs/superpowers/plans/2026-05-02-composed-app-auto-inference-hardening.md` (REDUCE scope: probes + test matrix only; diagnostics route + trace API deferred to follow-up feature gated on first reported misfire)
```

- [ ] **Step 8.4: Commit spec update**

```bash
git add features/composed-app-auto-inference-hardening.md
git commit -m "$(cat <<'EOF'
docs(features): hardening probes + test matrix shipped (REDUCE scope)

Probes hasNotificationShape and hasMessageShape land alongside an extended
rule5_inbox that consults hero-table shape. Test matrix grows to 40+
cases covering tiered-match precedence, per-rule negatives, conjunctions,
no-match fallback, and golden-master starter lock.

Diagnostics route, trace API, settings toggle, and copy-as-view generator
are deferred to a follow-up feature gated on first reported kit misfire —
spec acceptance criteria for those stays unchecked.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8.5: Final state check**

```bash
git log --oneline -10
git status
```

Expected: 8 commits ahead of pre-plan HEAD; working tree clean.

---

## Verification summary

| Check | Command | Expected |
|-------|---------|----------|
| Inference unit tests | `npx vitest run src/lib/apps/view-kits/__tests__/inference.test.ts` | All pass; ≥40 total tests |
| Full test suite | `npm test` | Same pre-existing 7 failures only; zero new |
| TypeScript | `npx tsc --noEmit` | No output |
| Starter regression | Embedded in inference.test.ts (Task 7.1) | All 6 starter fixtures still pick expected kit |
| No runtime cycle risk | Static-import inspection | inference.ts only imports `@/lib/apps/registry` types — never `chat/ainative-tools`. No smoke required. |

---

## Self-review (post-write checklist)

**1. Spec coverage** — Items in scope (probes + test matrix) all have tasks. Items NOT in scope (diagnostics route, trace API, settings, copy generator) are explicitly listed in "NOT in scope" with rationale. Persistence-layer `column.config.semantic` is also deferred.

**2. Placeholder scan** — No "TBD", "TODO", "fill in", or generic "add appropriate X" steps. Each step has verbatim test code, implementation code, or shell command.

**3. Type consistency** — `hasNotificationShape` and `hasMessageShape` use the same `Col[]` parameter shape as existing probes. `rule5_inbox(m, schemas?)` matches the optional pattern; `pickKit` callsite updated in same task. Test imports updated in same task as new exports.

**4. Smoke test budget** — Plan does not touch any runtime-registry-adjacent module (verified via grep at plan time). No smoke step required.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-composed-app-auto-inference-hardening.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks. Best for parallel-safe tasks (Tasks 4, 5, 6 are pure-test additions that don't depend on each other once Task 3 is in).

**2. Inline Execution** — Execute tasks in the current session using executing-plans, batch execution with checkpoints. Best for tight feedback loop with the user.

Which approach?
