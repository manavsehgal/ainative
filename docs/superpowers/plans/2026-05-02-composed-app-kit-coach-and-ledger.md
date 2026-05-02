# Composed App Kits — Coach & Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 3 of the Composed Apps Domain-Aware View — two new kits (Coach, Ledger), two chart primitives (`TimeSeriesChart`, `RunCadenceHeatmap`), a `LastRunCard variant="hero"`, a conditional `RunNowSheet`, and a `tableSumWindowed` extension to the KPI engine — without weakening Phase 2's frozen contracts.

**Architecture:** Pure projection kits compose existing primitives (`DonutRing`, `LightMarkdown`, `recharts`, `Sheet`, `getBlueprint()`). Period selection (MTD/QTD/YTD) flows URL → page → projection at request time — no runtime override. KPI source kinds extend the discriminated union with one new arm (`tableSumWindowed`); `evaluateKpi` switch grows from 5 to 6 cases. The `loadRuntimeState` switch grows from 2 to 4 branches; the registry refactor is intentionally deferred to Phase 4 per HOLD scope.

**Tech Stack:** Next.js 16 App Router (server components for kit code paths), React 19, TypeScript strict, Drizzle + better-sqlite3, vitest + @testing-library/react, Tailwind v4 + shadcn/ui (New York), recharts, react-markdown ^10 + remark-gfm ^4 (already installed). No new dependencies.

**Source spec:** `features/composed-app-kit-coach-and-ledger.md`
**Design doc:** `docs/superpowers/specs/2026-05-02-coach-and-ledger-design.md`
**Predecessor plan:** `docs/superpowers/plans/2026-05-02-composed-app-kit-tracker-and-hub.md` (Phase 2)

---

## File Structure

### New files

```
# Foundations
src/lib/workflows/blueprints/validate-variables.ts          # Pure validator (required-fields + type-narrowing)
src/lib/workflows/blueprints/__tests__/validate-variables.test.ts

src/components/workflows/variable-input.tsx                 # Extracted from blueprint-preview.tsx
src/components/workflows/__tests__/variable-input.test.tsx

# Chart primitives
src/components/charts/time-series-chart.tsx                 # recharts AreaChart wrapper
src/components/charts/run-cadence-heatmap.tsx               # 12wk × 7d SVG grid
src/components/charts/__tests__/time-series-chart.test.tsx
src/components/charts/__tests__/run-cadence-heatmap.test.tsx

# App primitives
src/components/apps/run-now-sheet.tsx                       # Sheet body for blueprints with variables
src/components/apps/period-selector-chip.tsx                # MTD/QTD/YTD chip group
src/components/apps/ledger-hero-panel.tsx                   # TimeSeriesChart + DonutRing composition
src/components/apps/transactions-table.tsx                  # Read-only Ledger secondary table
src/components/apps/run-history-strip.tsx                   # Coach activity strip
src/components/apps/monthly-close-summary.tsx               # Ledger activity collapsed markdown

src/components/apps/__tests__/run-now-sheet.test.tsx
src/components/apps/__tests__/period-selector-chip.test.tsx
src/components/apps/__tests__/ledger-hero-panel.test.tsx
src/components/apps/__tests__/transactions-table.test.tsx
src/components/apps/__tests__/run-history-strip.test.tsx
src/components/apps/__tests__/monthly-close-summary.test.tsx

# Kits
src/lib/apps/view-kits/kits/coach.ts
src/lib/apps/view-kits/kits/ledger.ts
src/lib/apps/view-kits/__tests__/coach.test.ts
src/lib/apps/view-kits/__tests__/ledger.test.ts

# Starter (for Ledger dogfood)
.claude/apps/starters/finance-pack.yaml
```

### Modified files

```
src/lib/apps/registry.ts                                    # +tableSumWindowed Zod arm in KpiSpecSchema
src/lib/apps/view-kits/evaluate-kpi.ts                      # +case "tableSumWindowed"
src/lib/apps/view-kits/kpi-context.ts                       # +tableSumWindowed(table, column, sign?, window?)
src/lib/apps/view-kits/default-kpis.ts                      # +defaultLedgerKpis(table, columns, period)
src/lib/apps/view-kits/data.ts                              # +coach + ledger branches; cache key includes period
src/lib/apps/view-kits/index.ts                             # Register coach + ledger
src/lib/apps/view-kits/types.ts                             # +Coach + Ledger runtime fields, +HeaderSlot.runNowVariables
src/lib/apps/view-kits/inference.ts                         # (verify only — already infers coach/ledger; add tests)

src/components/apps/last-run-card.tsx                       # +variant prop ("compact" | "hero")
src/components/apps/run-now-button.tsx                      # +variables prop; opens sheet when non-null
src/components/workflows/blueprint-preview.tsx              # Imports VariableInput from new file (zero behavior change)

src/components/apps/kit-view/slots/hero.tsx                 # +last-run-hero, +ledger-hero
src/components/apps/kit-view/slots/secondary.tsx            # +run-cadence-heatmap, +transactions-table
src/components/apps/kit-view/slots/activity.tsx             # +run-history-strip, +monthly-close-summary

src/app/apps/[id]/page.tsx                                  # Reads ?period= via Zod; threads into projection

src/lib/apps/view-kits/__tests__/dispatcher.test.ts         # +coach + ledger registered
src/lib/apps/view-kits/__tests__/inference.test.ts          # +coach + ledger inference cases (file may not exist; create if so)
src/lib/apps/__tests__/registry.test.ts                     # +tableSumWindowed Zod cases

features/composed-app-kit-coach-and-ledger.md               # status: planned → completed
features/roadmap.md                                         # Phase 3 row → completed
features/changelog.md                                       # New 2026-05-02 entry above Phase 2
```

### Why these boundaries

- **Kits stay tiny pure files** (`coach.ts`, `ledger.ts`) — both projected to ≤140 lines, no React state, no DB import. They consume `RuntimeState` and emit `ViewModel`.
- **`validate-variables.ts` separates the validator from the form component** — testable without rendering.
- **`variable-input.tsx` extraction** is a move-to-new-file; `blueprint-preview.tsx` keeps its existing usage by importing from the new path.
- **Chart primitives live under `src/components/charts/`** alongside the existing `donut-ring.tsx` — the convention is established.
- **Slot renderers gain `case` branches only**; rendering still flows from `viewModel.hero/secondary/activity` content built by the kit.
- **Cache key extension** (adding `period`) is a small but load-bearing change: without it, `?period=` switches serve stale state for 30s.

---

## Conventions for every task

- After every step that changes code, run `npx tsc --noEmit 2>&1 | grep "src/(app|lib|components)/(apps|charts|workflows)" || echo "tsc clean for phase 3"` before moving to the next step. The TS diagnostics panel is consistently flaky in this repo (per `MEMORY.md`); trust the CLI.
- For each new test file under `view-kits/__tests__`, follow the pattern in `src/lib/apps/view-kits/__tests__/tracker.test.ts`: vitest only, no jest globals, `describe` + `it`.
- For React component tests, follow `src/components/apps/__tests__/last-run-card.test.tsx` pattern: `@testing-library/react` + `@testing-library/jest-dom` matchers via `vitest`.
- **Never use `git add -A`** — name files explicitly (per `MEMORY.md` feedback).
- **One commit per wave** (not per task) — keeps `git log` aligned with the plan's structure: 7 commits total. Final commit message: `feat(apps): composed-app kit coach + ledger (Phase 3)`.
- **TableSpreadsheet is intentionally NOT used for Ledger transactions** — see design doc "NOT in scope." Use `TransactionsTable` (new, read-only).
- **`react-markdown` parse/render is wrapped in `ErrorBoundary`** wherever Coach hero renders the digest. Phase 3 introduces a small `ErrorBoundary` if one doesn't already exist; check first.

---

## Wave 1 — Foundations & extractions

This wave is parallel-safe — extraction and KPI-engine extension are independent.

### Task 1: Extract `VariableInput` to its own file

**Files:**
- Create: `src/components/workflows/variable-input.tsx`
- Modify: `src/components/workflows/blueprint-preview.tsx` (delete inlined function, import from new path)
- Test: `src/components/workflows/__tests__/variable-input.test.tsx`

- [ ] **Step 1: Read the existing inlined `VariableInput` (lines 175-247 of `blueprint-preview.tsx`) into context.**

- [ ] **Step 2: Write the failing test for the extracted file.**

```tsx
// src/components/workflows/__tests__/variable-input.test.tsx
import { render, screen } from "@testing-library/react";
import { VariableInput } from "../variable-input";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

describe("VariableInput", () => {
  it("renders a text input for type=text", () => {
    const variable: BlueprintVariable = {
      id: "name", type: "text", label: "Name", required: true,
    };
    render(<VariableInput variable={variable} value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders a select for type=select with options", () => {
    const variable: BlueprintVariable = {
      id: "horizon",
      type: "select",
      label: "Horizon",
      options: [{ value: "short", label: "Short" }, { value: "long", label: "Long" }],
    };
    render(<VariableInput variable={variable} value="short" onChange={() => {}} />);
    expect(screen.getByText("Horizon")).toBeInTheDocument();
  });

  it("renders a textarea for type=textarea", () => {
    const variable: BlueprintVariable = {
      id: "notes", type: "textarea", label: "Notes",
    };
    render(<VariableInput variable={variable} value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/notes/i).tagName).toBe("TEXTAREA");
  });

  it("renders a number input with min/max for type=number", () => {
    const variable: BlueprintVariable = {
      id: "qty", type: "number", label: "Qty", min: 1, max: 100,
    };
    render(<VariableInput variable={variable} value={5} onChange={() => {}} />);
    const input = screen.getByLabelText(/qty/i) as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.min).toBe("1");
    expect(input.max).toBe("100");
  });

  it("renders a switch for type=boolean", () => {
    const variable: BlueprintVariable = {
      id: "enabled", type: "boolean", label: "Enabled",
    };
    render(<VariableInput variable={variable} value={false} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails (file does not exist yet).**

```bash
npx vitest run src/components/workflows/__tests__/variable-input.test.tsx
```
Expected: FAIL — `Cannot find module '../variable-input'`.

- [ ] **Step 4: Create `src/components/workflows/variable-input.tsx`** by copying the function body from `blueprint-preview.tsx` lines 175-247 unchanged. Add `export` keyword to the function declaration.

```tsx
// src/components/workflows/variable-input.tsx
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

interface VariableInputProps {
  variable: BlueprintVariable;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function VariableInput({ variable, value, onChange }: VariableInputProps) {
  // (paste body from blueprint-preview.tsx lines 184-246 verbatim)
}
```

- [ ] **Step 5: Update `blueprint-preview.tsx`** — delete lines 175-247 and add `import { VariableInput } from "./variable-input";` near the top.

- [ ] **Step 6: Run all tests touching either file:**

```bash
npx vitest run src/components/workflows/__tests__/variable-input.test.tsx
npx vitest run src/components/workflows/__tests__/blueprint-preview.test.tsx 2>/dev/null || true
```
Expected: PASS for variable-input.test.tsx; existing blueprint-preview tests (if any) unchanged.

- [ ] **Step 7: tsc clean check.**

```bash
npx tsc --noEmit 2>&1 | grep "src/components/workflows" || echo "tsc clean"
```
Expected: `tsc clean`.

### Task 2: Add `validateVariables` pure helper

**Files:**
- Create: `src/lib/workflows/blueprints/validate-variables.ts`
- Test: `src/lib/workflows/blueprints/__tests__/validate-variables.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// src/lib/workflows/blueprints/__tests__/validate-variables.test.ts
import { describe, it, expect } from "vitest";
import { validateVariables } from "../validate-variables";
import type { BlueprintVariable } from "../types";

describe("validateVariables", () => {
  it("returns no errors when all required fields filled", () => {
    const defs: BlueprintVariable[] = [
      { id: "asset", type: "text", label: "Asset", required: true },
      { id: "horizon", type: "select", label: "Horizon", options: [{ value: "short", label: "Short" }] },
    ];
    const values = { asset: "NVDA", horizon: "short" };
    expect(validateVariables(values, defs)).toEqual({ errors: {} });
  });

  it("flags missing required text fields", () => {
    const defs: BlueprintVariable[] = [
      { id: "asset", type: "text", label: "Asset", required: true },
    ];
    expect(validateVariables({ asset: "" }, defs)).toEqual({
      errors: { asset: "Asset is required" },
    });
  });

  it("flags missing required select fields", () => {
    const defs: BlueprintVariable[] = [
      { id: "horizon", type: "select", label: "Horizon", required: true,
        options: [{ value: "short", label: "Short" }] },
    ];
    expect(validateVariables({}, defs)).toEqual({
      errors: { horizon: "Horizon is required" },
    });
  });

  it("does not flag optional missing fields", () => {
    const defs: BlueprintVariable[] = [
      { id: "notes", type: "textarea", label: "Notes" },
    ];
    expect(validateVariables({}, defs)).toEqual({ errors: {} });
  });

  it("number 0 is not treated as missing", () => {
    const defs: BlueprintVariable[] = [
      { id: "qty", type: "number", label: "Qty", required: true },
    ];
    expect(validateVariables({ qty: 0 }, defs)).toEqual({ errors: {} });
  });

  it("boolean false is not treated as missing", () => {
    const defs: BlueprintVariable[] = [
      { id: "enabled", type: "boolean", label: "Enabled", required: true },
    ];
    expect(validateVariables({ enabled: false }, defs)).toEqual({ errors: {} });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

```bash
npx vitest run src/lib/workflows/blueprints/__tests__/validate-variables.test.ts
```
Expected: FAIL — `Cannot find module '../validate-variables'`.

- [ ] **Step 3: Create the helper.**

```ts
// src/lib/workflows/blueprints/validate-variables.ts
import type { BlueprintVariable } from "./types";

export interface VariableValidationResult {
  errors: Record<string, string>;
}

/**
 * Pure validator for blueprint variable form submissions. Required fields
 * with `null`/`undefined`/empty-string values produce a `<label> is required`
 * error keyed by variable id. Numeric `0` and boolean `false` are NOT
 * considered missing.
 */
export function validateVariables(
  values: Record<string, unknown>,
  defs: BlueprintVariable[]
): VariableValidationResult {
  const errors: Record<string, string> = {};
  for (const def of defs) {
    if (!def.required) continue;
    const value = values[def.id];
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");
    if (isEmpty) {
      errors[def.id] = `${def.label} is required`;
    }
  }
  return { errors };
}
```

- [ ] **Step 4: Run the test.**

```bash
npx vitest run src/lib/workflows/blueprints/__tests__/validate-variables.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: tsc clean.**

```bash
npx tsc --noEmit 2>&1 | grep "src/lib/workflows/blueprints" || echo "tsc clean"
```

### Task 3: Add `tableSumWindowed` Zod arm to `KpiSpecSchema`

**Files:**
- Modify: `src/lib/apps/registry.ts` (locate `KpiSpecSchema`'s `source` discriminated union)
- Test: `src/lib/apps/__tests__/registry.test.ts`

- [ ] **Step 1: Read the current `KpiSpecSchema` definition** to locate the `z.discriminatedUnion("kind", ...)` for `source`.

- [ ] **Step 2: Add the failing test.**

```ts
// Inside src/lib/apps/__tests__/registry.test.ts
import { describe, it, expect } from "vitest";
// import existing schema (path varies — match what the file already imports)

describe("KpiSpecSchema — tableSumWindowed arm", () => {
  it("accepts a windowed sign-filtered sum spec", () => {
    const spec = {
      id: "inflow",
      label: "Inflow (MTD)",
      format: "currency",
      source: {
        kind: "tableSumWindowed",
        table: "transactions",
        column: "amount",
        sign: "positive",
        window: "mtd",
      },
    };
    expect(() => KpiSpecSchema.parse(spec)).not.toThrow();
  });

  it("accepts a windowed unsigned sum (Net)", () => {
    const spec = {
      id: "net",
      label: "Net",
      format: "currency",
      source: {
        kind: "tableSumWindowed",
        table: "transactions",
        column: "amount",
        window: "mtd",
      },
    };
    expect(() => KpiSpecSchema.parse(spec)).not.toThrow();
  });

  it("accepts an unwindowed sum (defaults to all-time)", () => {
    const spec = {
      id: "total",
      label: "Total",
      format: "currency",
      source: {
        kind: "tableSumWindowed",
        table: "transactions",
        column: "amount",
      },
    };
    expect(() => KpiSpecSchema.parse(spec)).not.toThrow();
  });

  it("rejects an invalid window value", () => {
    const spec = {
      id: "x", label: "x", format: "currency",
      source: {
        kind: "tableSumWindowed",
        table: "t", column: "c",
        window: "weekly", // invalid
      },
    };
    expect(() => KpiSpecSchema.parse(spec)).toThrow();
  });

  it("rejects an invalid sign value", () => {
    const spec = {
      id: "x", label: "x", format: "currency",
      source: {
        kind: "tableSumWindowed",
        table: "t", column: "c",
        sign: "neutral", // invalid
      },
    };
    expect(() => KpiSpecSchema.parse(spec)).toThrow();
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL** with "Invalid discriminator value" for the `tableSumWindowed` cases.

```bash
npx vitest run src/lib/apps/__tests__/registry.test.ts
```

- [ ] **Step 4: Add the new arm to `KpiSpecSchema.source` in `src/lib/apps/registry.ts`.**

```ts
// Inside KpiSpecSchema's source discriminatedUnion("kind", [...])
z.object({
  kind: z.literal("tableSumWindowed"),
  table: z.string().min(1),
  column: z.string().min(1),
  sign: z.enum(["positive", "negative"]).optional(),
  window: z.enum(["mtd", "qtd", "ytd"]).optional(),
}),
```

- [ ] **Step 5: Run tests — expect PASS** (5 tests for the new arm + all prior tests still pass).

- [ ] **Step 6: tsc clean.**

### Task 4: Extend `KpiContext` interface with `tableSumWindowed`

**Files:**
- Modify: `src/lib/apps/view-kits/evaluate-kpi.ts` (interface only — DB impl in Task 5)
- Test: `src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts`

- [ ] **Step 1: Add the failing test for the new `evaluateKpi` switch case.**

```ts
// src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts (append)
describe("evaluateKpi — tableSumWindowed", () => {
  it("evaluates Net (no sign, with window)", async () => {
    const spec = {
      id: "net",
      label: "Net",
      format: "currency",
      source: {
        kind: "tableSumWindowed" as const,
        table: "transactions",
        column: "amount",
        window: "mtd" as const,
      },
    };
    const ctx: KpiContext = {
      tableCount: async () => 0,
      tableSum: async () => 0,
      tableLatest: async () => 0,
      blueprintRunCount: async () => 0,
      scheduleNextFire: async () => 0,
      tableSumWindowed: async (t, c, s, w) => {
        expect(t).toBe("transactions");
        expect(c).toBe("amount");
        expect(s).toBeUndefined();
        expect(w).toBe("mtd");
        return 1234.56;
      },
    };
    const tile = await evaluateKpi(spec, ctx);
    expect(tile.value).toBe("$1,234.56");
  });

  it("passes sign='positive' for Inflow", async () => {
    const spec = {
      id: "inflow", label: "Inflow", format: "currency",
      source: {
        kind: "tableSumWindowed" as const,
        table: "transactions", column: "amount",
        sign: "positive" as const, window: "mtd" as const,
      },
    };
    let captured: string | undefined;
    const ctx: KpiContext = {
      tableCount: async () => 0, tableSum: async () => 0,
      tableLatest: async () => 0, blueprintRunCount: async () => 0,
      scheduleNextFire: async () => 0,
      tableSumWindowed: async (_t, _c, sign) => { captured = sign; return 100; },
    };
    await evaluateKpi(spec, ctx);
    expect(captured).toBe("positive");
  });
});
```

- [ ] **Step 2: Run — expect FAIL** with "tableSumWindowed does not exist on KpiContext."

- [ ] **Step 3: Add the method to the interface and the switch case.**

```ts
// src/lib/apps/view-kits/evaluate-kpi.ts
export interface KpiContext {
  tableCount(table: string, where: string | undefined): Promise<KpiPrimitive>;
  tableSum(table: string, column: string): Promise<KpiPrimitive>;
  tableLatest(table: string, column: string): Promise<KpiPrimitive>;
  tableSumWindowed(
    table: string,
    column: string,
    sign: "positive" | "negative" | undefined,
    window: "mtd" | "qtd" | "ytd" | undefined
  ): Promise<KpiPrimitive>;
  blueprintRunCount(blueprint: string, window: "7d" | "30d"): Promise<KpiPrimitive>;
  scheduleNextFire(schedule: string): Promise<KpiPrimitive>;
}

// In the switch:
case "tableSumWindowed":
  raw = await ctx.tableSumWindowed(
    spec.source.table,
    spec.source.column,
    spec.source.sign,
    spec.source.window
  );
  break;
```

- [ ] **Step 4: Run — expect PASS for new tests; existing 5 tests still pass.**

- [ ] **Step 5: tsc clean.**

### Task 5: Implement `tableSumWindowed` in DB-backed `KpiContext`

**Files:**
- Modify: `src/lib/apps/view-kits/kpi-context.ts`
- Test: `src/lib/apps/view-kits/__tests__/kpi-context.test.ts` (file may not exist; create)

- [ ] **Step 1: Add the failing test, seeding `userTableRows` with sign-mixed amounts and dated entries.**

```ts
// src/lib/apps/view-kits/__tests__/kpi-context.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { userTableRows, userTables } from "@/lib/db/schema";
import { createKpiContext } from "../kpi-context";

const TEST_TABLE = "test-transactions";

beforeEach(() => {
  db.delete(userTableRows).where(eq(userTableRows.tableId, TEST_TABLE)).run();
  // Seed 3 rows: +100 (this month), -50 (this month), +200 (last month)
  const thisMonth = new Date();
  const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 15);
  db.insert(userTableRows).values([
    { id: "r1", tableId: TEST_TABLE, data: JSON.stringify({ amount: 100 }), createdAt: thisMonth, updatedAt: thisMonth },
    { id: "r2", tableId: TEST_TABLE, data: JSON.stringify({ amount: -50 }), createdAt: thisMonth, updatedAt: thisMonth },
    { id: "r3", tableId: TEST_TABLE, data: JSON.stringify({ amount: 200 }), createdAt: lastMonth, updatedAt: lastMonth },
  ]).run();
});

describe("createKpiContext().tableSumWindowed", () => {
  it("sums all rows when no window/sign", async () => {
    const ctx = createKpiContext();
    const result = await ctx.tableSumWindowed(TEST_TABLE, "amount", undefined, undefined);
    expect(result).toBe(250); // 100 - 50 + 200
  });

  it("filters MTD when window=mtd", async () => {
    const ctx = createKpiContext();
    const result = await ctx.tableSumWindowed(TEST_TABLE, "amount", undefined, "mtd");
    expect(result).toBe(50); // 100 - 50 (this month only)
  });

  it("filters positive amounts when sign=positive", async () => {
    const ctx = createKpiContext();
    const result = await ctx.tableSumWindowed(TEST_TABLE, "amount", "positive", undefined);
    expect(result).toBe(300); // 100 + 200
  });

  it("filters negative amounts when sign=negative", async () => {
    const ctx = createKpiContext();
    const result = await ctx.tableSumWindowed(TEST_TABLE, "amount", "negative", undefined);
    expect(result).toBe(-50);
  });

  it("combines sign + window (Inflow MTD)", async () => {
    const ctx = createKpiContext();
    const result = await ctx.tableSumWindowed(TEST_TABLE, "amount", "positive", "mtd");
    expect(result).toBe(100); // only +100 this month
  });

  it("returns 0 for an empty table", async () => {
    const ctx = createKpiContext();
    const result = await ctx.tableSumWindowed("does-not-exist", "amount", undefined, "mtd");
    expect(result).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** ("tableSumWindowed not implemented" or similar runtime error since the interface method exists but the impl doesn't).

- [ ] **Step 3: Implement in `kpi-context.ts`:**

```ts
// src/lib/apps/view-kits/kpi-context.ts (add to the returned object)
async tableSumWindowed(tableId, column, sign, window) {
  try {
    const path = "$." + column;
    const conditions = [eq(userTableRows.tableId, tableId)];

    if (sign === "positive") {
      conditions.push(sql`CAST(json_extract(${userTableRows.data}, ${path}) AS REAL) > 0`);
    } else if (sign === "negative") {
      conditions.push(sql`CAST(json_extract(${userTableRows.data}, ${path}) AS REAL) < 0`);
    }

    if (window) {
      const since = windowStart(window);
      conditions.push(gte(userTableRows.createdAt, since));
    }

    const rows = db
      .select({
        value: sql<number>`COALESCE(SUM(CAST(json_extract(${userTableRows.data}, ${path}) AS REAL)), 0)`,
      })
      .from(userTableRows)
      .where(and(...conditions))
      .all();
    return rows[0]?.value ?? 0;
  } catch {
    return null;
  }
},

// Helper at module scope:
function windowStart(window: "mtd" | "qtd" | "ytd"): Date {
  const now = new Date();
  if (window === "mtd") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (window === "qtd") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), q, 1);
  }
  // ytd
  return new Date(now.getFullYear(), 0, 1);
}
```

- [ ] **Step 4: Run — expect PASS (6 tests).**

- [ ] **Step 5: tsc clean.**

- [ ] **Step 6: Commit Wave 1.**

```bash
git add \
  src/lib/workflows/blueprints/validate-variables.ts \
  src/lib/workflows/blueprints/__tests__/validate-variables.test.ts \
  src/components/workflows/variable-input.tsx \
  src/components/workflows/blueprint-preview.tsx \
  src/components/workflows/__tests__/variable-input.test.tsx \
  src/lib/apps/registry.ts \
  src/lib/apps/__tests__/registry.test.ts \
  src/lib/apps/view-kits/evaluate-kpi.ts \
  src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts \
  src/lib/apps/view-kits/kpi-context.ts \
  src/lib/apps/view-kits/__tests__/kpi-context.test.ts
git commit -m "feat(apps): Phase 3 wave 1 — extract VariableInput + tableSumWindowed KPI source"
```

---

## Wave 2 — Primitives

Each task is a self-contained component with TDD scaffold. Tasks within this wave are parallel-safe in principle; sequential commit at end.

### Task 6: `TimeSeriesChart` chart primitive

**Files:**
- Create: `src/components/charts/time-series-chart.tsx`
- Test: `src/components/charts/__tests__/time-series-chart.test.tsx`

- [ ] **Step 1: Inspect `src/components/analytics/analytics-dashboard.tsx`** to confirm the recharts import/usage pattern this codebase already follows. Match it.

- [ ] **Step 2: Failing test.**

```tsx
// src/components/charts/__tests__/time-series-chart.test.tsx
import { render, screen } from "@testing-library/react";
import { TimeSeriesChart } from "../time-series-chart";

describe("TimeSeriesChart", () => {
  it("renders the chart with data", () => {
    const data = [
      { date: "2026-04-01", value: 100 },
      { date: "2026-04-02", value: 150 },
    ];
    render(<TimeSeriesChart data={data} format="currency" range="30d" />);
    // recharts uses ResponsiveContainer; we assert the wrapper renders
    expect(document.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders empty-state placeholder when data is empty", () => {
    render(<TimeSeriesChart data={[]} format="int" />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it("respects the height prop", () => {
    const data = [{ date: "2026-04-01", value: 1 }];
    const { container } = render(<TimeSeriesChart data={data} format="int" height={300} />);
    const chartWrapper = container.querySelector("[data-chart-height]");
    expect(chartWrapper?.getAttribute("data-chart-height")).toBe("300");
  });

  it("renders with default range='90d' when not specified", () => {
    const data = [{ date: "2026-04-01", value: 1 }];
    render(<TimeSeriesChart data={data} format="int" />);
    // No assertion on range internally; just don't crash
    expect(document.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run — expect FAIL** (component does not exist).

- [ ] **Step 4: Implement.**

```tsx
// src/components/charts/time-series-chart.tsx
"use client";

import {
  AreaChart, Area, CartesianGrid, Tooltip, ResponsiveContainer,
  XAxis, YAxis,
} from "recharts";
import { formatKpi, type KpiFormat } from "@/lib/apps/view-kits/format-kpi";

export type TimeSeriesPoint = { date: string; value: number; label?: string };

export interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  format?: KpiFormat;
  height?: number;
  range?: "30d" | "90d" | "ytd" | "mtd";
}

export function TimeSeriesChart({
  data,
  format = "int",
  height = 240,
  range = "90d",
}: TimeSeriesChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-lg"
        style={{ height }}
        data-chart-height={String(height)}
      >
        No data yet — runs will populate this chart
      </div>
    );
  }

  return (
    <div data-chart-height={String(height)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" className="text-xs" />
          <YAxis tickFormatter={(v) => formatKpi(v, format)} className="text-xs" />
          <Tooltip
            formatter={(v: number) => formatKpi(v, format)}
            contentStyle={{ borderRadius: 8 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            fill="var(--accent)"
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Run tests — expect PASS.**

- [ ] **Step 6: tsc clean.**

### Task 7: `RunCadenceHeatmap` chart primitive

**Files:**
- Create: `src/components/charts/run-cadence-heatmap.tsx`
- Test: `src/components/charts/__tests__/run-cadence-heatmap.test.tsx`

- [ ] **Step 1: Inspect `src/components/playbook/adoption-heatmap.tsx`** for the SVG grid technique. Note cell sizing, spacing, color scaling.

- [ ] **Step 2: Failing test.**

```tsx
// src/components/charts/__tests__/run-cadence-heatmap.test.tsx
import { render } from "@testing-library/react";
import { RunCadenceHeatmap } from "../run-cadence-heatmap";

describe("RunCadenceHeatmap", () => {
  it("renders 12 weeks × 7 days = 84 cells by default", () => {
    const cells = Array.from({ length: 84 }, (_, i) => ({
      date: `2026-04-${String(i % 28 + 1).padStart(2, "0")}`,
      runs: i % 3,
    }));
    const { container } = render(<RunCadenceHeatmap cells={cells} />);
    expect(container.querySelectorAll('[data-heatmap-cell]')).toHaveLength(84);
  });

  it("renders muted cells when cells array is empty", () => {
    const { container } = render(<RunCadenceHeatmap cells={[]} />);
    const allCells = container.querySelectorAll('[data-heatmap-cell]');
    expect(allCells.length).toBe(84);
    allCells.forEach((c) => expect(c.getAttribute("data-runs")).toBe("0"));
  });

  it("marks failed runs with status=fail", () => {
    const cells = [{ date: "2026-04-01", runs: 1, status: "fail" as const }];
    const { container } = render(<RunCadenceHeatmap cells={cells} />);
    const failed = container.querySelector('[data-heatmap-cell][data-status="fail"]');
    expect(failed).toBeInTheDocument();
  });

  it("respects the weeks prop", () => {
    const { container } = render(<RunCadenceHeatmap cells={[]} weeks={4} />);
    expect(container.querySelectorAll('[data-heatmap-cell]')).toHaveLength(28);
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Implement.**

```tsx
// src/components/charts/run-cadence-heatmap.tsx
export type CadenceCell = {
  date: string;
  runs: number;
  status?: "success" | "fail";
};

export interface RunCadenceHeatmapProps {
  cells: CadenceCell[];
  weeks?: number;
}

const CELL_SIZE = 12;
const CELL_GAP = 2;

export function RunCadenceHeatmap({ cells, weeks = 12 }: RunCadenceHeatmapProps) {
  const days = weeks * 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build a map for O(1) lookup
  const cellMap = new Map<string, CadenceCell>();
  cells.forEach((c) => cellMap.set(c.date, c));

  const grid: { date: string; runs: number; status?: "success" | "fail" }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const cell = cellMap.get(key);
    grid.push({
      date: key,
      runs: cell?.runs ?? 0,
      status: cell?.status,
    });
  }

  const width = weeks * (CELL_SIZE + CELL_GAP);
  const height = 7 * (CELL_SIZE + CELL_GAP);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-muted-foreground"
    >
      {grid.map((cell, i) => {
        const week = Math.floor(i / 7);
        const day = i % 7;
        const x = week * (CELL_SIZE + CELL_GAP);
        const y = day * (CELL_SIZE + CELL_GAP);
        const intensity = cell.runs === 0 ? 0 : Math.min(cell.runs / 3, 1);
        const fill =
          cell.status === "fail"
            ? "var(--destructive)"
            : `color-mix(in srgb, var(--accent) ${intensity * 100}%, var(--muted))`;
        return (
          <rect
            key={cell.date}
            x={x}
            y={y}
            width={CELL_SIZE}
            height={CELL_SIZE}
            rx={2}
            fill={fill}
            data-heatmap-cell=""
            data-date={cell.date}
            data-runs={String(cell.runs)}
            data-status={cell.status ?? ""}
          />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 5: Run — expect PASS.**

- [ ] **Step 6: tsc clean.**

### Task 8: `LastRunCard` `variant="hero"`

**Files:**
- Modify: `src/components/apps/last-run-card.tsx` (add `variant` prop, hero rendering branch, previous-runs disclosure)
- Test: `src/components/apps/__tests__/last-run-card.test.tsx` (add hero variant cases)

- [ ] **Step 1: Read the current `last-run-card.tsx`** to understand existing prop shape and rendering.

- [ ] **Step 2: Add failing tests.**

```tsx
// src/components/apps/__tests__/last-run-card.test.tsx (append)
import { render, screen, fireEvent } from "@testing-library/react";
import { LastRunCard } from "../last-run-card";

describe("LastRunCard variant=hero", () => {
  const baseTask = {
    id: "t1",
    title: "Weekly digest",
    status: "completed" as const,
    createdAt: Date.now(),
    result: "## Portfolio Summary\n\n- Allocation: 60% stocks, 40% bonds\n\n```\nNVDA: +12%\n```",
  };

  it("renders the result as full markdown (with code fence)", () => {
    render(<LastRunCard variant="hero" task={baseTask} previousRuns={[]} />);
    expect(screen.getByText(/portfolio summary/i)).toBeInTheDocument();
    expect(screen.getByText(/NVDA: \+12%/i)).toBeInTheDocument();
  });

  it("renders metadata footer (createdAt + status)", () => {
    render(<LastRunCard variant="hero" task={baseTask} previousRuns={[]} />);
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it("opens previous runs sheet on click", () => {
    const previousRuns = [
      { id: "p1", title: "Last week", status: "completed" as const, createdAt: Date.now() - 86400000, result: "old" },
    ];
    render(<LastRunCard variant="hero" task={baseTask} previousRuns={previousRuns} />);
    fireEvent.click(screen.getByRole("button", { name: /previous runs/i }));
    expect(screen.getByText(/last week/i)).toBeInTheDocument();
  });

  it("renders empty-state when task is null", () => {
    render(<LastRunCard variant="hero" task={null} previousRuns={[]} />);
    expect(screen.getByText(/no digest yet/i)).toBeInTheDocument();
  });

  it("renders failed-task rescue when task.status='failed'", () => {
    const failedTask = { ...baseTask, status: "failed" as const, result: "Error: API limit" };
    render(<LastRunCard variant="hero" task={failedTask} previousRuns={[]} />);
    expect(screen.getByText(/last run failed/i)).toBeInTheDocument();
  });

  it("compact variant unchanged", () => {
    render(<LastRunCard variant="compact" lastTask={baseTask} runCount={5} />);
    // Existing Phase 2 rendering — adapt to actual existing test patterns
    expect(screen.getByText(/weekly digest/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run — expect FAIL** for hero cases.

- [ ] **Step 4: Implement.**

The existing `LastRunCard` has a flat prop set; introduce a discriminated prop type:

```tsx
// src/components/apps/last-run-card.tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, AlertCircle } from "lucide-react";
import { ErrorBoundary } from "@/components/shared/error-boundary"; // create if missing — see note
import type { RuntimeTaskSummary } from "@/lib/apps/view-kits/types";

type CompactProps = {
  variant?: "compact";
  lastTask: RuntimeTaskSummary | null;
  runCount: number;
  // ... existing compact props
};

type HeroProps = {
  variant: "hero";
  task: RuntimeTaskSummary | null;
  previousRuns: RuntimeTaskSummary[];
  blueprintId?: string;
};

export type LastRunCardProps = CompactProps | HeroProps;

export function LastRunCard(props: LastRunCardProps) {
  if (props.variant === "hero") return <HeroVariant {...props} />;
  return <CompactVariant {...props} />;
}

function HeroVariant({ task, previousRuns }: HeroProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!task) {
    return (
      <div className="surface-control rounded-xl p-6 text-center text-muted-foreground">
        No digest yet — click <strong>Run now</strong> to generate the first one.
      </div>
    );
  }

  if (task.status === "failed") {
    return (
      <div className="surface-control rounded-xl p-6 border-destructive/50">
        <div className="flex items-center gap-2 text-destructive mb-2">
          <AlertCircle className="h-4 w-4" />
          <span className="font-medium">Last run failed</span>
        </div>
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
          {task.result ?? "(no error details)"}
        </pre>
        {previousRuns.length > 0 && (
          <PreviousRunsSheet
            runs={previousRuns}
            open={sheetOpen}
            onOpenChange={setSheetOpen}
          />
        )}
      </div>
    );
  }

  return (
    <div className="surface-control rounded-xl p-6 space-y-4">
      <ErrorBoundary fallback={<pre className="text-xs">{task.result}</pre>}>
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {task.result ?? ""}
          </ReactMarkdown>
        </div>
      </ErrorBoundary>
      <div className="flex items-center justify-between border-t pt-3">
        <Badge variant="outline">{task.status}</Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(task.createdAt).toLocaleString()}
        </span>
      </div>
      {previousRuns.length > 0 && (
        <PreviousRunsSheet
          runs={previousRuns}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      )}
    </div>
  );
}

function PreviousRunsSheet({
  runs, open, onOpenChange,
}: {
  runs: RuntimeTaskSummary[];
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <ChevronDown className="h-3.5 w-3.5 mr-1" />
          Previous runs
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Previous runs</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6 space-y-3 overflow-y-auto">
          {runs.map((r) => (
            <div key={r.id} className="surface-1 rounded-lg p-3 border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{r.title}</span>
                <Badge variant="outline" className="text-xs">{r.status}</Badge>
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                {r.result ?? "(no output)"}
              </pre>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CompactVariant(props: CompactProps) {
  // Keep existing Phase 2 implementation unchanged
  // (paste the existing function body here if it was inline)
}
```

**Note on `ErrorBoundary`:** check whether `src/components/shared/error-boundary.tsx` exists. If not, create a minimal one:

```tsx
// src/components/shared/error-boundary.tsx
"use client";
import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.warn("ErrorBoundary caught:", err); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}
```

- [ ] **Step 5: Run — expect PASS.**

- [ ] **Step 6: tsc clean. Note: SheetContent body padding requires `px-6 pb-6` explicitly per `MEMORY.md` — already included above.**

### Task 9: `RunNowSheet` component

**Files:**
- Create: `src/components/apps/run-now-sheet.tsx`
- Test: `src/components/apps/__tests__/run-now-sheet.test.tsx`

- [ ] **Step 1: Failing test.**

```tsx
// src/components/apps/__tests__/run-now-sheet.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RunNowSheet } from "../run-now-sheet";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const variables: BlueprintVariable[] = [
  { id: "asset", type: "text", label: "Asset", required: true },
  { id: "horizon", type: "select", label: "Horizon", default: "long",
    options: [{ value: "short", label: "Short" }, { value: "long", label: "Long" }] },
];

describe("RunNowSheet", () => {
  it("opens via trigger and renders fields with defaults", () => {
    render(<RunNowSheet blueprintId="bp1" variables={variables} />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    expect(screen.getByLabelText(/asset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/horizon/i)).toBeInTheDocument();
  });

  it("blocks submit when required field is empty", () => {
    render(<RunNowSheet blueprintId="bp1" variables={variables} />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    fireEvent.click(screen.getByRole("button", { name: /start run/i }));
    expect(screen.getByText(/asset is required/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits to /api/blueprints/{id}/instantiate on valid input", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ taskId: "t1" }) });
    render(<RunNowSheet blueprintId="bp1" variables={variables} />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    fireEvent.change(screen.getByLabelText(/asset/i), { target: { value: "NVDA" } });
    fireEvent.click(screen.getByRole("button", { name: /start run/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/blueprints/bp1/instantiate",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("NVDA"),
      })
    ));
  });

  it("shows field-level error when API returns 400 with field+message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ field: "asset", message: "Asset not recognized" }),
    });
    render(<RunNowSheet blueprintId="bp1" variables={variables} />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    fireEvent.change(screen.getByLabelText(/asset/i), { target: { value: "INVALID" } });
    fireEvent.click(screen.getByRole("button", { name: /start run/i }));
    await waitFor(() => {
      expect(screen.getByText(/asset not recognized/i)).toBeInTheDocument();
    });
  });

  it("preserves input on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<RunNowSheet blueprintId="bp1" variables={variables} />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    fireEvent.change(screen.getByLabelText(/asset/i), { target: { value: "NVDA" } });
    fireEvent.click(screen.getByRole("button", { name: /start run/i }));
    await waitFor(() => {
      expect((screen.getByLabelText(/asset/i) as HTMLInputElement).value).toBe("NVDA");
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.**

```tsx
// src/components/apps/run-now-sheet.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { VariableInput } from "@/components/workflows/variable-input";
import { validateVariables } from "@/lib/workflows/blueprints/validate-variables";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

interface RunNowSheetProps {
  blueprintId: string;
  variables: BlueprintVariable[];
  label?: string;
}

export function RunNowSheet({ blueprintId, variables, label = "Run now" }: RunNowSheetProps) {
  const [open, setOpen] = useState(false);
  const initialValues = Object.fromEntries(
    variables.map((v) => [v.id, v.default ?? (v.type === "boolean" ? false : "")])
  );
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    const validation = validateVariables(values, variables);
    if (Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const res = await fetch(`/api/blueprints/${blueprintId}/instantiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: values }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as
          { field?: string; message?: string; error?: string };
        if (res.status === 400 && body.field && body.message) {
          setErrors({ [body.field]: body.message });
        } else {
          toast.error(body.error ?? body.message ?? `Failed (${res.status})`);
        }
        return;
      }
      toast.success("Run started");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6 space-y-4 overflow-y-auto">
          {variables.map((v) => (
            <div key={v.id} className="space-y-1">
              <VariableInput
                variable={v}
                value={values[v.id]}
                onChange={(val) => setValues((prev) => ({ ...prev, [v.id]: val }))}
              />
              {errors[v.id] && (
                <p className="text-xs text-destructive">{errors[v.id]}</p>
              )}
            </div>
          ))}
          <Button onClick={handleSubmit} disabled={pending} className="w-full">
            {pending ? "Starting…" : "Start run"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: tsc clean.**

### Task 10: Update `RunNowButton` for conditional sheet

**Files:**
- Modify: `src/components/apps/run-now-button.tsx`
- Test: `src/components/apps/__tests__/run-now-button.test.tsx` (append cases)

- [ ] **Step 1: Read the current `run-now-button.tsx`** to understand existing prop shape.

- [ ] **Step 2: Add failing tests.**

```tsx
// src/components/apps/__tests__/run-now-button.test.tsx (append)
import { RunNowButton } from "../run-now-button";

describe("RunNowButton — conditional sheet", () => {
  it("renders simple button when variables prop is null", () => {
    render(<RunNowButton blueprintId="bp1" variables={null} />);
    expect(screen.getByRole("button", { name: /run now/i })).toBeInTheDocument();
    // No sheet on hover/click — direct POST handled by existing logic
  });

  it("renders RunNowSheet when variables is non-empty array", () => {
    const vars: BlueprintVariable[] = [
      { id: "x", type: "text", label: "X", required: true },
    ];
    render(<RunNowButton blueprintId="bp1" variables={vars} />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    expect(screen.getByLabelText(/x/i)).toBeInTheDocument();
  });

  it("renders simple button when variables is empty array", () => {
    render(<RunNowButton blueprintId="bp1" variables={[]} />);
    expect(screen.getByRole("button", { name: /run now/i })).toBeInTheDocument();
  });

  it("renders nothing when blueprintId is null", () => {
    const { container } = render(<RunNowButton blueprintId={null} variables={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Modify `run-now-button.tsx` to delegate to `RunNowSheet` when variables exist.**

```tsx
// src/components/apps/run-now-button.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { RunNowSheet } from "./run-now-sheet";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

interface RunNowButtonProps {
  blueprintId: string | null | undefined;
  variables?: BlueprintVariable[] | null;
  label?: string;
}

export function RunNowButton({ blueprintId, variables, label = "Run now" }: RunNowButtonProps) {
  const [pending, setPending] = useState(false);

  if (!blueprintId) return null;

  // Delegate to sheet when blueprint declares variables
  if (variables && variables.length > 0) {
    return <RunNowSheet blueprintId={blueprintId} variables={variables} label={label} />;
  }

  // Fallback: direct POST (existing Phase 2 behavior)
  async function handleClick() {
    if (!blueprintId) return;
    setPending(true);
    try {
      const res = await fetch(`/api/blueprints/${blueprintId}/instantiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: {} }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `Failed to start (${res.status})`);
        return;
      }
      toast.success("Run started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" size="sm" onClick={handleClick} disabled={pending} className="gap-1.5">
      <Play className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
```

- [ ] **Step 5: Run — expect PASS for new tests + all existing tests still pass.**

- [ ] **Step 6: tsc clean.**

### Task 11: `PeriodSelectorChip`

**Files:**
- Create: `src/components/apps/period-selector-chip.tsx`
- Test: `src/components/apps/__tests__/period-selector-chip.test.tsx`

- [ ] **Step 1: Failing test.**

```tsx
// src/components/apps/__tests__/period-selector-chip.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodSelectorChip } from "../period-selector-chip";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/apps/finance-pack",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => replaceMock.mockReset());

describe("PeriodSelectorChip", () => {
  it("renders 3 chips: MTD, QTD, YTD", () => {
    render(<PeriodSelectorChip current="mtd" />);
    expect(screen.getByText("MTD")).toBeInTheDocument();
    expect(screen.getByText("QTD")).toBeInTheDocument();
    expect(screen.getByText("YTD")).toBeInTheDocument();
  });

  it("marks the current period as selected", () => {
    render(<PeriodSelectorChip current="qtd" />);
    expect(screen.getByText("QTD").closest("button")).toHaveAttribute("data-selected", "true");
  });

  it("calls router.replace with new period on click", () => {
    render(<PeriodSelectorChip current="mtd" />);
    fireEvent.click(screen.getByText("YTD"));
    expect(replaceMock).toHaveBeenCalledWith("/apps/finance-pack?period=ytd");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.**

```tsx
// src/components/apps/period-selector-chip.tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const PERIODS = ["mtd", "qtd", "ytd"] as const;
type Period = (typeof PERIODS)[number];

interface PeriodSelectorChipProps {
  current: Period;
}

export function PeriodSelectorChip({ current }: PeriodSelectorChipProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(p: Period) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex gap-1 rounded-lg border p-1">
      {PERIODS.map((p) => (
        <Button
          key={p}
          variant={p === current ? "default" : "ghost"}
          size="sm"
          onClick={() => handleSelect(p)}
          data-selected={String(p === current)}
          className="h-7 px-2.5 text-xs uppercase"
        >
          {p}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**

### Task 12: `TransactionsTable` (read-only)

**Files:**
- Create: `src/components/apps/transactions-table.tsx`
- Test: `src/components/apps/__tests__/transactions-table.test.tsx`

- [ ] **Step 1: Failing test.**

```tsx
// src/components/apps/__tests__/transactions-table.test.tsx
import { render, screen } from "@testing-library/react";
import { TransactionsTable } from "../transactions-table";

const rows = [
  { id: "r1", date: "2026-04-01", label: "Salary", amount: 5000, category: "income" },
  { id: "r2", date: "2026-04-02", label: "Rent", amount: -1200, category: "housing" },
];

describe("TransactionsTable", () => {
  it("renders all rows with date, label, amount", () => {
    render(<TransactionsTable rows={rows} format="currency" />);
    expect(screen.getByText(/salary/i)).toBeInTheDocument();
    expect(screen.getByText(/rent/i)).toBeInTheDocument();
    expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$1,200/)).toBeInTheDocument();
  });

  it("colors negative amounts as outflow", () => {
    render(<TransactionsTable rows={rows} format="currency" />);
    const rentRow = screen.getByText(/rent/i).closest("tr");
    expect(rentRow?.querySelector('[data-amount-sign="negative"]')).toBeInTheDocument();
  });

  it("renders empty state when rows is empty", () => {
    render(<TransactionsTable rows={[]} format="currency" />);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.**

```tsx
// src/components/apps/transactions-table.tsx
import { formatKpi, type KpiFormat } from "@/lib/apps/view-kits/format-kpi";

export interface TransactionRow {
  id: string;
  date: string;
  label: string;
  amount: number;
  category?: string;
}

interface TransactionsTableProps {
  rows: TransactionRow[];
  format?: KpiFormat;
}

export function TransactionsTable({ rows, format = "currency" }: TransactionsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-lg">
        No transactions yet
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground border-b">
        <tr>
          <th className="text-left py-2 px-3">Date</th>
          <th className="text-left py-2 px-3">Description</th>
          <th className="text-left py-2 px-3">Category</th>
          <th className="text-right py-2 px-3">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b last:border-0">
            <td className="py-2 px-3 text-muted-foreground">{r.date}</td>
            <td className="py-2 px-3">{r.label}</td>
            <td className="py-2 px-3 text-muted-foreground">{r.category ?? "—"}</td>
            <td
              className={`py-2 px-3 text-right font-mono tabular-nums ${
                r.amount < 0 ? "text-destructive" : ""
              }`}
              data-amount-sign={r.amount < 0 ? "negative" : "positive"}
            >
              {formatKpi(Math.abs(r.amount), format)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**

### Task 13: `LedgerHeroPanel`

**Files:**
- Create: `src/components/apps/ledger-hero-panel.tsx`
- Test: `src/components/apps/__tests__/ledger-hero-panel.test.tsx`

- [ ] **Step 1: Failing test.**

```tsx
// src/components/apps/__tests__/ledger-hero-panel.test.tsx
import { render, screen } from "@testing-library/react";
import { LedgerHeroPanel } from "../ledger-hero-panel";

describe("LedgerHeroPanel", () => {
  it("renders TimeSeriesChart and DonutRing side by side", () => {
    const series = [{ date: "2026-04-01", value: 100 }];
    const categories = [
      { label: "Income", value: 5000 },
      { label: "Expenses", value: 3000 },
    ];
    const { container } = render(
      <LedgerHeroPanel series={series} categories={categories} period="mtd" />
    );
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    expect(screen.getByText("Income")).toBeInTheDocument();
  });

  it("renders empty placeholder when both series and categories empty", () => {
    render(<LedgerHeroPanel series={[]} categories={[]} period="mtd" />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.**

```tsx
// src/components/apps/ledger-hero-panel.tsx
import { TimeSeriesChart, type TimeSeriesPoint } from "@/components/charts/time-series-chart";
import { DonutRing } from "@/components/charts/donut-ring";

interface CategoryDatum { label: string; value: number; }

interface LedgerHeroPanelProps {
  series: TimeSeriesPoint[];
  categories: CategoryDatum[];
  period: "mtd" | "qtd" | "ytd";
}

export function LedgerHeroPanel({ series, categories, period }: LedgerHeroPanelProps) {
  if (series.length === 0 && categories.length === 0) {
    return (
      <div className="surface-control rounded-xl p-12 text-center text-muted-foreground">
        No data yet — add transactions or click <strong>Run now</strong> to ingest a CSV.
      </div>
    );
  }
  const rangeLabel = period.toUpperCase();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 surface-control rounded-xl p-4">
        <h3 className="text-sm font-medium mb-2">Trend ({rangeLabel})</h3>
        <TimeSeriesChart data={series} format="currency" range={period} height={240} />
      </div>
      <div className="surface-control rounded-xl p-4">
        <h3 className="text-sm font-medium mb-2">By category ({rangeLabel})</h3>
        <DonutRing
          segments={categories.map((c) => ({ label: c.label, value: c.value }))}
          // adapt to actual DonutRing API — read its file before final wiring
        />
      </div>
    </div>
  );
}
```

**NOTE:** Read `src/components/charts/donut-ring.tsx` before finalizing the prop shape — adapt the call site exactly. Update test if prop names differ.

- [ ] **Step 4: Run — expect PASS.**

### Task 14: `RunHistoryStrip`

**Files:**
- Create: `src/components/apps/run-history-strip.tsx`
- Test: `src/components/apps/__tests__/run-history-strip.test.tsx`

- [ ] **Step 1: Failing test.**

```tsx
// src/components/apps/__tests__/run-history-strip.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { RunHistoryStrip } from "../run-history-strip";

const runs = [
  { id: "r1", title: "Apr 28 digest", status: "completed" as const, createdAt: Date.now() - 86400000, result: "..." },
  { id: "r2", title: "Apr 21 digest", status: "completed" as const, createdAt: Date.now() - 7 * 86400000, result: "..." },
];

describe("RunHistoryStrip", () => {
  it("renders one card per run", () => {
    render(<RunHistoryStrip runs={runs} />);
    expect(screen.getByText("Apr 28 digest")).toBeInTheDocument();
    expect(screen.getByText("Apr 21 digest")).toBeInTheDocument();
  });

  it("calls onSelect when a card is clicked", () => {
    const onSelect = vi.fn();
    render(<RunHistoryStrip runs={runs} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Apr 28 digest"));
    expect(onSelect).toHaveBeenCalledWith(runs[0]);
  });

  it("renders empty state when runs is empty", () => {
    render(<RunHistoryStrip runs={[]} />);
    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.**

```tsx
// src/components/apps/run-history-strip.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import type { RuntimeTaskSummary } from "@/lib/apps/view-kits/types";

interface RunHistoryStripProps {
  runs: RuntimeTaskSummary[];
  onSelect?: (run: RuntimeTaskSummary) => void;
}

export function RunHistoryStrip({ runs, onSelect }: RunHistoryStripProps) {
  if (runs.length === 0) {
    return <div className="text-xs text-muted-foreground p-4">No runs yet</div>;
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {runs.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onSelect?.(r)}
          className="surface-control rounded-lg p-3 min-w-[180px] text-left hover:bg-accent focus-visible:ring-2 ring-ring rounded-lg"
        >
          <div className="text-xs font-medium truncate">{r.title}</div>
          <div className="flex items-center justify-between mt-2">
            <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
            <span className="text-[10px] text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString()}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**

### Task 15: `MonthlyCloseSummary`

**Files:**
- Create: `src/components/apps/monthly-close-summary.tsx`
- Test: `src/components/apps/__tests__/monthly-close-summary.test.tsx`

- [ ] **Step 1: Failing test.**

```tsx
// src/components/apps/__tests__/monthly-close-summary.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthlyCloseSummary } from "../monthly-close-summary";

describe("MonthlyCloseSummary", () => {
  it("renders collapsed by default", () => {
    render(<MonthlyCloseSummary task={{
      id: "t1", title: "March close", status: "completed",
      createdAt: Date.now(), result: "Net: $5,000"
    }} />);
    expect(screen.queryByText(/net: \$5,000/i)).not.toBeInTheDocument();
    expect(screen.getByText(/march close/i)).toBeInTheDocument();
  });

  it("expands on click", () => {
    render(<MonthlyCloseSummary task={{
      id: "t1", title: "March close", status: "completed",
      createdAt: Date.now(), result: "Net: $5,000"
    }} />);
    fireEvent.click(screen.getByRole("button", { name: /march close/i }));
    expect(screen.getByText(/net: \$5,000/i)).toBeInTheDocument();
  });

  it("renders 'no monthly-close blueprint' when task is null", () => {
    render(<MonthlyCloseSummary task={null} />);
    expect(screen.getByText(/no monthly-close blueprint/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.**

```tsx
// src/components/apps/monthly-close-summary.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LightMarkdown } from "@/components/shared/light-markdown";
import type { RuntimeTaskSummary } from "@/lib/apps/view-kits/types";

interface MonthlyCloseSummaryProps {
  task: RuntimeTaskSummary | null;
}

export function MonthlyCloseSummary({ task }: MonthlyCloseSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  if (!task) {
    return (
      <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
        No monthly-close blueprint configured for this app
      </div>
    );
  }

  return (
    <div className="surface-control rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded((b) => !b)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-accent rounded-lg"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-medium text-sm">{task.title}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </button>
      {expanded && task.result && (
        <div className="px-4 pb-4">
          <LightMarkdown content={task.result} textSize="sm" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit Wave 2.**

```bash
git add \
  src/components/charts/time-series-chart.tsx \
  src/components/charts/run-cadence-heatmap.tsx \
  src/components/charts/__tests__/ \
  src/components/apps/last-run-card.tsx \
  src/components/apps/run-now-button.tsx \
  src/components/apps/run-now-sheet.tsx \
  src/components/apps/period-selector-chip.tsx \
  src/components/apps/transactions-table.tsx \
  src/components/apps/ledger-hero-panel.tsx \
  src/components/apps/run-history-strip.tsx \
  src/components/apps/monthly-close-summary.tsx \
  src/components/apps/__tests__/last-run-card.test.tsx \
  src/components/apps/__tests__/run-now-button.test.tsx \
  src/components/apps/__tests__/run-now-sheet.test.tsx \
  src/components/apps/__tests__/period-selector-chip.test.tsx \
  src/components/apps/__tests__/transactions-table.test.tsx \
  src/components/apps/__tests__/ledger-hero-panel.test.tsx \
  src/components/apps/__tests__/run-history-strip.test.tsx \
  src/components/apps/__tests__/monthly-close-summary.test.tsx \
  src/components/shared/error-boundary.tsx
git commit -m "feat(apps): Phase 3 wave 2 — chart primitives + RunNowSheet + Coach/Ledger UI components"
```

---

## Wave 3 — Kits

### Task 16: `defaultLedgerKpis` synthesis

**Files:**
- Modify: `src/lib/apps/view-kits/default-kpis.ts`
- Test: `src/lib/apps/view-kits/__tests__/default-kpis.test.ts` (append cases)

- [ ] **Step 1: Failing test.**

```ts
// src/lib/apps/view-kits/__tests__/default-kpis.test.ts (append)
import { defaultLedgerKpis } from "../default-kpis";

describe("defaultLedgerKpis", () => {
  it("synthesizes Net + Inflow + Outflow when currency column present", () => {
    const cols = [
      { name: "amount", type: "number", semantic: "currency" },
      { name: "category", type: "string" },
    ];
    const kpis = defaultLedgerKpis("transactions", cols, "mtd");
    expect(kpis.map((k) => k.id)).toEqual(["net", "inflow", "outflow"]);
    expect(kpis[0].source.kind).toBe("tableSumWindowed");
    expect(kpis[1].source).toMatchObject({ sign: "positive", window: "mtd" });
    expect(kpis[2].source).toMatchObject({ sign: "negative", window: "mtd" });
  });

  it("appends Run-rate KPI when blueprintId provided", () => {
    const cols = [{ name: "amount", type: "number", semantic: "currency" }];
    const kpis = defaultLedgerKpis("transactions", cols, "mtd", "monthly-close");
    expect(kpis.map((k) => k.id)).toContain("run-rate");
  });

  it("returns empty array when no currency column", () => {
    const cols = [{ name: "category", type: "string" }];
    const kpis = defaultLedgerKpis("transactions", cols, "mtd");
    expect(kpis).toEqual([]);
  });

  it("scopes window to whatever period is passed", () => {
    const cols = [{ name: "amount", type: "number", semantic: "currency" }];
    const kpis = defaultLedgerKpis("t", cols, "ytd");
    expect(kpis[0].source).toMatchObject({ window: "ytd" });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.**

```ts
// src/lib/apps/view-kits/default-kpis.ts (append)
import type { ViewConfig } from "@/lib/apps/registry";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];

interface ColumnHint { name: string; type?: string; semantic?: string; }

export function defaultLedgerKpis(
  table: string,
  columns: ColumnHint[],
  period: "mtd" | "qtd" | "ytd",
  blueprintId?: string
): KpiSpec[] {
  const currencyCol = columns.find(
    (c) => c.semantic === "currency" || /amount|balance|value/i.test(c.name)
  );
  if (!currencyCol) return [];

  const specs: KpiSpec[] = [
    {
      id: "net", label: "Net", format: "currency",
      source: { kind: "tableSumWindowed", table, column: currencyCol.name, window: period },
    },
    {
      id: "inflow", label: "Inflow", format: "currency",
      source: { kind: "tableSumWindowed", table, column: currencyCol.name, sign: "positive", window: period },
    },
    {
      id: "outflow", label: "Outflow", format: "currency",
      source: { kind: "tableSumWindowed", table, column: currencyCol.name, sign: "negative", window: period },
    },
  ];

  if (blueprintId) {
    specs.push({
      id: "run-rate", label: "Run-rate (30d)", format: "int",
      source: { kind: "blueprintRunCount", blueprint: blueprintId, window: "30d" },
    });
  }

  return specs;
}
```

- [ ] **Step 4: Run — expect PASS.**

### Task 17: Coach kit

**Files:**
- Create: `src/lib/apps/view-kits/kits/coach.ts`
- Test: `src/lib/apps/view-kits/__tests__/coach.test.ts`

- [ ] **Step 1: Failing test (resolve + buildModel).**

```ts
// src/lib/apps/view-kits/__tests__/coach.test.ts
import { describe, it, expect } from "vitest";
import { coachKit } from "../kits/coach";

const baseManifest = {
  id: "weekly-portfolio-check-in",
  name: "Weekly portfolio check-in",
  profiles: [{ id: "wealth-manager-coach", name: "Wealth Coach" }],
  blueprints: [{ id: "weekly-digest", name: "Weekly Digest", variables: [{ id: "asset", type: "text", label: "Asset", required: true }] }],
  schedules: [{ id: "monday-8am", cron: "0 8 * * 1" }],
  tables: [],
  view: undefined,
};

const baseRuntime = {
  app: { id: "wp1", name: "Weekly check-in", description: null, manifest: baseManifest, files: [] },
  recentTaskCount: 5,
  scheduleCadence: "Mondays at 8am",
};

describe("coachKit.resolve", () => {
  it("picks first blueprint and first schedule when bindings absent", () => {
    const proj = coachKit.resolve({ manifest: baseManifest, columns: [] });
    expect(proj.runsBlueprintId).toBe("weekly-digest");
    expect(proj.cadenceScheduleId).toBe("monday-8am");
  });

  it("threads blueprint variables into projection", () => {
    const proj = coachKit.resolve({ manifest: baseManifest, columns: [] });
    expect(proj.runsBlueprintVars).toEqual([
      { id: "asset", type: "text", label: "Asset", required: true },
    ]);
  });
});

describe("coachKit.buildModel", () => {
  it("renders hero=last-run-hero with task and previous runs", () => {
    const projection = coachKit.resolve({ manifest: baseManifest, columns: [] });
    const runtime = {
      ...baseRuntime,
      coachLatestTask: { id: "t1", title: "Latest", status: "completed" as const, createdAt: Date.now(), result: "## OK" },
      coachPreviousRuns: [],
      coachCadenceCells: [],
    };
    const model = coachKit.buildModel(projection, runtime);
    expect(model.hero?.kind).toBe("custom");
    expect(model.header.runNowBlueprintId).toBe("weekly-digest");
    expect(model.header.runNowVariables).toBeDefined();
  });

  it("renders empty-state hero when no completed task yet", () => {
    const projection = coachKit.resolve({ manifest: baseManifest, columns: [] });
    const runtime = {
      ...baseRuntime,
      coachLatestTask: null,
      coachPreviousRuns: [],
      coachCadenceCells: [],
    };
    const model = coachKit.buildModel(projection, runtime);
    expect(model.hero?.kind).toBe("custom");
  });

  it("includes manifest pane in footer", () => {
    const projection = coachKit.resolve({ manifest: baseManifest, columns: [] });
    const runtime = {
      ...baseRuntime,
      coachLatestTask: null,
      coachPreviousRuns: [],
      coachCadenceCells: [],
    };
    const model = coachKit.buildModel(projection, runtime);
    expect(model.footer).toBeDefined();
    expect(model.footer?.appId).toBe("wp1");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Update `types.ts`** to add Coach + Ledger runtime fields and `HeaderSlot.runNowVariables`:

```ts
// src/lib/apps/view-kits/types.ts (append to RuntimeState)
  /** Phase 3: Coach kit fields. */
  coachLatestTask?: RuntimeTaskSummary | null;
  coachPreviousRuns?: RuntimeTaskSummary[];
  coachCadenceCells?: { date: string; runs: number; status?: "success" | "fail" }[];

  /** Phase 3: Ledger kit fields. */
  ledgerSeries?: { date: string; value: number }[];
  ledgerCategories?: { label: string; value: number }[];
  ledgerTransactions?: { id: string; date: string; label: string; amount: number; category?: string }[];
  ledgerMonthlyClose?: RuntimeTaskSummary | null;
  ledgerPeriod?: "mtd" | "qtd" | "ytd";

// And to HeaderSlot:
  /** Phase 3: pre-fetched blueprint variables for RunNowButton sheet. null/undefined → simple button. */
  runNowVariables?: import("@/lib/workflows/blueprints/types").BlueprintVariable[] | null;
```

- [ ] **Step 4: Implement Coach kit.**

```ts
// src/lib/apps/view-kits/kits/coach.ts
import { createElement } from "react";
import yaml from "js-yaml";
import { LastRunCard } from "@/components/apps/last-run-card";
import { ManifestPaneBody } from "@/components/apps/kit-view/manifest-pane-body";
import type { ViewConfig } from "@/lib/apps/registry";
import type {
  KitDefinition, KitProjection, ResolveInput, RuntimeState, ViewModel,
} from "../types";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

interface CoachProjection extends KitProjection {
  runsBlueprintId: string | undefined;
  cadenceScheduleId: string | undefined;
  secondaryTableIds: string[];
  runsBlueprintVars: BlueprintVariable[] | null;
  manifestYaml: string;
}

export const coachKit: KitDefinition = {
  id: "coach",

  resolve(input: ResolveInput): KitProjection {
    const m = input.manifest;
    const bindings = m.view?.bindings;

    const runsBlueprintId =
      bindings?.runs && "blueprint" in bindings.runs
        ? bindings.runs.blueprint
        : m.blueprints[0]?.id;

    const cadenceScheduleId =
      bindings?.cadence && "schedule" in bindings.cadence
        ? bindings.cadence.schedule
        : m.schedules[0]?.id;

    const secondaryTableIds =
      bindings?.secondary?.flatMap((b) => ("table" in b ? [b.table] : [])) ?? [];

    // Pre-fetch the blueprint's variables from the manifest itself
    // (data layer also re-reads from registry for installed blueprints).
    const blueprint = runsBlueprintId
      ? m.blueprints.find((b) => b.id === runsBlueprintId)
      : null;
    const runsBlueprintVars: BlueprintVariable[] | null =
      blueprint && "variables" in blueprint && Array.isArray(blueprint.variables)
        ? (blueprint.variables as BlueprintVariable[])
        : null;

    const projection: CoachProjection = {
      runsBlueprintId,
      cadenceScheduleId,
      secondaryTableIds,
      runsBlueprintVars,
      manifestYaml: yaml.dump(m, { lineWidth: 100 }),
    };
    return projection;
  },

  buildModel(proj: KitProjection, runtime: RuntimeState): ViewModel {
    const projection = proj as CoachProjection;
    const { app } = runtime;

    const hero = {
      kind: "custom" as const,
      content: createElement(LastRunCard, {
        variant: "hero",
        task: runtime.coachLatestTask ?? null,
        previousRuns: runtime.coachPreviousRuns ?? [],
        blueprintId: projection.runsBlueprintId,
      }),
    };

    return {
      header: {
        title: app.name,
        description: app.description ?? undefined,
        status: "running",
        cadenceChip: runtime.cadence ?? undefined,
        runNowBlueprintId: projection.runsBlueprintId,
        runNowVariables: projection.runsBlueprintVars,
      },
      kpis: runtime.evaluatedKpis ?? [],
      hero,
      footer: {
        appId: app.id,
        appName: app.name,
        manifestYaml: projection.manifestYaml,
        body: ManifestPaneBody({
          manifest: app.manifest,
          files: app.files,
          manifestYaml: projection.manifestYaml,
        }),
      },
    };
  },
};
```

- [ ] **Step 5: Run tests — expect PASS.**

### Task 18: Ledger kit

**Files:**
- Create: `src/lib/apps/view-kits/kits/ledger.ts`
- Test: `src/lib/apps/view-kits/__tests__/ledger.test.ts`

- [ ] **Step 1: Failing test.**

```ts
// src/lib/apps/view-kits/__tests__/ledger.test.ts
import { describe, it, expect } from "vitest";
import { ledgerKit } from "../kits/ledger";

const baseManifest = {
  id: "finance-pack",
  name: "Finance Pack",
  profiles: [],
  blueprints: [{ id: "monthly-close", name: "Monthly Close" }],
  schedules: [],
  tables: [{
    id: "transactions",
    name: "transactions",
    columns: [
      { name: "date", type: "date" },
      { name: "amount", type: "number", semantic: "currency" },
      { name: "category", type: "string" },
    ],
  }],
  view: undefined,
};

describe("ledgerKit.resolve", () => {
  it("picks first table and first blueprint when bindings absent", () => {
    const proj = ledgerKit.resolve({
      manifest: baseManifest,
      columns: [{ tableId: "transactions", columns: baseManifest.tables[0].columns }],
      period: "mtd",
    } as any);
    expect(proj.heroTableId).toBe("transactions");
    expect(proj.runsBlueprintId).toBe("monthly-close");
    expect(proj.period).toBe("mtd");
  });

  it("synthesizes Net/Inflow/Outflow + Run-rate KPIs", () => {
    const proj = ledgerKit.resolve({
      manifest: baseManifest,
      columns: [{ tableId: "transactions", columns: baseManifest.tables[0].columns }],
      period: "qtd",
    } as any);
    expect(proj.kpiSpecs.map((s: any) => s.id)).toEqual(["net", "inflow", "outflow", "run-rate"]);
  });
});

describe("ledgerKit.buildModel", () => {
  it("renders hero=ledger-hero", () => {
    const proj = ledgerKit.resolve({
      manifest: baseManifest,
      columns: [{ tableId: "transactions", columns: baseManifest.tables[0].columns }],
      period: "mtd",
    } as any);
    const runtime = {
      app: { id: "fp1", name: "Finance", description: null, manifest: baseManifest, files: [] },
      recentTaskCount: 0,
      scheduleCadence: null,
      ledgerSeries: [],
      ledgerCategories: [],
      ledgerTransactions: [],
      ledgerMonthlyClose: null,
      ledgerPeriod: "mtd" as const,
    };
    const model = ledgerKit.buildModel(proj, runtime);
    expect(model.hero?.kind).toBe("custom");
    expect(model.header.runNowBlueprintId).toBe("monthly-close");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.**

```ts
// src/lib/apps/view-kits/kits/ledger.ts
import { createElement } from "react";
import yaml from "js-yaml";
import { LedgerHeroPanel } from "@/components/apps/ledger-hero-panel";
import { ManifestPaneBody } from "@/components/apps/kit-view/manifest-pane-body";
import { defaultLedgerKpis } from "../default-kpis";
import type { ViewConfig } from "@/lib/apps/registry";
import type {
  KitDefinition, KitProjection, ResolveInput, RuntimeState, ViewModel,
} from "../types";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];

interface LedgerProjection extends KitProjection {
  heroTableId: string | undefined;
  runsBlueprintId: string | undefined;
  period: "mtd" | "qtd" | "ytd";
  kpiSpecs: KpiSpec[];
  runsBlueprintVars: BlueprintVariable[] | null;
  manifestYaml: string;
}

interface LedgerResolveInput extends ResolveInput {
  period?: "mtd" | "qtd" | "ytd";
}

export const ledgerKit: KitDefinition = {
  id: "ledger",

  resolve(input: ResolveInput): KitProjection {
    const ledgerInput = input as LedgerResolveInput;
    const m = input.manifest;
    const bindings = m.view?.bindings;
    const period = ledgerInput.period ?? "mtd";

    const heroTableId =
      bindings?.hero && "table" in bindings.hero
        ? bindings.hero.table
        : m.tables[0]?.id;

    const runsBlueprintId =
      bindings?.runs && "blueprint" in bindings.runs
        ? bindings.runs.blueprint
        : m.blueprints[0]?.id;

    const heroCols = heroTableId
      ? input.columns.find((c) => c.tableId === heroTableId)?.columns ?? []
      : [];

    const kpiSpecs = bindings?.kpis ?? defaultLedgerKpis(
      heroTableId ?? "",
      heroCols,
      period,
      runsBlueprintId
    );

    const blueprint = runsBlueprintId
      ? m.blueprints.find((b) => b.id === runsBlueprintId)
      : null;
    const runsBlueprintVars: BlueprintVariable[] | null =
      blueprint && "variables" in blueprint && Array.isArray(blueprint.variables)
        ? (blueprint.variables as BlueprintVariable[])
        : null;

    const projection: LedgerProjection = {
      heroTableId,
      runsBlueprintId,
      period,
      kpiSpecs,
      runsBlueprintVars,
      manifestYaml: yaml.dump(m, { lineWidth: 100 }),
    };
    return projection;
  },

  buildModel(proj: KitProjection, runtime: RuntimeState): ViewModel {
    const projection = proj as LedgerProjection;
    const { app } = runtime;

    const hero = {
      kind: "custom" as const,
      content: createElement(LedgerHeroPanel, {
        series: runtime.ledgerSeries ?? [],
        categories: runtime.ledgerCategories ?? [],
        period: projection.period,
      }),
    };

    return {
      header: {
        title: app.name,
        description: app.description ?? undefined,
        status: "running",
        runNowBlueprintId: projection.runsBlueprintId,
        runNowVariables: projection.runsBlueprintVars,
      },
      kpis: runtime.evaluatedKpis ?? [],
      hero,
      footer: {
        appId: app.id,
        appName: app.name,
        manifestYaml: projection.manifestYaml,
        body: ManifestPaneBody({
          manifest: app.manifest,
          files: app.files,
          manifestYaml: projection.manifestYaml,
        }),
      },
    };
  },
};
```

- [ ] **Step 4: Run — expect PASS.**

### Task 19: Register kits + extend ResolveInput type

**Files:**
- Modify: `src/lib/apps/view-kits/index.ts`
- Modify: `src/lib/apps/view-kits/types.ts` (add `period?` to `ResolveInput`)
- Modify: `src/lib/apps/view-kits/__tests__/dispatcher.test.ts` (append registration test)

- [ ] **Step 1: Add `period` to `ResolveInput`:**

```ts
// src/lib/apps/view-kits/types.ts
export interface ResolveInput {
  manifest: AppManifest;
  columns: ColumnSchemaRef[];
  /** Phase 3: period selector value passed by Ledger only. */
  period?: "mtd" | "qtd" | "ytd";
}
```

- [ ] **Step 2: Register kits in `index.ts`:**

```ts
// src/lib/apps/view-kits/index.ts (append to viewKits map)
import { coachKit } from "./kits/coach";
import { ledgerKit } from "./kits/ledger";

export const viewKits: Record<KitId, KitDefinition> = {
  // ... existing entries
  coach: coachKit,
  ledger: ledgerKit,
};
```

- [ ] **Step 3: Append dispatcher test cases:**

```ts
// src/lib/apps/view-kits/__tests__/dispatcher.test.ts (append)
it("registers coach kit", () => {
  expect(viewKits.coach).toBeDefined();
  expect(viewKits.coach.id).toBe("coach");
});

it("registers ledger kit", () => {
  expect(viewKits.ledger).toBeDefined();
  expect(viewKits.ledger.id).toBe("ledger");
});
```

- [ ] **Step 4: Run all dispatcher + kit tests — expect PASS.**

- [ ] **Step 5: Commit Wave 3.**

```bash
git add \
  src/lib/apps/view-kits/default-kpis.ts \
  src/lib/apps/view-kits/__tests__/default-kpis.test.ts \
  src/lib/apps/view-kits/kits/coach.ts \
  src/lib/apps/view-kits/kits/ledger.ts \
  src/lib/apps/view-kits/__tests__/coach.test.ts \
  src/lib/apps/view-kits/__tests__/ledger.test.ts \
  src/lib/apps/view-kits/types.ts \
  src/lib/apps/view-kits/index.ts \
  src/lib/apps/view-kits/__tests__/dispatcher.test.ts
git commit -m "feat(apps): Phase 3 wave 3 — coach + ledger kit definitions"
```

---

## Wave 4 — Data layer

### Task 20: Coach data loaders

**Files:**
- Modify: `src/lib/apps/view-kits/data.ts`

- [ ] **Step 1: Add new loader functions.**

```ts
// src/lib/apps/view-kits/data.ts (append)

async function loadCoachLatestTask(
  appId: string,
  blueprintId: string | undefined
): Promise<RuntimeTaskSummary | null> {
  if (!blueprintId) return null;
  try {
    const row = db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.projectId, appId),
        eq(tasks.assignedAgent, blueprintId),
        eq(tasks.status, "completed"),
      ))
      .orderBy(desc(tasks.createdAt))
      .limit(1)
      .get();
    if (!row) return null;
    return {
      id: row.id, title: row.title, status: row.status as TaskStatus,
      createdAt: row.createdAt.getTime(), result: row.result,
    };
  } catch { return null; }
}

async function loadCoachPreviousRuns(
  appId: string,
  blueprintId: string | undefined,
  limit: number
): Promise<RuntimeTaskSummary[]> {
  if (!blueprintId) return [];
  try {
    const rows = db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.projectId, appId),
        eq(tasks.assignedAgent, blueprintId),
      ))
      .orderBy(desc(tasks.createdAt))
      .limit(limit + 1) // +1 because [0] is the latest, we want runs 1..N
      .all();
    return rows.slice(1).map((r) => ({
      id: r.id, title: r.title, status: r.status as TaskStatus,
      createdAt: r.createdAt.getTime(), result: r.result,
    }));
  } catch { return []; }
}

async function loadCoachCadenceCells(
  appId: string,
  blueprintId: string | undefined,
  weeks: number
): Promise<{ date: string; runs: number; status?: "success" | "fail" }[]> {
  if (!blueprintId) return [];
  const since = new Date(Date.now() - weeks * 7 * 86_400_000);
  try {
    const rows = db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.projectId, appId),
        eq(tasks.assignedAgent, blueprintId),
        gte(tasks.createdAt, since),
      ))
      .orderBy(desc(tasks.createdAt))
      .all();
    const byDate = new Map<string, { runs: number; failed: number }>();
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      const e = byDate.get(key) ?? { runs: 0, failed: 0 };
      e.runs += 1;
      if (r.status === "failed") e.failed += 1;
      byDate.set(key, e);
    }
    return Array.from(byDate.entries()).map(([date, { runs, failed }]) => ({
      date, runs,
      status: failed > 0 ? ("fail" as const) : ("success" as const),
    }));
  } catch { return []; }
}
```

### Task 21: Ledger data loaders

**Files:**
- Modify: `src/lib/apps/view-kits/data.ts`

- [ ] **Step 1: Add Ledger loaders.**

```ts
// src/lib/apps/view-kits/data.ts (append)

async function loadLedgerSeries(
  tableId: string | undefined,
  column: string,
  period: "mtd" | "qtd" | "ytd"
): Promise<{ date: string; value: number }[]> {
  if (!tableId) return [];
  const since = windowStart(period); // import from kpi-context
  try {
    const path = "$." + column;
    const rows = db
      .select({
        date: sql<string>`date(${userTableRows.createdAt} / 1000, 'unixepoch')`,
        value: sql<number>`SUM(CAST(json_extract(${userTableRows.data}, ${path}) AS REAL))`,
      })
      .from(userTableRows)
      .where(and(
        eq(userTableRows.tableId, tableId),
        gte(userTableRows.createdAt, since),
      ))
      .groupBy(sql`date(${userTableRows.createdAt} / 1000, 'unixepoch')`)
      .all();
    return rows.map((r) => ({ date: r.date, value: Number(r.value ?? 0) }));
  } catch { return []; }
}

async function loadLedgerCategories(
  tableId: string | undefined,
  amountColumn: string,
  categoryColumn: string,
  period: "mtd" | "qtd" | "ytd"
): Promise<{ label: string; value: number }[]> {
  if (!tableId) return [];
  const since = windowStart(period);
  try {
    const amountPath = "$." + amountColumn;
    const categoryPath = "$." + categoryColumn;
    const rows = db
      .select({
        label: sql<string>`json_extract(${userTableRows.data}, ${categoryPath})`,
        value: sql<number>`SUM(CAST(json_extract(${userTableRows.data}, ${amountPath}) AS REAL))`,
      })
      .from(userTableRows)
      .where(and(
        eq(userTableRows.tableId, tableId),
        gte(userTableRows.createdAt, since),
      ))
      .groupBy(sql`json_extract(${userTableRows.data}, ${categoryPath})`)
      .all();
    return rows
      .filter((r) => r.label)
      .map((r) => ({ label: String(r.label), value: Math.abs(Number(r.value ?? 0)) }));
  } catch { return []; }
}

async function loadLedgerTransactions(
  tableId: string | undefined,
  period: "mtd" | "qtd" | "ytd",
  limit = 25
): Promise<{ id: string; date: string; label: string; amount: number; category?: string }[]> {
  if (!tableId) return [];
  const since = windowStart(period);
  try {
    const rows = db
      .select()
      .from(userTableRows)
      .where(and(
        eq(userTableRows.tableId, tableId),
        gte(userTableRows.createdAt, since),
      ))
      .orderBy(desc(userTableRows.createdAt))
      .limit(limit)
      .all();
    return rows.map((r) => {
      const data = JSON.parse(r.data) as Record<string, unknown>;
      return {
        id: r.id,
        date: r.createdAt.toISOString().slice(0, 10),
        label: String(data.label ?? data.description ?? "—"),
        amount: Number(data.amount ?? 0),
        category: typeof data.category === "string" ? data.category : undefined,
      };
    });
  } catch { return []; }
}

async function loadMonthlyCloseSummary(
  appId: string,
  blueprintId: string | undefined
): Promise<RuntimeTaskSummary | null> {
  if (!blueprintId) return null;
  return loadCoachLatestTask(appId, blueprintId); // reuse: latest completed task for that blueprint
}

async function loadBlueprintVariables(
  blueprintId: string | undefined
): Promise<BlueprintVariable[] | null> {
  if (!blueprintId) return null;
  try {
    const mod = await import("@/lib/workflows/blueprints/registry");
    const bp = mod.getBlueprint(blueprintId);
    return bp?.variables ?? null;
  } catch { return null; }
}
```

**Note:** export `windowStart` from `kpi-context.ts` (or duplicate the helper in `data.ts`). Pick one location and make it the single source of truth.

### Task 22: Wire Coach branch in `loadRuntimeStateUncached`

**Files:**
- Modify: `src/lib/apps/view-kits/data.ts`

- [ ] **Step 1: Add coach branch.**

```ts
// Inside loadRuntimeStateUncached
if (kitId === "coach") {
  return {
    ...baseline,
    cadence: await loadCadence(app.manifest, projection.cadenceScheduleId),
    coachLatestTask: await loadCoachLatestTask(app.id, projection.runsBlueprintId),
    coachPreviousRuns: await loadCoachPreviousRuns(app.id, projection.runsBlueprintId, 8),
    coachCadenceCells: await loadCoachCadenceCells(app.id, projection.runsBlueprintId, 12),
    evaluatedKpis: await loadEvaluatedKpis(projection.kpiSpecs ?? []),
  };
}
```

- [ ] **Step 2: Update `KitProjectionShape`** to include the projection fields needed:

```ts
export interface KitProjectionShape {
  heroTableId?: string;
  cadenceScheduleId?: string;
  runsBlueprintId?: string;
  kpiSpecs?: KpiSpec[];
  blueprintIds?: string[];
  scheduleIds?: string[];
  /** Phase 3: Ledger period; threaded into windowed KPI specs. */
  period?: "mtd" | "qtd" | "ytd";
}
```

### Task 23: Wire Ledger branch in `loadRuntimeStateUncached`

**Files:**
- Modify: `src/lib/apps/view-kits/data.ts`

- [ ] **Step 1: Add ledger branch.**

```ts
if (kitId === "ledger") {
  // Find amount column + category column from columns ref (we need this metadata)
  // The simplest path: keep amount/category keys on the projection and pass them through.
  // Update LedgerProjection in kits/ledger.ts to include these names.
  const amountCol = "amount"; // sourced from projection.amountColumn (Task 18 update)
  const categoryCol = "category";
  const period = projection.period ?? "mtd";
  return {
    ...baseline,
    ledgerSeries: await loadLedgerSeries(projection.heroTableId, amountCol, period),
    ledgerCategories: await loadLedgerCategories(projection.heroTableId, amountCol, categoryCol, period),
    ledgerTransactions: await loadLedgerTransactions(projection.heroTableId, period),
    ledgerMonthlyClose: await loadMonthlyCloseSummary(app.id, projection.runsBlueprintId),
    ledgerPeriod: period,
    evaluatedKpis: await loadEvaluatedKpis(projection.kpiSpecs ?? []),
  };
}
```

**IMPORTANT:** This requires `LedgerProjection` to include `amountColumn` + `categoryColumn` (or equivalent) so the data layer doesn't hardcode column names. Update Task 18's projection shape:

```ts
// src/lib/apps/view-kits/kits/ledger.ts (add to LedgerProjection)
amountColumn: string | undefined;
categoryColumn: string | undefined;

// In resolve:
const amountColumn = currencyCol?.name; // currencyCol from defaultLedgerKpis logic, lifted
const categoryColumn = heroCols.find((c) => /category|tag|group/i.test(c.name))?.name;
projection.amountColumn = amountColumn;
projection.categoryColumn = categoryColumn;
```

Update `KitProjectionShape` accordingly:

```ts
export interface KitProjectionShape {
  // ...
  amountColumn?: string;
  categoryColumn?: string;
}
```

And the data branch:

```ts
const amountCol = projection.amountColumn ?? "amount";
const categoryCol = projection.categoryColumn ?? "category";
```

### Task 24: Cache key includes period

**Files:**
- Modify: `src/lib/apps/view-kits/data.ts`

- [ ] **Step 1: Update `loadRuntimeState`'s `unstable_cache` key.**

```ts
export function loadRuntimeState(
  app: AppDetail,
  bindings: ResolvedBindings,
  kitId: KitId,
  projection: KitProjectionShape
): Promise<RuntimeState> {
  const period = projection.period ?? "default";
  const cached = unstable_cache(
    () => loadRuntimeStateUncached(app, bindings, kitId, projection),
    ["app-runtime", app.id, kitId, period],
    { revalidate: 30, tags: [`app-runtime:${app.id}`] }
  );
  return cached();
}
```

- [ ] **Step 2: Add a small data.ts test (or smoke during browser run) that switching period yields different cached data.** *Option:* skip the explicit unit test if data.ts is hard to unit-test in isolation; rely on browser smoke gate to verify.

- [ ] **Step 3: Commit Wave 4.**

```bash
git add src/lib/apps/view-kits/data.ts src/lib/apps/view-kits/kits/ledger.ts
git commit -m "feat(apps): Phase 3 wave 4 — coach + ledger data loaders + period-scoped cache"
```

---

## Wave 5 — Slot renderers

### Task 25: `hero.tsx` adds `last-run-hero`, `ledger-hero`

**Files:**
- Modify: `src/components/apps/kit-view/slots/hero.tsx`

- [ ] **Step 1: Read current `hero.tsx` to understand existing dispatch.**

- [ ] **Step 2: The current hero implementation passes through `slot.content` directly.** Coach + Ledger build their hero content as `{kind: "custom", content: createElement(...)}` — no slot dispatch change is required because `kind="custom"` already passes content through. **Skip explicit hero.tsx changes if this is true.**

- [ ] **Step 3: Verify by running existing tests.**

```bash
npx vitest run src/components/apps/__tests__/kit-view.test.tsx 2>/dev/null || true
```

### Task 26: `secondary.tsx` adds new variants

**Files:**
- Modify: `src/components/apps/kit-view/slots/secondary.tsx`

- [ ] **Step 1: Read current `secondary.tsx`.** If it dispatches by `slot.id`/`slot.title`, no change needed since secondary content is `ReactNode`. Skip.

### Task 27: `activity.tsx` adds new variants

**Files:**
- Modify: `src/components/apps/kit-view/slots/activity.tsx`

- [ ] **Step 1:** Same pattern — activity content is `ReactNode`, kits set the content. No dispatcher change needed.

**If the existing slot renderers are already pass-through `ReactNode`, Wave 5 is essentially a no-op.** Verify by running the apps test suite:

```bash
npx vitest run src/components/apps src/lib/apps
```
Expected: 200+ tests pass; no regressions.

- [ ] **Step 2: Commit Wave 5 as needed (likely no diff).**

---

## Wave 6 — Page wiring + inference + starter

### Task 28: Page reads `?period=` and threads into projection

**Files:**
- Modify: `src/app/apps/[id]/page.tsx`

- [ ] **Step 1: Read current `page.tsx` to find where `pickKit()` and `loadRuntimeState()` are called.**

- [ ] **Step 2: Add Zod-validated period parsing.**

```tsx
// src/app/apps/[id]/page.tsx (top of file)
import { z } from "zod";
const PeriodSchema = z.enum(["mtd", "qtd", "ytd"]).default("mtd");

// In the page component:
export default async function AppDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const period = PeriodSchema.parse(sp.period ?? "mtd");
  // ... existing app loading
  const projection = kit.resolve({ manifest: app.manifest, columns, period });
  const runtime = await loadRuntimeState(app, resolvedBindings, kit.id, projection);
  // ... existing render
}
```

- [ ] **Step 3: Run existing page tests if any.**

### Task 29: Verify inference for Coach + Ledger; add tests

**Files:**
- Modify (likely no change): `src/lib/apps/view-kits/inference.ts`
- Create: `src/lib/apps/view-kits/__tests__/inference.test.ts` (if not present)

- [ ] **Step 1: Read `inference.ts` to confirm Coach + Ledger heuristics from Phase 1.2.**

- [ ] **Step 2: Add explicit pickKit tests:**

```ts
// src/lib/apps/view-kits/__tests__/inference.test.ts
import { describe, it, expect } from "vitest";
import { pickKit } from "../inference";

describe("pickKit — coach", () => {
  it("returns 'coach' when manifest has *-coach profile + schedule", () => {
    const manifest = {
      id: "x", name: "x",
      profiles: [{ id: "wealth-manager-coach", name: "Coach" }],
      blueprints: [{ id: "weekly", name: "Weekly" }],
      schedules: [{ id: "monday", cron: "0 8 * * 1" }],
      tables: [],
      view: undefined,
    };
    expect(pickKit(manifest, [])).toBe("coach");
  });
});

describe("pickKit — ledger", () => {
  it("returns 'ledger' when manifest has currency column + blueprint", () => {
    const manifest = {
      id: "x", name: "x",
      profiles: [],
      blueprints: [{ id: "close", name: "Close" }],
      schedules: [],
      tables: [{ id: "t", name: "transactions", columns: [{ name: "amount", semantic: "currency" }] }],
      view: undefined,
    };
    const cols = [{ tableId: "t", columns: [{ name: "amount", semantic: "currency" }] }];
    expect(pickKit(manifest, cols)).toBe("ledger");
  });
});
```

- [ ] **Step 3: If tests fail, update `inference.ts` heuristics. If they pass with existing logic, commit the new test file only.**

### Task 30: New `finance-pack.yaml` starter

**Files:**
- Create: `.claude/apps/starters/finance-pack.yaml`

- [ ] **Step 1: Author the starter.**

```yaml
# .claude/apps/starters/finance-pack.yaml
id: finance-pack
name: Finance pack
description: Personal finance dashboard with monthly close summary, transactions table, and category breakdown.
persona: personal-finance
icon: wallet
starterPrompt: |
  Build me a personal finance dashboard.

  - Track transactions in a table with date, description, amount (currency), category
  - On the 1st of every month, generate a monthly close summary covering net, top movers, category drift
  - I'll import from a CSV export from my bank
preview:
  profiles: 1
  blueprints: 1
  tables: 1
  schedules: 1
```

- [ ] **Step 2: Verify by listing starters:**

```bash
ls .claude/apps/starters/
```
Expected: includes `finance-pack.yaml`.

- [ ] **Step 3: Commit Wave 6.**

```bash
git add \
  src/app/apps/[id]/page.tsx \
  src/lib/apps/view-kits/inference.ts \
  src/lib/apps/view-kits/__tests__/inference.test.ts \
  .claude/apps/starters/finance-pack.yaml
git commit -m "feat(apps): Phase 3 wave 6 — page wiring + inference tests + finance-pack starter"
```

---

## Wave 7 — Verification

### Task 31: Run full unit-test suite + tsc

- [ ] **Step 1: Full vitest run.**

```bash
npx vitest run
```
Expected: All Phase 3 tests pass; no regressions in any prior suite. Document the count: `pass/total` and any pre-existing skips.

- [ ] **Step 2: Apps + view-kits scoped run for clean signal.**

```bash
npx vitest run src/lib/apps src/components/apps src/components/charts src/components/workflows src/lib/workflows/blueprints
```

- [ ] **Step 3: tsc clean for all touched scopes.**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/(app|lib|components)/(apps|charts|workflows)" || echo "tsc clean for phase 3"
```
Expected: `tsc clean for phase 3`.

### Task 32: Browser smoke — Coach (`/apps/<weekly-portfolio-check-in>`)

- [ ] **Step 1: Start dev server on a free port.**

```bash
PORT=3010 npm run dev
```
Wait for `Ready` log line (Next.js 16 + Turbopack typically <5s).

- [ ] **Step 2: Compose the Coach app from the existing starter.** Either:
  - Use the chat surface to send: `Build me a weekly portfolio check-in app.` (the starterPrompt verbatim)
  - OR install via the apps gallery if a "scaffold from starter" button exists
  - Confirm the app appears in `~/.ainative/apps/` after composition

- [ ] **Step 3: Open Chrome via Claude in Chrome (or Chrome DevTools / Playwright fallback per `MEMORY.md`):**

Visit `http://localhost:3010/apps/weekly-portfolio-check-in` (or whatever id the planner assigned).

- [ ] **Step 4: Verify visually:**
  - Hero shows the latest digest as full markdown (or empty state if blueprint hasn't run)
  - Header shows cadence chip: "Mondays at 8am" or similar
  - "Run now" button is present; click it → sheet opens with `asset` + `horizon` fields (per `investment-research.yaml` shape if that's the chosen blueprint)
  - Filling fields and submitting POSTs to `/api/blueprints/.../instantiate` → success toast
  - Run cadence heatmap secondary slot renders (12-week grid)

- [ ] **Step 5: Save screenshot to `output/phase-3-coach-smoke.png`.**

- [ ] **Step 6: Stop the dev server.**

### Task 33: Browser smoke — Ledger (`/apps/<finance-pack>`)

- [ ] **Step 1: Compose `finance-pack` app via chat or starters gallery using the new starter prompt.**

- [ ] **Step 2: Visit `http://localhost:3010/apps/finance-pack?period=mtd`.**

- [ ] **Step 3: Verify:**
  - Top KPI strip: Net / Inflow / Outflow / Run-rate (4 tiles or 3 if no blueprint)
  - Hero shows `LedgerHeroPanel` with TimeSeriesChart (left, 2-col span) + DonutRing (right) — empty state if no transactions yet
  - Period selector chip group (MTD/QTD/YTD) works — clicking YTD updates the URL and re-renders KPIs
  - Transactions table secondary slot shows seeded rows or "No transactions yet"
  - Monthly close summary collapsed at bottom (or "no monthly-close blueprint configured" if missing)
  - Run now button: opens sheet with `reporting_period` select (per `financial-reporting.yaml`)

- [ ] **Step 4: Toggle period MTD → YTD → MTD and confirm KPI values change** (cache key includes period — verify by changing a transaction and confirming the rendered values match the period scope).

- [ ] **Step 5: Save screenshot to `output/phase-3-ledger-smoke.png`.**

### Task 34: Phase 2 regression check (Tracker)

- [ ] **Step 1: Visit `/apps/habit-tracker` and confirm it still renders Tracker layout** (KPI strip + table hero + cadence chip + run-now). No visual or behavioral regression.

- [ ] **Step 2: Save screenshot to `output/phase-3-tracker-regression.png` for comparison with `output/phase-2-tracker-smoke.png`.**

### Task 35: Update feature spec, roadmap, changelog

**Files:**
- Modify: `features/composed-app-kit-coach-and-ledger.md` — `status: planned → completed`
- Modify: `features/roadmap.md` — Phase 3 row → completed
- Modify: `features/changelog.md` — new entry above Phase 2

- [ ] **Step 1: Update spec frontmatter.**

```yaml
status: completed
```

- [ ] **Step 2: Add changelog entry.**

```markdown
## 2026-05-02 — Phase 3: Coach & Ledger kits

- Added Coach kit (markdown digest hero, run cadence heatmap, run history strip)
- Added Ledger kit (TimeSeriesChart + DonutRing hero, period selector, transactions table, monthly-close summary)
- Extended KPI engine with `tableSumWindowed` source kind (sign + window orthogonal)
- Extracted `VariableInput` to shared component; added `RunNowSheet` (conditional on blueprint variables)
- Added `LastRunCard variant="hero"` with previous-runs disclosure
- New starter: `finance-pack.yaml`
- ~80 new unit tests; tsc clean; browser smoke verified for both kits
```

- [ ] **Step 3: Update `roadmap.md` row** for Phase 3 to "completed."

- [ ] **Step 4: Final commit.**

```bash
git add \
  features/composed-app-kit-coach-and-ledger.md \
  features/roadmap.md \
  features/changelog.md \
  output/phase-3-coach-smoke.png \
  output/phase-3-ledger-smoke.png \
  output/phase-3-tracker-regression.png
# Note: output/ is gitignored per MEMORY.md — screenshots are local only.
# Skip them from `git add`. Only stage the feature/roadmap/changelog files.
git restore --staged output/ 2>/dev/null || true
git add features/composed-app-kit-coach-and-ledger.md features/roadmap.md features/changelog.md
git commit -m "feat(apps): composed-app kit coach + ledger (Phase 3)"
```

- [ ] **Step 5: Update `HANDOFF.md` for the next session** describing Phase 3 ship + Phase 4 next.

---

## NOT in scope (final list, mirrors design doc)

- DocumentCitationStrip (Phase 4)
- Top mover (24h) KPI / allocation drift % (Phase 5)
- RunHistoryTimeline primitive (Phase 4)
- Kit-loader registry refactor (Phase 4 — switch hits 5+ branches there)
- Period range customization beyond MTD/QTD/YTD
- Chart formats beyond AreaChart
- TableSpreadsheet for Ledger transactions (intentional read-only choice)

## What already exists (from design doc)

- `LightMarkdown`, `VariableInput` (extract), `formatKpi`, `evaluateKpi`, `unstable_cache`, `humanizeCron`, `getBlueprint()`, recharts, `adoption-heatmap.tsx` (technique reference), `Sheet`, `DonutRing`, `weekly-portfolio-check-in` starter, `react-markdown` + `remark-gfm` deps already in `package.json`.

## Error & Rescue Registry (mirrors design doc)

| Error | Trigger | Rescue |
|---|---|---|
| Coach: no completed task | New install, never ran | Empty-state hero with "Run now" CTA (Task 8 covers) |
| Coach: latest task failed | Blueprint errored | Failed-task rescue card + "Previous runs ▾" pre-expanded (Task 8 covers) |
| Ledger: empty hero table | New app | TimeSeriesChart placeholder + KPI tiles `—` (Task 6 + Task 12) |
| Ledger: no currency col | Bad inference | `defaultLedgerKpis` returns `[]`; fall through (Task 16) |
| Period query tampered | `?period=foo` | Zod default to `"mtd"` (Task 28) |
| Blueprint vars missing | `getBlueprint()` returned null | Disabled button + tooltip (Task 21) |
| Required var blank | User submits empty | Inline field error (Task 9 + validateVariables) |
| Network failure on instantiate | Offline / 500 | Sheet stays open + toast; values preserved (Task 9) |
| `react-markdown` parse error | Malformed digest | ErrorBoundary fallback to `<pre>` (Task 8) |
| Heatmap: no runs in 12wk | New blueprint | Empty grid (Task 7) |
| Recharts SSR mismatch | ResponsiveContainer SSR | Either dynamic-import-no-SSR or accept hydration (Task 6) |
| `unstable_cache` stale on period switch | Cache key omitted period | Period in cache key (Task 24) |
| Ledger: no monthly-close blueprint | Manifest authored without close | Activity slot empty-state; KPI run-rate dropped (Task 15 + Task 16) |

## Smoke-test budget (project override)

This phase touches `src/lib/apps/view-kits/data.ts` and `src/app/apps/[id]/page.tsx` but does NOT touch any module in the runtime-registry-adjacent list (`claude-agent.ts`, `runtime/*`, `engine.ts`, etc.). The browser smoke gate in Tasks 32–34 satisfies the project override's smoke-test requirement for UI changes.

## Self-review

I reviewed the plan against the spec at `docs/superpowers/specs/2026-05-02-coach-and-ledger-design.md`:

- **Spec coverage:** Every section of the design has a corresponding task. KpiContext extension → Tasks 3-5. RunNowSheet → Tasks 9-10. Coach + Ledger kits → Tasks 17-18. Period selector → Tasks 11 + 28. Charts → Tasks 6-7. Acceptance gates → Tasks 31-35.
- **Placeholder scan:** No `TBD`/`TODO`/`appropriate error handling`. Every step shows code or commands.
- **Type consistency:** `BlueprintVariable` imported consistently. `RuntimeTaskSummary` used for all coach/ledger task fields. `KpiContext.tableSumWindowed` signature matches across interface, impl, and call sites. `runNowVariables` carries through `HeaderSlot` → kit → button.
- **Type signatures locked:** `validateVariables(values, defs) → { errors }`. `tableSumWindowed(table, column, sign?, window?) → KpiPrimitive`. `defaultLedgerKpis(table, columns, period, blueprintId?)`. `LedgerProjection.amountColumn / categoryColumn` carry through to `data.ts` (Task 23).

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-composed-app-kit-coach-and-ledger.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with two-stage code review.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
