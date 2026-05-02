# Composed App Kits — Tracker & Workflow Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 2 of the Composed Apps Domain-Aware View — two real view kits (Tracker, Workflow Hub) plus four shared primitives and a 5-branch KPI evaluation engine. Replaces the placeholder fallback with real domain-aware UIs the moment Phase 1 + 2 land.

**Architecture:** Kits stay **pure projection functions** (no React state, no fetching). KPI evaluation is a single switch over `KpiSpec.source.kind`. The data layer (`loadRuntimeState`) becomes kit-aware, fetching only what the picked kit needs. Slot renderers gain Phase 2 rendering branches. The strict `view:` schema from Phase 1.2 is the contract surface; nothing in Phase 2 weakens it.

**Tech Stack:** Next.js 16 App Router, React 19 server components for kit code paths, TypeScript strict, Drizzle + better-sqlite3, vitest for unit tests, Tailwind v4 + shadcn/ui (New York). No new dependencies.

**Source spec:** `features/composed-app-kit-tracker-and-hub.md`. **Predecessor:** `docs/superpowers/specs/` (none — strategy doc lives in `ideas/composed-apps-domain-aware-view.md`; per-phase specs live in `features/`).

---

## File Structure

### New files

```
src/lib/apps/view-kits/evaluate-kpi.ts          # KPI engine — pure switch + KpiContext interface
src/lib/apps/view-kits/format-kpi.ts            # Number→display-string adapters (5 formats)
src/lib/apps/view-kits/default-kpis.ts          # defaultTrackerKpis(columns) synthesizer
src/lib/apps/view-kits/kpi-context.ts           # createKpiContext() — DB-backed concrete impl
src/lib/apps/view-kits/kits/workflow-hub.ts     # WorkflowHubKit definition
src/lib/apps/view-kits/kits/tracker.ts          # TrackerKit definition

src/components/apps/kpi-strip.tsx               # Generic 1-6 tile horizontal strip
src/components/apps/last-run-card.tsx           # Schedule × blueprint × last task status card
src/components/apps/schedule-cadence-chip.tsx   # humanizeCron + countdown chip
src/components/apps/run-now-button.tsx          # Posts to blueprint instantiate; opens inputs sheet

# Tests
src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts
src/lib/apps/view-kits/__tests__/format-kpi.test.ts
src/lib/apps/view-kits/__tests__/default-kpis.test.ts
src/lib/apps/view-kits/__tests__/workflow-hub.test.ts
src/lib/apps/view-kits/__tests__/tracker.test.ts
src/components/apps/__tests__/kpi-strip.test.tsx
src/components/apps/__tests__/last-run-card.test.tsx
src/components/apps/__tests__/schedule-cadence-chip.test.tsx
src/components/apps/__tests__/run-now-button.test.tsx
```

### Modified files

```
src/lib/apps/view-kits/types.ts                 # Extend RuntimeState with Phase 2 fields; add KpiTile.spark? + KpiTile.value: string|number; add HeroSlot.kind values
src/lib/apps/view-kits/index.ts                 # Register tracker + workflow-hub in viewKits map
src/lib/apps/view-kits/data.ts                  # Kit-aware loadRuntimeState — populate Phase 2 fields based on picked kit + projection
src/components/apps/kit-view/kit-view.tsx       # Pass cadence chip into header; no structural change
src/components/apps/kit-view/slots/header.tsx   # Render header.cadenceChip + runNowButton (if model carries them)
src/components/apps/kit-view/slots/kpis.tsx     # Replace inline grid with KPIStrip primitive
src/components/apps/kit-view/slots/hero.tsx     # No change — already passes through `slot.content`
src/components/apps/kit-view/slots/secondary.tsx # No change
src/components/apps/kit-view/slots/activity.tsx  # No change

src/app/apps/[id]/page.tsx                      # Pass kit.id + projection into loadRuntimeState

features/composed-app-kit-tracker-and-hub.md    # status: planned → completed
features/roadmap.md                             # Update status column
features/changelog.md                           # New 2026-05-02 entry above Phase 1.2
```

### Why these boundaries

- **Kits stay tiny pure files** (`workflow-hub.ts`, `tracker.ts`) — both ≤120 lines, no React import, no DB import. They consume `RuntimeState` and produce `ViewModel`.
- **`evaluate-kpi.ts` separates the algorithm from data access.** The switch is fully unit-testable with an injected `KpiContext` mock; the real `kpi-context.ts` wraps DB queries.
- **`format-kpi.ts`** is its own file because formatters are reused by both `KPIStrip` and any future debug/log surface.
- **Each primitive is one file** — the four primitives are siblings under `src/components/apps/`, **flat** (not under `kit-view/primitives/`) per the spec's path-table.
- **Slot renderers stay thin pass-throughs** — the model carries the React content already built by the kit. Header is the only one that gains real rendering logic (it composes cadence chip + run-now + actions).

---

## Conventions for every task

- After every step that changes code, run `npx tsc --noEmit 2>&1 | grep "src/(app|lib|components)/apps" || echo "tsc clean for apps"` before moving to the next step. The TS diagnostics panel is flaky in this repo (per `MEMORY.md` lessons learned) — trust the CLI output.
- For each new test file, follow the existing pattern in `src/lib/apps/view-kits/__tests__/dispatcher.test.ts`: `describe` → `it("does X", () => {...})`, vitest only, no jest globals.
- For React component tests, follow `src/components/dashboard/__tests__/accessibility.test.tsx` patterns: `@testing-library/react` + `@testing-library/jest-dom` matchers via `vitest`.
- **Never use `git add -A`** — name files explicitly. Per `MEMORY.md` feedback rule.
- **Commit at the end** — single bundled commit for Phase 2. Title: `feat(apps): composed-app kit tracker + workflow-hub (Phase 2)`. Match the Phase 1.1/1.2 commit style.

---

## Layer 1 — Pure logic (KPI engine + formatters)

Build the KPI evaluation engine and formatter helpers first. They have zero dependencies on React or the DB, are fully unit-testable in isolation, and unblock kit construction.

### Task 1: `format-kpi.ts` — value → display-string

**Files:**
- Create: `src/lib/apps/view-kits/format-kpi.ts`
- Test: `src/lib/apps/view-kits/__tests__/format-kpi.test.ts`

- [ ] **Step 1.1: Write the failing test**

```ts
// src/lib/apps/view-kits/__tests__/format-kpi.test.ts
import { describe, expect, it } from "vitest";
import { formatKpi } from "../format-kpi";

describe("formatKpi — value to display string", () => {
  it("formats integers with thousand separators", () => {
    expect(formatKpi(1234, "int")).toBe("1,234");
    expect(formatKpi(0, "int")).toBe("0");
    expect(formatKpi(7, "int")).toBe("7");
  });

  it("formats currency with USD symbol and 2 decimals", () => {
    expect(formatKpi(12.5, "currency")).toBe("$12.50");
    expect(formatKpi(1234.5, "currency")).toBe("$1,234.50");
    expect(formatKpi(0, "currency")).toBe("$0.00");
  });

  it("formats percent values (0..1) as %", () => {
    expect(formatKpi(0.42, "percent")).toBe("42%");
    expect(formatKpi(1, "percent")).toBe("100%");
    expect(formatKpi(0, "percent")).toBe("0%");
  });

  it("formats duration values (seconds) as compact label", () => {
    expect(formatKpi(45, "duration")).toBe("45s");
    expect(formatKpi(125, "duration")).toBe("2m 5s");
    expect(formatKpi(3700, "duration")).toBe("1h 1m");
  });

  it("formats relative timestamps (epoch ms) as 'in 2h' / '3d ago'", () => {
    const now = Date.now();
    expect(formatKpi(now + 2 * 3_600_000, "relative")).toMatch(/in 2h/);
    expect(formatKpi(now - 3 * 86_400_000, "relative")).toMatch(/3d ago/);
  });

  it("returns string values unchanged when given a string", () => {
    expect(formatKpi("custom", "int")).toBe("custom");
  });

  it("renders null/undefined values as em dash", () => {
    expect(formatKpi(null, "int")).toBe("—");
    expect(formatKpi(undefined, "int")).toBe("—");
  });
});
```

- [ ] **Step 1.2: Run the test and verify it fails**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/format-kpi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement `format-kpi.ts`**

```ts
// src/lib/apps/view-kits/format-kpi.ts

export type KpiFormat = "int" | "currency" | "percent" | "duration" | "relative";

export type KpiPrimitive = number | string | null | undefined;

/**
 * Formats a raw KPI value into a display string. Pure helper used by both the
 * KPIStrip primitive and any debug surface. Returns "—" for null/undefined,
 * passes strings through unchanged, and dispatches numbers per `format`.
 *
 * Why em-dash for null: design system convention for "no value yet" — softer
 * than "0" and avoids miscommunicating an empty signal as a real zero.
 */
export function formatKpi(value: KpiPrimitive, format: KpiFormat): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  switch (format) {
    case "int":
      return new Intl.NumberFormat("en-US").format(Math.round(value));
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case "percent":
      return `${Math.round(value * 100)}%`;
    case "duration":
      return formatDuration(value);
    case "relative":
      return formatRelative(value);
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const remSec = Math.round(seconds - minutes * 60);
    return remSec === 0 ? `${minutes}m` : `${minutes}m ${remSec}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes - hours * 60;
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}

function formatRelative(epochMs: number): string {
  const diffMs = epochMs - Date.now();
  const absDays = Math.abs(diffMs) / 86_400_000;
  const absHours = Math.abs(diffMs) / 3_600_000;
  const absMin = Math.abs(diffMs) / 60_000;
  const future = diffMs > 0;
  let unit: string;
  if (absDays >= 1) unit = `${Math.round(absDays)}d`;
  else if (absHours >= 1) unit = `${Math.round(absHours)}h`;
  else unit = `${Math.max(1, Math.round(absMin))}m`;
  return future ? `in ${unit}` : `${unit} ago`;
}
```

- [ ] **Step 1.4: Run the test and verify it passes**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/format-kpi.test.ts`
Expected: PASS — all 7 tests green.

---

### Task 2: `evaluate-kpi.ts` — pure 5-branch switch + KpiContext interface

**Files:**
- Create: `src/lib/apps/view-kits/evaluate-kpi.ts`
- Test: `src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts`

- [ ] **Step 2.1: Write the failing test**

```ts
// src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts
import { describe, expect, it, vi } from "vitest";
import { evaluateKpi, type KpiContext } from "../evaluate-kpi";
import type { ViewConfig } from "@/lib/apps/registry";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];

function makeCtx(over: Partial<KpiContext> = {}): KpiContext {
  return {
    tableCount: vi.fn(async () => 42),
    tableSum: vi.fn(async () => 100),
    tableLatest: vi.fn(async () => "bar"),
    blueprintRunCount: vi.fn(async () => 7),
    scheduleNextFire: vi.fn(async () => 1_700_000_000_000),
    ...over,
  };
}

describe("evaluateKpi — pure switch over KpiSpec.source.kind", () => {
  it("dispatches tableCount to ctx.tableCount", async () => {
    const tableCount = vi.fn(async () => 5);
    const spec: KpiSpec = {
      id: "active",
      label: "Active",
      source: { kind: "tableCount", table: "tbl-1" },
      format: "int",
    };
    const tile = await evaluateKpi(spec, makeCtx({ tableCount }));
    expect(tableCount).toHaveBeenCalledWith("tbl-1", undefined);
    expect(tile).toEqual({ id: "active", label: "Active", value: "5" });
  });

  it("dispatches tableSum and formats currency", async () => {
    const tableSum = vi.fn(async () => 1234.5);
    const spec: KpiSpec = {
      id: "total",
      label: "Total",
      source: { kind: "tableSum", table: "tbl-1", column: "amount" },
      format: "currency",
    };
    const tile = await evaluateKpi(spec, makeCtx({ tableSum }));
    expect(tableSum).toHaveBeenCalledWith("tbl-1", "amount");
    expect(tile.value).toBe("$1,234.50");
  });

  it("dispatches tableLatest and passes strings through", async () => {
    const tableLatest = vi.fn(async () => "running");
    const spec: KpiSpec = {
      id: "last-status",
      label: "Last status",
      source: { kind: "tableLatest", table: "tbl-1", column: "status" },
      format: "int",
    };
    const tile = await evaluateKpi(spec, makeCtx({ tableLatest }));
    expect(tableLatest).toHaveBeenCalledWith("tbl-1", "status");
    expect(tile.value).toBe("running");
  });

  it("dispatches blueprintRunCount with window default", async () => {
    const blueprintRunCount = vi.fn(async () => 12);
    const spec: KpiSpec = {
      id: "runs",
      label: "Runs (7d)",
      source: { kind: "blueprintRunCount", blueprint: "bp-1", window: "7d" },
      format: "int",
    };
    const tile = await evaluateKpi(spec, makeCtx({ blueprintRunCount }));
    expect(blueprintRunCount).toHaveBeenCalledWith("bp-1", "7d");
    expect(tile.value).toBe("12");
  });

  it("dispatches scheduleNextFire and formats relative", async () => {
    const future = Date.now() + 2 * 86_400_000;
    const scheduleNextFire = vi.fn(async () => future);
    const spec: KpiSpec = {
      id: "next",
      label: "Next run",
      source: { kind: "scheduleNextFire", schedule: "sch-1" },
      format: "relative",
    };
    const tile = await evaluateKpi(spec, makeCtx({ scheduleNextFire }));
    expect(scheduleNextFire).toHaveBeenCalledWith("sch-1");
    expect(tile.value).toMatch(/in 2d/);
  });

  it("renders null source values as em dash", async () => {
    const tableLatest = vi.fn(async () => null);
    const spec: KpiSpec = {
      id: "x",
      label: "X",
      source: { kind: "tableLatest", table: "t", column: "c" },
      format: "int",
    };
    const tile = await evaluateKpi(spec, makeCtx({ tableLatest }));
    expect(tile.value).toBe("—");
  });
});
```

- [ ] **Step 2.2: Run the test and verify it fails**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement `evaluate-kpi.ts`**

```ts
// src/lib/apps/view-kits/evaluate-kpi.ts
import type { ViewConfig } from "@/lib/apps/registry";
import { formatKpi, type KpiPrimitive } from "./format-kpi";
import type { KpiTile } from "./types";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];

/**
 * Data-access surface for KPI evaluation. Concrete implementations live in
 * `kpi-context.ts` (DB-backed) and tests (in-memory mocks). Each method
 * returns the raw value; formatting happens in `evaluateKpi`.
 *
 * Why an interface (rather than direct DB calls inside `evaluateKpi`):
 * the switch stays unit-testable without a DB, and Phase 3+ kits can extend
 * the interface without touching this file.
 */
export interface KpiContext {
  tableCount(table: string, where: string | undefined): Promise<KpiPrimitive>;
  tableSum(table: string, column: string): Promise<KpiPrimitive>;
  tableLatest(table: string, column: string): Promise<KpiPrimitive>;
  blueprintRunCount(blueprint: string, window: "7d" | "30d"): Promise<KpiPrimitive>;
  scheduleNextFire(schedule: string): Promise<KpiPrimitive>;
}

/**
 * Pure switch over `KpiSpec.source.kind`. New source kinds require a code
 * change here AND a Zod arm in `KpiSpecSchema` — by design (no formula
 * strings, no manifest escape hatch).
 */
export async function evaluateKpi(spec: KpiSpec, ctx: KpiContext): Promise<KpiTile> {
  let raw: KpiPrimitive;
  switch (spec.source.kind) {
    case "tableCount":
      raw = await ctx.tableCount(spec.source.table, spec.source.where);
      break;
    case "tableSum":
      raw = await ctx.tableSum(spec.source.table, spec.source.column);
      break;
    case "tableLatest":
      raw = await ctx.tableLatest(spec.source.table, spec.source.column);
      break;
    case "blueprintRunCount":
      raw = await ctx.blueprintRunCount(spec.source.blueprint, spec.source.window);
      break;
    case "scheduleNextFire":
      raw = await ctx.scheduleNextFire(spec.source.schedule);
      break;
  }
  return {
    id: spec.id,
    label: spec.label,
    value: formatKpi(raw, spec.format),
  };
}
```

- [ ] **Step 2.4: Run the test and verify it passes**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts`
Expected: PASS — all 6 tests green.

---

### Task 3: `default-kpis.ts` — synthesize KpiSpecs for tracker apps

**Files:**
- Create: `src/lib/apps/view-kits/default-kpis.ts`
- Test: `src/lib/apps/view-kits/__tests__/default-kpis.test.ts`

- [ ] **Step 3.1: Write the failing test**

```ts
// src/lib/apps/view-kits/__tests__/default-kpis.test.ts
import { describe, expect, it } from "vitest";
import { defaultTrackerKpis } from "../default-kpis";

describe("defaultTrackerKpis — synthesizes KpiSpecs from hero columns", () => {
  it("returns empty when no table is provided", () => {
    expect(defaultTrackerKpis(undefined, [])).toEqual([]);
  });

  it("synthesizes a 'Total entries' tableCount KPI", () => {
    const kpis = defaultTrackerKpis("tbl-1", [
      { name: "habit", type: "text" },
      { name: "active", type: "boolean" },
    ]);
    expect(kpis[0]).toMatchObject({
      label: "Total entries",
      source: { kind: "tableCount", table: "tbl-1" },
      format: "int",
    });
  });

  it("synthesizes an 'Active' tableCount KPI when an active boolean column exists", () => {
    const kpis = defaultTrackerKpis("tbl-1", [
      { name: "habit", type: "text" },
      { name: "active", type: "boolean" },
    ]);
    const active = kpis.find((k) => k.label === "Active");
    expect(active).toBeDefined();
    expect(active?.source).toMatchObject({
      kind: "tableCount",
      table: "tbl-1",
      where: "active",
    });
  });

  it("synthesizes a 'Current streak' tableLatest KPI when a *_streak column exists", () => {
    const kpis = defaultTrackerKpis("tbl-1", [
      { name: "habit", type: "text" },
      { name: "current_streak", type: "number" },
    ]);
    const streak = kpis.find((k) => k.label === "Current streak");
    expect(streak).toBeDefined();
    expect(streak?.source).toMatchObject({
      kind: "tableLatest",
      table: "tbl-1",
      column: "current_streak",
    });
  });

  it("returns at most 4 KPIs", () => {
    const kpis = defaultTrackerKpis("tbl-1", [
      { name: "active", type: "boolean" },
      { name: "completed", type: "boolean" },
      { name: "current_streak", type: "number" },
      { name: "best_streak", type: "number" },
      { name: "amount", type: "number" },
    ]);
    expect(kpis.length).toBeLessThanOrEqual(4);
  });

  it("assigns unique stable ids", () => {
    const kpis = defaultTrackerKpis("tbl-1", [
      { name: "active", type: "boolean" },
      { name: "current_streak", type: "number" },
    ]);
    const ids = kpis.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 3.2: Run the test and verify it fails**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/default-kpis.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement `default-kpis.ts`**

```ts
// src/lib/apps/view-kits/default-kpis.ts
import type { ViewConfig } from "@/lib/apps/registry";
import type { ColumnSchemaRef } from "./types";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];
type Col = ColumnSchemaRef["columns"][number];

const STREAK_RE = /(^|_)streak($|_)/i;
const ACTIVE_RE = /^active$/i;

/**
 * Synthesizes 1-4 KpiSpecs for a tracker app whose manifest doesn't declare
 * `view.bindings.kpis`. Picks at most one of each kind to avoid duplicate
 * tiles. Apps that want explicit KPIs should declare them in the manifest;
 * Phase 5 (`composed-app-auto-inference-hardening`) tightens the synthesis.
 */
export function defaultTrackerKpis(
  heroTableId: string | undefined,
  columns: Col[]
): KpiSpec[] {
  if (!heroTableId) return [];
  const specs: KpiSpec[] = [];

  // Always: total entries
  specs.push({
    id: "default-total",
    label: "Total entries",
    source: { kind: "tableCount", table: heroTableId },
    format: "int",
  });

  // If an `active` boolean column exists, add an "Active" filtered count.
  const activeCol = columns.find(
    (c) => c.type === "boolean" && ACTIVE_RE.test(c.name)
  );
  if (activeCol) {
    specs.push({
      id: "default-active",
      label: "Active",
      source: { kind: "tableCount", table: heroTableId, where: activeCol.name },
      format: "int",
    });
  }

  // If a *_streak column exists, surface its latest value.
  const streakCol = columns.find((c) => STREAK_RE.test(c.name));
  if (streakCol) {
    specs.push({
      id: "default-streak",
      label: "Current streak",
      source: {
        kind: "tableLatest",
        table: heroTableId,
        column: streakCol.name,
      },
      format: "int",
    });
  }

  return specs.slice(0, 4);
}
```

- [ ] **Step 3.4: Run the test and verify it passes**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/default-kpis.test.ts`
Expected: PASS — all 6 tests green.

---

## Layer 2 — DB-backed KpiContext

### Task 4: `kpi-context.ts` — concrete KpiContext over DB

**Files:**
- Create: `src/lib/apps/view-kits/kpi-context.ts`

**No unit tests** — this file is a thin adapter over Drizzle queries. Its correctness is exercised by the kit unit tests (which mock it) plus the browser smoke at the end. Adding mock-DB tests here would only verify the test harness, not the production behavior.

- [ ] **Step 4.1: Implement `kpi-context.ts`**

```ts
// src/lib/apps/view-kits/kpi-context.ts
import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, schedules, userTableRows } from "@/lib/db/schema";
import type { KpiContext } from "./evaluate-kpi";
import type { KpiPrimitive } from "./format-kpi";

/**
 * DB-backed KpiContext used by `loadRuntimeState` in production. Tests inject
 * mock contexts directly into `evaluateKpi`. Kept separate from the engine so
 * the engine stays runtime-agnostic.
 *
 * Window math note: 7d/30d windows are computed from `Date.now()` at call
 * time. Caching of the resulting tiles happens upstream via `unstable_cache`
 * in `data.ts`.
 */
export function createKpiContext(): KpiContext {
  return {
    async tableCount(tableId, where) {
      try {
        if (where) {
          // `where` is a column name — interpret as `data.<col>` truthy filter.
          // Drizzle has no direct JSON predicate, so fall back to raw SQL.
          const rows = db
            .select({ value: count() })
            .from(userTableRows)
            .where(
              and(
                eq(userTableRows.tableId, tableId),
                sql`json_extract(${userTableRows.data}, ${"$." + where}) = 1
                    OR json_extract(${userTableRows.data}, ${"$." + where}) = 'true'`
              )
            )
            .all();
          return rows[0]?.value ?? 0;
        }
        const rows = db
          .select({ value: count() })
          .from(userTableRows)
          .where(eq(userTableRows.tableId, tableId))
          .all();
        return rows[0]?.value ?? 0;
      } catch {
        return null;
      }
    },

    async tableSum(tableId, column) {
      try {
        const rows = db
          .select({
            value: sql<number>`COALESCE(SUM(CAST(json_extract(${userTableRows.data}, ${"$." + column}) AS REAL)), 0)`,
          })
          .from(userTableRows)
          .where(eq(userTableRows.tableId, tableId))
          .all();
        return rows[0]?.value ?? 0;
      } catch {
        return null;
      }
    },

    async tableLatest(tableId, column) {
      try {
        const row = db
          .select({
            value: sql<KpiPrimitive>`json_extract(${userTableRows.data}, ${"$." + column})`,
          })
          .from(userTableRows)
          .where(eq(userTableRows.tableId, tableId))
          .orderBy(desc(userTableRows.createdAt))
          .limit(1)
          .get();
        return (row?.value ?? null) as KpiPrimitive;
      } catch {
        return null;
      }
    },

    async blueprintRunCount(blueprint, window) {
      try {
        const ms = window === "30d" ? 30 * 86_400_000 : 7 * 86_400_000;
        const since = new Date(Date.now() - ms);
        // Tasks aren't directly tagged with blueprint id; we approximate by
        // matching `assignedAgent` or `agentProfile` containing the blueprint
        // string. Phase 5 will add a first-class blueprintId column.
        const rows = db
          .select({ value: count() })
          .from(tasks)
          .where(
            and(
              gte(tasks.createdAt, since),
              sql`(${tasks.assignedAgent} = ${blueprint}
                   OR ${tasks.agentProfile} = ${blueprint})`
            )
          )
          .all();
        return rows[0]?.value ?? 0;
      } catch {
        return null;
      }
    },

    async scheduleNextFire(scheduleId) {
      try {
        const row = db
          .select({ value: schedules.nextFireAt })
          .from(schedules)
          .where(eq(schedules.id, scheduleId))
          .get();
        return row?.value ? row.value.getTime() : null;
      } catch {
        return null;
      }
    },
  };
}
```

- [ ] **Step 4.2: Verify tsc**

Run: `npx tsc --noEmit 2>&1 | grep "kpi-context\|evaluate-kpi\|format-kpi\|default-kpis" || echo "tsc clean"`
Expected: `tsc clean`.

---

## Layer 3 — UI primitives

Four shared primitives. Each gets a focused test for its core behavior — not exhaustive pixel coverage, just the contract that consumers depend on.

### Task 5: `KPIStrip` primitive

**Files:**
- Create: `src/components/apps/kpi-strip.tsx`
- Test: `src/components/apps/__tests__/kpi-strip.test.tsx`

- [ ] **Step 5.1: Write the failing test**

```tsx
// src/components/apps/__tests__/kpi-strip.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KPIStrip } from "../kpi-strip";
import type { KpiTile } from "@/lib/apps/view-kits/types";

describe("KPIStrip", () => {
  const tile = (id: string, label: string, value: string): KpiTile => ({
    id,
    label,
    value,
  });

  it("renders nothing when tiles is empty", () => {
    const { container } = render(<KPIStrip tiles={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one tile with label and value", () => {
    render(<KPIStrip tiles={[tile("a", "Active", "5")]} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders 6 tiles in a responsive grid", () => {
    const tiles = Array.from({ length: 6 }, (_, i) =>
      tile(`k${i}`, `Label ${i}`, `${i * 10}`)
    );
    render(<KPIStrip tiles={tiles} />);
    expect(screen.getByText("Label 0")).toBeInTheDocument();
    expect(screen.getByText("Label 5")).toBeInTheDocument();
  });

  it("renders the optional hint when present", () => {
    render(
      <KPIStrip
        tiles={[{ id: "a", label: "Active", value: "5", hint: "in last 7d" }]}
      />
    );
    expect(screen.getByText("in last 7d")).toBeInTheDocument();
  });

  it("clips at 6 tiles when more are passed", () => {
    const tiles = Array.from({ length: 8 }, (_, i) =>
      tile(`k${i}`, `Label ${i}`, `${i}`)
    );
    render(<KPIStrip tiles={tiles} />);
    expect(screen.queryByText("Label 6")).toBeNull();
    expect(screen.queryByText("Label 7")).toBeNull();
  });
});
```

- [ ] **Step 5.2: Run the test and verify it fails**

Run: `npx vitest run src/components/apps/__tests__/kpi-strip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement `kpi-strip.tsx`**

```tsx
// src/components/apps/kpi-strip.tsx
import type { KpiTile } from "@/lib/apps/view-kits/types";

interface KPIStripProps {
  tiles: KpiTile[];
}

/**
 * Generic 1-6 tile horizontal strip used by composed-app view kits. Pure
 * presentation — no DB, no state. The view-model author (a kit) is
 * responsible for evaluating KpiSpecs into KpiTile values; this component
 * just renders them.
 *
 * Why clip at 6: the responsive grid (lg:grid-cols-6) wraps awkwardly past
 * 6, and 6 is the design ceiling per the spec. Authors needing 7+ should
 * compose two strips.
 */
export function KPIStrip({ tiles }: KPIStripProps) {
  if (tiles.length === 0) return null;
  const visible = tiles.slice(0, 6);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {visible.map((tile) => (
        <div
          key={tile.id}
          className="rounded-lg border bg-card p-3 space-y-1"
          data-kit-primitive="kpi-tile"
        >
          <div className="text-xs text-muted-foreground">{tile.label}</div>
          <div className="text-lg font-semibold tracking-tight">{tile.value}</div>
          {tile.hint && (
            <div className="text-[11px] text-muted-foreground">{tile.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5.4: Run the test and verify it passes**

Run: `npx vitest run src/components/apps/__tests__/kpi-strip.test.tsx`
Expected: PASS — all 5 tests green.

---

### Task 6: `ScheduleCadenceChip` primitive

**Files:**
- Create: `src/components/apps/schedule-cadence-chip.tsx`
- Test: `src/components/apps/__tests__/schedule-cadence-chip.test.tsx`

- [ ] **Step 6.1: Write the failing test**

```tsx
// src/components/apps/__tests__/schedule-cadence-chip.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleCadenceChip } from "../schedule-cadence-chip";

describe("ScheduleCadenceChip", () => {
  it("renders nothing when humanLabel is null", () => {
    const { container } = render(
      <ScheduleCadenceChip humanLabel={null} nextFireMs={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders just the human label when nextFireMs is null", () => {
    render(<ScheduleCadenceChip humanLabel="daily 8pm" nextFireMs={null} />);
    expect(screen.getByText(/daily 8pm/i)).toBeInTheDocument();
  });

  it("renders human label + relative time when nextFireMs is in future", () => {
    const future = Date.now() + 2 * 86_400_000 + 4 * 3_600_000;
    render(<ScheduleCadenceChip humanLabel="daily 8pm" nextFireMs={future} />);
    const text = screen.getByText(/daily 8pm.*in 2d/i);
    expect(text).toBeInTheDocument();
  });

  it("renders 'overdue' when nextFireMs is in past", () => {
    const past = Date.now() - 60_000;
    render(<ScheduleCadenceChip humanLabel="daily 8pm" nextFireMs={past} />);
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Run the test and verify it fails**

Run: `npx vitest run src/components/apps/__tests__/schedule-cadence-chip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement `schedule-cadence-chip.tsx`**

```tsx
// src/components/apps/schedule-cadence-chip.tsx
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ScheduleCadenceChipProps {
  humanLabel: string | null;
  nextFireMs: number | null;
}

/**
 * Compact "daily 8pm · in 2d 4h" chip for the kit header. Pure presentation
 * — the human cron label and next-fire ms are computed upstream (data.ts via
 * `humanizeCron` + `schedules.nextFireAt`). Click-to-edit is deferred to a
 * later phase; today the chip is information-only.
 */
export function ScheduleCadenceChip({
  humanLabel,
  nextFireMs,
}: ScheduleCadenceChipProps) {
  if (!humanLabel) return null;
  const suffix = nextFireMs == null ? null : relativeSuffix(nextFireMs);
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Clock className="h-3 w-3" />
      <span>{humanLabel}</span>
      {suffix && <span className="text-muted-foreground">· {suffix}</span>}
    </Badge>
  );
}

function relativeSuffix(epochMs: number): string {
  const diff = epochMs - Date.now();
  if (diff <= 0) return "overdue";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days >= 1) return hours > 0 ? `in ${days}d ${hours}h` : `in ${days}d`;
  if (hours >= 1) return `in ${hours}h`;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  return `in ${minutes}m`;
}
```

- [ ] **Step 6.4: Run the test and verify it passes**

Run: `npx vitest run src/components/apps/__tests__/schedule-cadence-chip.test.tsx`
Expected: PASS — all 4 tests green.

---

### Task 7: `RunNowButton` primitive

**Files:**
- Create: `src/components/apps/run-now-button.tsx`
- Test: `src/components/apps/__tests__/run-now-button.test.tsx`

- [ ] **Step 7.1: Write the failing test**

```tsx
// src/components/apps/__tests__/run-now-button.test.tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RunNowButton } from "../run-now-button";

describe("RunNowButton", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("renders nothing when blueprintId is missing", () => {
    const { container } = render(<RunNowButton blueprintId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the trigger button when blueprintId is present", () => {
    render(<RunNowButton blueprintId="bp-1" />);
    expect(screen.getByRole("button", { name: /run now/i })).toBeInTheDocument();
  });

  it("posts to /api/blueprints/[id]/instantiate on click", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ workflowId: "wf-1" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
    render(<RunNowButton blueprintId="bp-1" />);
    fireEvent.click(screen.getByRole("button", { name: /run now/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/blueprints/bp-1/instantiate",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  });

  it("disables the button while a request is in flight", async () => {
    const mockFetch = vi.fn(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );
    global.fetch = mockFetch as unknown as typeof fetch;
    render(<RunNowButton blueprintId="bp-1" />);
    const button = screen.getByRole("button", { name: /run now/i });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
  });
});
```

- [ ] **Step 7.2: Run the test and verify it fails**

Run: `npx vitest run src/components/apps/__tests__/run-now-button.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7.3: Implement `run-now-button.tsx`**

```tsx
// src/components/apps/run-now-button.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { toast } from "sonner";

interface RunNowButtonProps {
  blueprintId: string | null | undefined;
  /**
   * Defaults to a label of "Run now". Tracker uses the default; future kits
   * may pass a domain-specific label like "Synthesize now".
   */
  label?: string;
}

/**
 * Posts to the blueprint instantiate endpoint with empty variables. If the
 * blueprint declares `variables` requiring user input, the API will return
 * 400 with an error message — Phase 2 surfaces this via toast and defers
 * the inline-form sheet to Phase 3.
 *
 * Why no inputs sheet yet: the spec mentions opening a `WorkflowFormView`
 * sheet when the blueprint has declared inputs, but that path requires
 * fetching the blueprint definition client-side first. Phase 2 ships the
 * happy path (no inputs) with a clear error toast for the inputs case.
 * Tracking note added to changelog.
 */
export function RunNowButton({ blueprintId, label = "Run now" }: RunNowButtonProps) {
  const [pending, setPending] = useState(false);

  if (!blueprintId) return null;

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
        const err = await res.json().catch(() => ({}));
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
    <Button
      type="button"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className="gap-1.5"
    >
      <Play className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
```

- [ ] **Step 7.4: Run the test and verify it passes**

Run: `npx vitest run src/components/apps/__tests__/run-now-button.test.tsx`
Expected: PASS — all 4 tests green.

---

### Task 8: `LastRunCard` primitive

**Files:**
- Create: `src/components/apps/last-run-card.tsx`
- Test: `src/components/apps/__tests__/last-run-card.test.tsx`

- [ ] **Step 8.1: Write the failing test**

```tsx
// src/components/apps/__tests__/last-run-card.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LastRunCard } from "../last-run-card";

describe("LastRunCard", () => {
  it("renders blueprint label and 'never run' when lastRun is null", () => {
    render(
      <LastRunCard
        blueprintId="bp-1"
        blueprintLabel="Weekly review"
        lastRun={null}
        runCount30d={0}
      />
    );
    expect(screen.getByText(/Weekly review/i)).toBeInTheDocument();
    expect(screen.getByText(/never run/i)).toBeInTheDocument();
  });

  it("renders status badge and relative time when lastRun is present", () => {
    render(
      <LastRunCard
        blueprintId="bp-1"
        blueprintLabel="Weekly review"
        lastRun={{
          id: "t-1",
          status: "completed",
          createdAt: Date.now() - 2 * 3_600_000,
        }}
        runCount30d={5}
      />
    );
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it("renders failed-status with destructive intent", () => {
    render(
      <LastRunCard
        blueprintId="bp-1"
        blueprintLabel="Sync"
        lastRun={{
          id: "t-1",
          status: "failed",
          createdAt: Date.now() - 60_000,
        }}
        runCount30d={2}
      />
    );
    const badge = screen.getByText(/failed/i);
    expect(badge).toBeInTheDocument();
  });
});
```

- [ ] **Step 8.2: Run the test and verify it fails**

Run: `npx vitest run src/components/apps/__tests__/last-run-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 8.3: Implement `last-run-card.tsx`**

```tsx
// src/components/apps/last-run-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/lib/constants/task-status";

interface LastRunSummary {
  id: string;
  status: TaskStatus;
  createdAt: number;
}

interface LastRunCardProps {
  blueprintId: string;
  blueprintLabel: string;
  lastRun: LastRunSummary | null;
  runCount30d: number;
}

const statusVariant: Record<TaskStatus, "default" | "success" | "secondary" | "destructive" | "outline"> = {
  running: "default",
  completed: "success",
  queued: "secondary",
  failed: "destructive",
  planned: "outline",
  cancelled: "outline",
};

/**
 * Compact card surfacing one blueprint's last-run state. Used by the
 * Workflow Hub kit's `secondary` slot (one card per blueprint). Hero variant
 * (markdown body) is deferred to Coach/Research kits in later phases.
 */
export function LastRunCard({
  blueprintLabel,
  lastRun,
  runCount30d,
}: LastRunCardProps) {
  return (
    <Card className="surface-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {blueprintLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lastRun ? (
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[lastRun.status]}>{lastRun.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {formatAgo(lastRun.createdAt)}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">never run</p>
        )}
        <p className="text-xs text-muted-foreground">
          {runCount30d} {runCount30d === 1 ? "run" : "runs"} · last 30d
        </p>
      </CardContent>
    </Card>
  );
}

function formatAgo(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 8.4: Run the test and verify it passes**

Run: `npx vitest run src/components/apps/__tests__/last-run-card.test.tsx`
Expected: PASS — all 3 tests green.

---

## Layer 4 — Type extensions

### Task 9: Extend `RuntimeState`, `KpiTile`, `HeaderSlot` with Phase 2 fields

**Files:**
- Modify: `src/lib/apps/view-kits/types.ts`

- [ ] **Step 9.1: Add Phase 2 fields**

Show the full file diff (existing lines kept; additions noted):

```ts
// Add at top with other type imports:
import type { ColumnDef } from "@/lib/tables/types";
import type { UserTableRowRow, TaskRow } from "@/lib/db/schema";
import type { TaskStatus } from "@/lib/constants/task-status";

// Replace the existing KpiTile interface:
export interface KpiTile {
  id: string;
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "flat";
  /** Phase 2: optional sparkline data for the tile (max 30 points). */
  spark?: number[];
}

// Add a new export for header-slot Phase 2 chips:
export interface CadenceChipData {
  humanLabel: string | null;
  nextFireMs: number | null;
}

// Replace the existing HeaderSlot interface:
export interface HeaderSlot {
  title: string;
  description?: string;
  status?: "running" | "queued" | "completed" | "failed" | "planned";
  /** Right-aligned actions (rendered after cadence + run-now). */
  actions?: ReactNode;
  /** Phase 2: render a ScheduleCadenceChip when present. */
  cadenceChip?: CadenceChipData;
  /** Phase 2: render a RunNowButton with this blueprint id when present. */
  runNowBlueprintId?: string;
}

// Add Phase 2 task summary type:
export interface RuntimeTaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
  result: string | null;
}

// Add Phase 2 hero-table data:
export interface HeroTableData {
  tableId: string;
  columns: ColumnDef[];
  rows: UserTableRowRow[];
}

// Replace the existing RuntimeState interface:
export interface RuntimeState {
  app: AppDetail;
  recentTaskCount?: number;
  scheduleCadence?: string | null;
  /** Phase 2: hero table content for Tracker kit (columns + last-N rows). */
  heroTable?: HeroTableData | null;
  /** Phase 2: schedule cadence chip data for Tracker / Workflow Hub headers. */
  cadence?: CadenceChipData | null;
  /** Phase 2: KPI tiles already evaluated from declared/synthesized specs. */
  evaluatedKpis?: KpiTile[];
  /** Phase 2: per-blueprint last-run summary (Workflow Hub `secondary`). */
  blueprintLastRuns?: Record<string, RuntimeTaskSummary | null>;
  /** Phase 2: per-blueprint run count over last 30 days. */
  blueprintRunCounts?: Record<string, number>;
  /** Phase 2: recent failed tasks for Workflow Hub `error-timeline`. */
  failedTasks?: RuntimeTaskSummary[];
}

// Note: omit `_unused` import lint by referencing ColumnDef + TaskRow + UserTableRowRow
// only in the export types above. If tsc complains about TaskRow being unused, drop it.
```

- [ ] **Step 9.2: Verify tsc**

Run: `npx tsc --noEmit 2>&1 | grep "view-kits/types\|kit-view\|page.tsx\|kits/" || echo "tsc clean"`

Expected: `tsc clean` — every change is additive, so existing call sites keep working. If you see a "unused import" error for `TaskRow`, delete that import; it's only listed for documentation.

- [ ] **Step 9.3: Run existing view-kits tests**

Run: `npx vitest run src/lib/apps/view-kits src/components/apps`
Expected: PASS — placeholder tests still green; format-kpi/evaluate-kpi/default-kpis from Tasks 1-3 still green; primitives from Tasks 5-8 still green.

---

## Layer 5 — Kit implementations

### Task 10: `WorkflowHubKit`

**Files:**
- Create: `src/lib/apps/view-kits/kits/workflow-hub.ts`
- Test: `src/lib/apps/view-kits/__tests__/workflow-hub.test.ts`

- [ ] **Step 10.1: Write the failing test**

```ts
// src/lib/apps/view-kits/__tests__/workflow-hub.test.ts
import { describe, expect, it } from "vitest";
import { workflowHubKit } from "../kits/workflow-hub";
import type { AppDetail, AppManifest } from "@/lib/apps/registry";
import type { RuntimeState } from "../types";

function makeApp(manifest: Partial<AppManifest>): AppDetail {
  const m: AppManifest = {
    id: "demo",
    name: "Demo",
    description: "demo",
    profiles: [],
    blueprints: [],
    tables: [],
    schedules: [],
    ...manifest,
  } as AppManifest;
  return {
    id: "demo",
    name: "Demo",
    description: "demo",
    rootDir: "/tmp/demo",
    primitivesSummary: "",
    profileCount: 0,
    blueprintCount: m.blueprints.length,
    tableCount: m.tables.length,
    scheduleCount: m.schedules.length,
    scheduleHuman: null,
    createdAt: 0,
    files: [],
    manifest: m,
  };
}

describe("workflowHubKit.resolve", () => {
  it("projects blueprintIds and scheduleIds from the manifest", () => {
    const app = makeApp({
      blueprints: [{ id: "bp-1" }, { id: "bp-2" }],
      schedules: [{ id: "sch-1", cron: "0 9 * * *" }],
    });
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    expect(proj).toMatchObject({
      blueprintIds: ["bp-1", "bp-2"],
      scheduleIds: ["sch-1"],
    });
  });

  it("returns empty arrays when manifest has nothing", () => {
    const app = makeApp({});
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    expect(proj).toMatchObject({ blueprintIds: [], scheduleIds: [] });
  });
});

describe("workflowHubKit.buildModel", () => {
  it("renders header + manifest footer for an empty-manifest app", () => {
    const app = makeApp({});
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = { app };
    const model = workflowHubKit.buildModel(proj, runtime);
    expect(model.header.title).toBe("Demo");
    expect(model.footer).toBeDefined();
    expect(model.kpis ?? []).toEqual([]);
  });

  it("populates KPIs from runtime.evaluatedKpis when present", () => {
    const app = makeApp({ blueprints: [{ id: "bp-1" }] });
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      evaluatedKpis: [
        { id: "k1", label: "Run rate", value: "12" },
        { id: "k2", label: "Success", value: "92%" },
      ],
    };
    const model = workflowHubKit.buildModel(proj, runtime);
    expect(model.kpis).toHaveLength(2);
    expect(model.kpis?.[0].label).toBe("Run rate");
  });

  it("populates secondary cards for each blueprint's last run", () => {
    const app = makeApp({
      blueprints: [{ id: "bp-1" }, { id: "bp-2" }],
    });
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      blueprintLastRuns: {
        "bp-1": { id: "t1", title: "Run", status: "completed", createdAt: 0, result: null },
        "bp-2": null,
      },
      blueprintRunCounts: { "bp-1": 5, "bp-2": 0 },
    };
    const model = workflowHubKit.buildModel(proj, runtime);
    expect(model.secondary).toHaveLength(2);
    expect(model.secondary?.[0].id).toBe("blueprint-bp-1");
  });

  it("populates activity slot when failed tasks exist", () => {
    const app = makeApp({});
    const proj = workflowHubKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      failedTasks: [
        { id: "t1", title: "Failed run", status: "failed", createdAt: 0, result: "error" },
      ],
    };
    const model = workflowHubKit.buildModel(proj, runtime);
    expect(model.activity).toBeDefined();
  });
});
```

- [ ] **Step 10.2: Run the test and verify it fails**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/workflow-hub.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 10.3: Implement `workflow-hub.ts`**

```ts
// src/lib/apps/view-kits/kits/workflow-hub.ts
import yaml from "js-yaml";
import { ManifestPaneBody } from "@/components/apps/kit-view/manifest-pane-body";
import { LastRunCard } from "@/components/apps/last-run-card";
import { ErrorTimeline } from "@/components/workflows/error-timeline";
import type {
  KitDefinition,
  KitProjection,
  ResolveInput,
  RuntimeState,
  ViewModel,
} from "../types";

interface WorkflowHubProjection extends KitProjection {
  blueprintIds: string[];
  scheduleIds: string[];
  manifestYaml: string;
}

/**
 * Workflow Hub — the catch-all kit. Renders for any composed app that
 * doesn't match a more specific archetype (≥2 blueprints OR no clear hero
 * table per the inference table). Hero is intentionally absent; the value
 * is in KPIs (run-rate, success %, cost) + per-blueprint LastRunCard +
 * recent failures.
 *
 * Pure projection: no React state, no fetching. Runtime aggregates are
 * loaded by `loadRuntimeState`.
 */
export const workflowHubKit: KitDefinition = {
  id: "workflow-hub",

  resolve(input: ResolveInput): KitProjection {
    const projection: WorkflowHubProjection = {
      blueprintIds: input.manifest.blueprints.map((b) => b.id),
      scheduleIds: input.manifest.schedules.map((s) => s.id),
      manifestYaml: yaml.dump(input.manifest, { lineWidth: 100 }),
    };
    return projection;
  },

  buildModel(proj: KitProjection, runtime: RuntimeState): ViewModel {
    const projection = proj as WorkflowHubProjection;
    const { app } = runtime;
    const blueprintIds = projection.blueprintIds;

    const lastRuns = runtime.blueprintLastRuns ?? {};
    const counts = runtime.blueprintRunCounts ?? {};

    const secondary = blueprintIds.map((bpId) => ({
      id: `blueprint-${bpId}`,
      content: LastRunCard({
        blueprintId: bpId,
        blueprintLabel: bpId,
        lastRun: lastRuns[bpId] ?? null,
        runCount30d: counts[bpId] ?? 0,
      }),
    }));

    const failed = runtime.failedTasks ?? [];
    const activity =
      failed.length > 0
        ? {
            content: ErrorTimeline({
              events: failed.map((t) => ({
                timestamp: new Date(t.createdAt).toISOString(),
                event: "task_failed",
                severity: "error" as const,
                details: t.result?.slice(0, 240) ?? t.title,
              })),
            }),
          }
        : undefined;

    return {
      header: {
        title: app.name,
        description: app.description ?? "Composed app",
        status: "running",
        cadenceChip: runtime.cadence ?? undefined,
      },
      kpis: runtime.evaluatedKpis ?? [],
      secondary,
      activity,
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

- [ ] **Step 10.4: Run the test and verify it passes**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/workflow-hub.test.ts`
Expected: PASS — all 6 tests green.

---

### Task 11: `TrackerKit`

**Files:**
- Create: `src/lib/apps/view-kits/kits/tracker.ts`
- Test: `src/lib/apps/view-kits/__tests__/tracker.test.ts`

- [ ] **Step 11.1: Write the failing test**

```ts
// src/lib/apps/view-kits/__tests__/tracker.test.ts
import { describe, expect, it } from "vitest";
import { trackerKit } from "../kits/tracker";
import type { AppDetail, AppManifest, ViewConfig } from "@/lib/apps/registry";
import type { ColumnSchemaRef, RuntimeState } from "../types";

function makeApp(over: Partial<AppManifest> = {}, view?: ViewConfig): AppDetail {
  const m = {
    id: "demo",
    name: "Demo",
    description: "demo",
    profiles: [],
    blueprints: [],
    tables: [],
    schedules: [],
    view,
    ...over,
  } as AppManifest;
  return {
    id: "demo",
    name: "Demo",
    description: "demo",
    rootDir: "/tmp",
    primitivesSummary: "",
    profileCount: 0,
    blueprintCount: m.blueprints.length,
    tableCount: m.tables.length,
    scheduleCount: m.schedules.length,
    scheduleHuman: null,
    createdAt: 0,
    files: [],
    manifest: m,
  };
}

describe("trackerKit.resolve — defaults from manifest when bindings absent", () => {
  it("defaults heroTableId to manifest.tables[0]?.id", () => {
    const app = makeApp({
      tables: [{ id: "logs" }, { id: "habits" }],
      blueprints: [{ id: "review" }],
      schedules: [{ id: "sch-1", cron: "0 8 * * *" }],
    });
    const cols: ColumnSchemaRef[] = [
      { tableId: "logs", columns: [{ name: "active", type: "boolean" }] },
    ];
    const proj = trackerKit.resolve({ manifest: app.manifest, columns: cols }) as Record<
      string,
      unknown
    >;
    expect(proj.heroTableId).toBe("logs");
    expect(proj.cadenceScheduleId).toBe("sch-1");
    expect(proj.runsBlueprintId).toBe("review");
    expect(Array.isArray(proj.kpiSpecs)).toBe(true);
    expect((proj.kpiSpecs as unknown[]).length).toBeGreaterThan(0);
  });

  it("returns undefined heroTableId when manifest has no tables", () => {
    const app = makeApp({});
    const proj = trackerKit.resolve({ manifest: app.manifest, columns: [] }) as Record<
      string,
      unknown
    >;
    expect(proj.heroTableId).toBeUndefined();
  });
});

describe("trackerKit.resolve — explicit bindings override defaults", () => {
  it("uses bindings.hero.table when declared", () => {
    const app = makeApp(
      {
        tables: [{ id: "tbl-a" }, { id: "tbl-b" }],
        blueprints: [{ id: "bp-1" }],
        schedules: [{ id: "sch-1" }],
      },
      {
        kit: "tracker",
        hideManifestPane: false,
        bindings: { hero: { table: "tbl-b" } },
      }
    );
    const proj = trackerKit.resolve({ manifest: app.manifest, columns: [] }) as Record<
      string,
      unknown
    >;
    expect(proj.heroTableId).toBe("tbl-b");
  });

  it("uses bindings.kpis verbatim when declared (no synthesis)", () => {
    const app = makeApp(
      {
        tables: [{ id: "tbl-1" }],
        blueprints: [{ id: "bp-1" }],
        schedules: [{ id: "sch-1" }],
      },
      {
        kit: "tracker",
        hideManifestPane: false,
        bindings: {
          kpis: [
            {
              id: "custom",
              label: "Custom",
              source: { kind: "tableCount", table: "tbl-1" },
              format: "int",
            },
          ],
        },
      }
    );
    const proj = trackerKit.resolve({ manifest: app.manifest, columns: [] }) as Record<
      string,
      unknown
    >;
    expect((proj.kpiSpecs as Array<{ id: string }>)[0].id).toBe("custom");
    expect(proj.kpiSpecs).toHaveLength(1);
  });
});

describe("trackerKit.buildModel", () => {
  it("renders header with title + cadence chip + run-now blueprint", () => {
    const app = makeApp({
      tables: [{ id: "logs" }],
      blueprints: [{ id: "bp-1" }],
      schedules: [{ id: "sch-1", cron: "0 8 * * *" }],
    });
    const proj = trackerKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      cadence: { humanLabel: "daily 8am", nextFireMs: null },
    };
    const model = trackerKit.buildModel(proj, runtime);
    expect(model.header.title).toBe("Demo");
    expect(model.header.cadenceChip?.humanLabel).toBe("daily 8am");
    expect(model.header.runNowBlueprintId).toBe("bp-1");
  });

  it("renders kpis from runtime.evaluatedKpis when present", () => {
    const app = makeApp({
      tables: [{ id: "logs" }],
    });
    const proj = trackerKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      evaluatedKpis: [{ id: "k1", label: "Total", value: "5" }],
    };
    const model = trackerKit.buildModel(proj, runtime);
    expect(model.kpis).toHaveLength(1);
  });

  it("renders hero with table-spreadsheet content when runtime.heroTable is present", () => {
    const app = makeApp({
      tables: [{ id: "logs" }],
    });
    const proj = trackerKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      heroTable: { tableId: "logs", columns: [], rows: [] },
    };
    const model = trackerKit.buildModel(proj, runtime);
    expect(model.hero).toBeDefined();
    expect(model.hero?.kind).toBe("table");
  });
});
```

- [ ] **Step 11.2: Run the test and verify it fails**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/tracker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 11.3: Implement `tracker.ts`**

```ts
// src/lib/apps/view-kits/kits/tracker.ts
import yaml from "js-yaml";
import { ManifestPaneBody } from "@/components/apps/kit-view/manifest-pane-body";
import { TableSpreadsheet } from "@/components/tables/table-spreadsheet";
import { defaultTrackerKpis } from "../default-kpis";
import type { ViewConfig } from "@/lib/apps/registry";
import type {
  KitDefinition,
  KitProjection,
  ResolveInput,
  RuntimeState,
  ViewModel,
} from "../types";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];

interface TrackerProjection extends KitProjection {
  heroTableId: string | undefined;
  secondaryTableIds: string[];
  cadenceScheduleId: string | undefined;
  runsBlueprintId: string | undefined;
  kpiSpecs: KpiSpec[];
  manifestYaml: string;
}

/**
 * Tracker — table-as-hero kit for apps that log entries over time
 * (habit-tracker, reading-radar). The hero is the entries table; KPIs sit
 * above; a cadence chip shows when the next agent run will fire.
 *
 * Pure projection: no React state, no fetching. The hero table's columns
 * and rows come from `runtime.heroTable`, populated upstream in `data.ts`.
 *
 * Why first table for default heroTableId: the inference rule already
 * checks tables[0] for hasBoolean+hasDate. Manifests can override via
 * `view.bindings.hero.table`. Phase 5 may add smarter heuristics.
 */
export const trackerKit: KitDefinition = {
  id: "tracker",

  resolve(input: ResolveInput): KitProjection {
    const m = input.manifest;
    const view = m.view;
    const bindings = view?.bindings;

    const heroTableId =
      bindings?.hero && "table" in bindings.hero
        ? bindings.hero.table
        : m.tables[0]?.id;

    const secondaryTableIds =
      bindings?.secondary?.flatMap((b) =>
        "table" in b ? [b.table] : []
      ) ?? [];

    const cadenceScheduleId =
      bindings?.cadence && "schedule" in bindings.cadence
        ? bindings.cadence.schedule
        : m.schedules[0]?.id;

    const runsBlueprintId =
      bindings?.runs && "blueprint" in bindings.runs
        ? bindings.runs.blueprint
        : m.blueprints[0]?.id;

    const heroCols = heroTableId
      ? input.columns.find((c) => c.tableId === heroTableId)?.columns ?? []
      : [];

    const kpiSpecs = bindings?.kpis ?? defaultTrackerKpis(heroTableId, heroCols);

    const projection: TrackerProjection = {
      heroTableId,
      secondaryTableIds,
      cadenceScheduleId,
      runsBlueprintId,
      kpiSpecs,
      manifestYaml: yaml.dump(m, { lineWidth: 100 }),
    };
    return projection;
  },

  buildModel(proj: KitProjection, runtime: RuntimeState): ViewModel {
    const projection = proj as TrackerProjection;
    const { app } = runtime;

    const hero = runtime.heroTable
      ? {
          kind: "table" as const,
          content: TableSpreadsheet({
            tableId: runtime.heroTable.tableId,
            columns: runtime.heroTable.columns,
            initialRows: runtime.heroTable.rows,
          }),
        }
      : undefined;

    return {
      header: {
        title: app.name,
        description: app.description ?? undefined,
        status: "running",
        cadenceChip: runtime.cadence ?? undefined,
        runNowBlueprintId: projection.runsBlueprintId,
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

- [ ] **Step 11.4: Run the test and verify it passes**

Run: `npx vitest run src/lib/apps/view-kits/__tests__/tracker.test.ts`
Expected: PASS — all 7 tests green.

---

## Layer 6 — Slot renderer + header updates

### Task 12: Update `KpisSlotView` to use `KPIStrip`

**Files:**
- Modify: `src/components/apps/kit-view/slots/kpis.tsx`

- [ ] **Step 12.1: Replace inline grid with KPIStrip**

```tsx
// src/components/apps/kit-view/slots/kpis.tsx
import { KPIStrip } from "@/components/apps/kpi-strip";
import type { KpiTile } from "@/lib/apps/view-kits/types";

interface KpisSlotProps {
  tiles: KpiTile[];
}

/**
 * Phase 2: delegates to the `KPIStrip` primitive. Returns null for empty
 * tiles to preserve the Phase 1.1 behavior (no surface for placeholder kit).
 */
export function KpisSlotView({ tiles }: KpisSlotProps) {
  if (tiles.length === 0) return null;
  return <KPIStrip tiles={tiles} />;
}
```

- [ ] **Step 12.2: Verify view-kits suite still passes**

Run: `npx vitest run src/lib/apps src/components/apps`
Expected: PASS — no regression.

---

### Task 13: Update header slot to render Phase 2 chips + run-now button

**Files:**
- Read first: `src/components/apps/kit-view/slots/header.tsx`
- Modify: `src/components/apps/kit-view/slots/header.tsx`

- [ ] **Step 13.1: Read the current header slot**

Run: `cat src/components/apps/kit-view/slots/header.tsx`

(Read the file before editing — Edit tool requires it.)

- [ ] **Step 13.2: Add cadence chip + run-now to the header**

Modify `header.tsx` to render the new fields. The exact diff depends on the current structure but the additions are:

```tsx
import { ScheduleCadenceChip } from "@/components/apps/schedule-cadence-chip";
import { RunNowButton } from "@/components/apps/run-now-button";

// Within the header JSX, between title and actions, add:
{slot.cadenceChip && (
  <ScheduleCadenceChip
    humanLabel={slot.cadenceChip.humanLabel}
    nextFireMs={slot.cadenceChip.nextFireMs}
  />
)}
{slot.runNowBlueprintId && (
  <RunNowButton blueprintId={slot.runNowBlueprintId} />
)}
{slot.actions}
```

The exact placement (left of actions, right of title, inside a flex row) should follow the existing structure. The header slot file is small (≤80 lines) — keep the diff surgical.

- [ ] **Step 13.3: Verify tests still pass**

Run: `npx vitest run src/lib/apps src/components/apps`
Expected: PASS.

---

## Layer 7 — Data layer: kit-aware `loadRuntimeState`

### Task 14: Extend `loadRuntimeState` to dispatch on kit id

**Files:**
- Modify: `src/lib/apps/view-kits/data.ts`

- [ ] **Step 14.1: Rewrite `data.ts` with Phase 2 loaders**

```ts
// src/lib/apps/view-kits/data.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, schedules, userTableRows } from "@/lib/db/schema";
import { humanizeCron } from "@/lib/apps/registry";
import type { AppDetail, AppManifest, ViewConfig } from "@/lib/apps/registry";
import type { ResolvedBindings } from "./resolve";
import type {
  CadenceChipData,
  HeroTableData,
  KpiTile,
  RuntimeState,
  RuntimeTaskSummary,
} from "./types";
import type { KitId } from "./types";
import type { ColumnDef } from "@/lib/tables/types";
import type { TaskStatus } from "@/lib/constants/task-status";
import { evaluateKpi } from "./evaluate-kpi";
import { createKpiContext } from "./kpi-context";

type KpiSpec = NonNullable<ViewConfig["bindings"]["kpis"]>[number];

interface KitProjectionShape {
  heroTableId?: string;
  cadenceScheduleId?: string;
  runsBlueprintId?: string;
  kpiSpecs?: KpiSpec[];
  blueprintIds?: string[];
  scheduleIds?: string[];
}

/**
 * Server-only loader: assembles a `RuntimeState` for the kit's `buildModel`.
 * Phase 2 makes this kit-aware — based on `kitId` we populate different
 * subsets of the optional Phase 2 fields. Tracker needs heroTable + cadence
 * + KPIs; Workflow Hub needs blueprintLastRuns + counts + failedTasks.
 *
 * Generic baseline (recentTaskCount, scheduleCadence) is always populated
 * for compat with the placeholder kit and Phase 1.1 behavior.
 */
async function loadRuntimeStateUncached(
  app: AppDetail,
  bindings: ResolvedBindings,
  kitId: KitId,
  projection: KitProjectionShape
): Promise<RuntimeState> {
  const baseline = await loadBaseline(app);

  if (kitId === "tracker") {
    return {
      ...baseline,
      cadence: await loadCadence(app.manifest, projection.cadenceScheduleId),
      heroTable: await loadHeroTable(projection.heroTableId),
      evaluatedKpis: await loadEvaluatedKpis(projection.kpiSpecs ?? []),
    };
  }

  if (kitId === "workflow-hub") {
    return {
      ...baseline,
      cadence: await loadCadence(app.manifest, undefined),
      blueprintLastRuns: await loadBlueprintLastRuns(bindings.blueprintIds),
      blueprintRunCounts: await loadBlueprintRunCounts(bindings.blueprintIds),
      failedTasks: await loadFailedTasks(app.id, 10),
      evaluatedKpis: await loadEvaluatedKpis(projection.kpiSpecs ?? []),
    };
  }

  // placeholder + any unrecognized kit: just baseline
  return baseline;
}

async function loadBaseline(app: AppDetail): Promise<RuntimeState> {
  let recentTaskCount: number | undefined;
  try {
    const rows = db
      .select({ value: count() })
      .from(tasks)
      .where(eq(tasks.projectId, app.id))
      .all();
    recentTaskCount = rows[0]?.value ?? 0;
  } catch {
    recentTaskCount = undefined;
  }
  const firstCron = app.manifest.schedules[0]?.cron;
  const scheduleCadence = firstCron ? humanizeCron(firstCron) : null;
  return { app, recentTaskCount, scheduleCadence };
}

async function loadCadence(
  manifest: AppManifest,
  scheduleId: string | undefined
): Promise<CadenceChipData | null> {
  const sched = scheduleId
    ? manifest.schedules.find((s) => s.id === scheduleId)
    : manifest.schedules[0];
  if (!sched?.cron) return null;
  const humanLabel = humanizeCron(sched.cron);

  let nextFireMs: number | null = null;
  if (sched.id) {
    try {
      const row = db
        .select({ value: schedules.nextFireAt })
        .from(schedules)
        .where(eq(schedules.id, sched.id))
        .get();
      nextFireMs = row?.value ? row.value.getTime() : null;
    } catch {
      nextFireMs = null;
    }
  }
  return { humanLabel, nextFireMs };
}

async function loadHeroTable(
  heroTableId: string | undefined
): Promise<HeroTableData | null> {
  if (!heroTableId) return null;
  try {
    const mod = await import("@/lib/data/tables");
    const cols = await mod.getColumns(heroTableId);
    const columns: ColumnDef[] = cols.map((c) => ({
      name: c.name,
      displayName: c.displayName,
      dataType: c.dataType as ColumnDef["dataType"],
      position: c.position,
      required: c.required,
      defaultValue: c.defaultValue,
      config: c.config ? (JSON.parse(c.config) as ColumnDef["config"]) : null,
    }));
    const rows = db
      .select()
      .from(userTableRows)
      .where(eq(userTableRows.tableId, heroTableId))
      .orderBy(desc(userTableRows.createdAt))
      .limit(50)
      .all();
    return { tableId: heroTableId, columns, rows };
  } catch {
    return null;
  }
}

async function loadBlueprintLastRuns(
  blueprintIds: string[]
): Promise<Record<string, RuntimeTaskSummary | null>> {
  const out: Record<string, RuntimeTaskSummary | null> = {};
  if (blueprintIds.length === 0) return out;
  for (const id of blueprintIds) out[id] = null;
  try {
    const rows = db
      .select()
      .from(tasks)
      .where(inArray(tasks.assignedAgent, blueprintIds))
      .orderBy(desc(tasks.createdAt))
      .limit(50)
      .all();
    for (const row of rows) {
      const bp = row.assignedAgent ?? "";
      if (bp && out[bp] == null) {
        out[bp] = {
          id: row.id,
          title: row.title,
          status: row.status as TaskStatus,
          createdAt: row.createdAt.getTime(),
          result: row.result,
        };
      }
    }
  } catch {
    // leave nulls
  }
  return out;
}

async function loadBlueprintRunCounts(
  blueprintIds: string[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (blueprintIds.length === 0) return out;
  const since = new Date(Date.now() - 30 * 86_400_000);
  for (const id of blueprintIds) out[id] = 0;
  try {
    for (const bpId of blueprintIds) {
      const rows = db
        .select({ value: count() })
        .from(tasks)
        .where(and(eq(tasks.assignedAgent, bpId), gte(tasks.createdAt, since)))
        .all();
      out[bpId] = rows[0]?.value ?? 0;
    }
  } catch {
    // leave zeros
  }
  return out;
}

async function loadFailedTasks(
  projectId: string,
  limit: number
): Promise<RuntimeTaskSummary[]> {
  try {
    const rows = db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.status, "failed")))
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .all();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as TaskStatus,
      createdAt: r.createdAt.getTime(),
      result: r.result,
    }));
  } catch {
    return [];
  }
}

async function loadEvaluatedKpis(specs: KpiSpec[]): Promise<KpiTile[]> {
  if (specs.length === 0) return [];
  const ctx = createKpiContext();
  const tiles: KpiTile[] = [];
  for (const spec of specs) {
    try {
      tiles.push(await evaluateKpi(spec, ctx));
    } catch {
      tiles.push({ id: spec.id, label: spec.label, value: "—" });
    }
  }
  return tiles;
}

/**
 * Cached entry point. Cache key includes the app id + kit id so different
 * kits (during inference rollouts) don't collide. 30s revalidate.
 */
export function loadRuntimeState(
  app: AppDetail,
  bindings: ResolvedBindings,
  kitId: KitId,
  projection: KitProjectionShape
): Promise<RuntimeState> {
  const cached = unstable_cache(
    () => loadRuntimeStateUncached(app, bindings, kitId, projection),
    ["app-runtime", app.id, kitId],
    { revalidate: 30, tags: [`app-runtime:${app.id}`] }
  );
  return cached();
}
```

- [ ] **Step 14.2: Verify tsc**

Run: `npx tsc --noEmit 2>&1 | grep "view-kits/data\|page.tsx" || echo "tsc clean"`
Expected: `tsc clean` for `data.ts`. The page.tsx will fail to typecheck until Task 16 fixes the call site — that's expected.

---

## Layer 8 — Wiring

### Task 15: Register kits in `viewKits` registry

**Files:**
- Modify: `src/lib/apps/view-kits/index.ts`

- [ ] **Step 15.1: Register tracker + workflow-hub**

Replace the `viewKits` map and add imports:

```ts
// Replace existing imports section to add:
import { trackerKit } from "./kits/tracker";
import { workflowHubKit } from "./kits/workflow-hub";

// Replace the viewKits map:
export const viewKits: Record<KitId, KitDefinition | undefined> = {
  placeholder: placeholderKit,
  tracker: trackerKit,
  "workflow-hub": workflowHubKit,
  coach: undefined,    // Phase 3
  ledger: undefined,   // Phase 3
  inbox: undefined,    // Phase 4
  research: undefined, // Phase 4
};
```

- [ ] **Step 15.2: Update dispatcher.test.ts to reflect Phase 2 registrations**

Open `src/lib/apps/view-kits/__tests__/dispatcher.test.ts`. The test currently asserts that all non-placeholder ids fall back to placeholderKit. After registration, only `coach`, `ledger`, `inbox`, `research` should fall back. Update the test:

```ts
// In dispatcher.test.ts, replace the "falls back to placeholderKit" test with:
it("returns the registered kit for tracker and workflow-hub (Phase 2)", () => {
  expect(resolveKit("tracker").id).toBe("tracker");
  expect(resolveKit("workflow-hub").id).toBe("workflow-hub");
});

it("falls back to placeholderKit for unregistered kit ids (Phase 3+ kits)", () => {
  expect(resolveKit("ledger")).toBe(placeholderKit);
  expect(resolveKit("coach")).toBe(placeholderKit);
  expect(resolveKit("inbox")).toBe(placeholderKit);
  expect(resolveKit("research")).toBe(placeholderKit);
});
```

- [ ] **Step 15.3: Run dispatcher + view-kits tests**

Run: `npx vitest run src/lib/apps/view-kits`
Expected: PASS — all view-kits tests green, including updated dispatcher.

---

### Task 16: Wire `page.tsx` to pass kit id + projection

**Files:**
- Modify: `src/app/apps/[id]/page.tsx`

- [ ] **Step 16.1: Update the page to thread kit id + projection**

```tsx
// src/app/apps/[id]/page.tsx
import { notFound } from "next/navigation";
import { PageShell } from "@/components/shared/page-shell";
import { AppDetailActions } from "@/components/apps/app-detail-actions";
import { KitView } from "@/components/apps/kit-view/kit-view";
import { getApp } from "@/lib/apps/registry";
import { loadColumnSchemas, pickKit } from "@/lib/apps/view-kits";
import { resolveBindings } from "@/lib/apps/view-kits/resolve";
import { loadRuntimeState } from "@/lib/apps/view-kits/data";

export const dynamic = "force-dynamic";

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = getApp(id);
  if (!app) notFound();

  const columns = await loadColumnSchemas(app.manifest);
  const kit = pickKit(app.manifest, columns);
  const bindings = resolveBindings(app.manifest);
  const projection = kit.resolve({ manifest: app.manifest, columns });
  const runtime = await loadRuntimeState(app, bindings, kit.id, projection);
  const model = kit.buildModel(projection, runtime);

  model.header.actions = (
    <AppDetailActions
      appId={app.id}
      appName={app.name}
      tableCount={app.tableCount}
      scheduleCount={app.scheduleCount}
      fileCount={app.files.length}
    />
  );

  return (
    <PageShell backHref="/apps" backLabel="All apps">
      <KitView model={model} />
    </PageShell>
  );
}
```

The only change versus Phase 1.2 is the `loadRuntimeState` call signature: now passes `kit.id` and `projection`.

- [ ] **Step 16.2: Verify tsc + suite**

Run: `npx tsc --noEmit 2>&1 | grep "src/(app|lib|components)/apps" || echo "tsc clean for apps"`
Expected: `tsc clean for apps`.

Run: `npx vitest run src/lib/apps src/components/apps`
Expected: PASS — full apps test suite green.

---

## Layer 9 — Browser smoke + closeout

### Task 17: Browser smoke

- [ ] **Step 17.1: Start dev server**

Run: `npm run dev` (in background or separate terminal — wait for "Ready in").

- [ ] **Step 17.2: HTTP smoke for habit-tracker**

Run: `curl -sS http://localhost:3000/apps/habit-tracker -o /tmp/habit-tracker-page.html -w "%{http_code}\n"`
Expected: `200`.

Run: `grep -c "kit-primitive=\"kpi-tile\"" /tmp/habit-tracker-page.html`
Expected: ≥1 (Tracker rendered KPI tiles).

Run: `grep -c "data-kit-slot=\"hero\"" /tmp/habit-tracker-page.html`
Expected: 1 (hero slot present).

Run: `grep -c "Habit Tracker" /tmp/habit-tracker-page.html`
Expected: ≥1.

If any of these fail, **stop and debug** before claiming success — per `verification-before-completion` skill, evidence before assertions.

- [ ] **Step 17.3: Browser visual verification (Chrome DevTools MCP)**

Use the chrome-devtools MCP to navigate to `http://localhost:3000/apps/habit-tracker` and take a screenshot. Save to `output/phase-2-tracker-smoke.png`. Visually verify: KPI strip visible at top, hero table renders below, manifest sheet trigger present in header.

If Chrome DevTools MCP is unavailable, fall back to Playwright per `MEMORY.md` browser-tool-fallback rule. Save snapshot to `/tmp/` not project root.

- [ ] **Step 17.4: Run the full apps test suite one last time**

Run: `npx vitest run src/lib/apps src/components/apps`
Expected: All tests pass (≥190 expected — 134 from Phase 1.2 + ~56 new Phase 2 tests).

- [ ] **Step 17.5: tsc full project**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: Either no output, or only the pre-existing failures noted in the predecessor handoff (`router.test.ts`, `settings.test.ts`). No new errors introduced by Phase 2.

---

### Task 18: Update feature spec status, roadmap, changelog

**Files:**
- Modify: `features/composed-app-kit-tracker-and-hub.md`
- Modify: `features/roadmap.md`
- Modify: `features/changelog.md`

- [ ] **Step 18.1: Mark spec status as completed**

In `features/composed-app-kit-tracker-and-hub.md`, change frontmatter `status: planned` → `status: completed`. No other content changes (the spec stays as the source of truth).

- [ ] **Step 18.2: Update roadmap status column**

Open `features/roadmap.md`, find the row for `composed-app-kit-tracker-and-hub`, update its status column to match the convention used by the previous row (typically: `status: completed` or a check mark — match neighboring rows).

- [ ] **Step 18.3: Add a changelog entry**

In `features/changelog.md`, prepend a new entry above the existing 2026-05-02 Phase 1.2 entry (which is currently the most recent). Match the style of the predecessor entry. Suggested content:

```markdown
## 2026-05-02 — composed-app-kit-tracker-and-hub (Phase 2)

**Shipped:** Tracker and Workflow Hub view kits, plus four shared primitives
(`KPIStrip`, `LastRunCard`, `ScheduleCadenceChip`, `RunNowButton`) and a 5-branch
KPI evaluation engine.

- `src/lib/apps/view-kits/evaluate-kpi.ts` — pure switch over `KpiSpec.source.kind`
  with injected `KpiContext` for testability
- `src/lib/apps/view-kits/format-kpi.ts` — 5 format adapters (int/currency/percent/
  duration/relative)
- `src/lib/apps/view-kits/default-kpis.ts` — synthesizes 1-4 KpiSpecs for tracker
  apps that don't declare `view.bindings.kpis`
- `src/lib/apps/view-kits/kpi-context.ts` — DB-backed `KpiContext` (json_extract
  for table sums/latest, schedules.nextFireAt for cadence)
- `src/lib/apps/view-kits/kits/tracker.ts` + `kits/workflow-hub.ts` — pure
  projection kit definitions
- `src/components/apps/{kpi-strip,last-run-card,schedule-cadence-chip,run-now-button}.tsx`
  — four shared primitives, each used by ≥2 kits
- `src/lib/apps/view-kits/data.ts` — `loadRuntimeState` now kit-aware; populates
  `heroTable` / `cadence` / `evaluatedKpis` for Tracker and `blueprintLastRuns` /
  `blueprintRunCounts` / `failedTasks` for Workflow Hub
- `src/app/apps/[id]/page.tsx` — threads `kit.id` + `projection` into
  `loadRuntimeState`

**Deferred to Phase 3+:**
- `RunNowButton` inputs sheet (when blueprint declares `variables`) — Phase 2 ships
  the happy path; inputs case surfaces a clear error toast
- Coach + Ledger kits — Phase 3 (`composed-app-kit-coach-and-ledger`)
- Inbox + Research kits — Phase 4
- Default KPI hardening + first-class blueprintId on tasks — Phase 5
  (`composed-app-auto-inference-hardening`)

**Tests:** ~56 new tests across 9 files. Apps suite passes; full suite carries
forward only the pre-existing `router.test.ts` + `settings.test.ts` failures
called out in the predecessor handoff.

**Browser smoke:** `/apps/habit-tracker` renders Tracker layout (KPI strip,
hero table-spreadsheet, schedule cadence chip, run-now button); manifest sheet
still reachable from header.
```

- [ ] **Step 18.4: Verify changelog ordering**

Run: `head -40 features/changelog.md`
Expected: New 2026-05-02 entry on top, Phase 1.2 entry below it, no duplicate "## 2026-05-02" headings.

---

### Task 19: Commit

**Files:** All Phase 2 files staged.

- [ ] **Step 19.1: Stage Phase 2 files explicitly**

```bash
git add \
  src/lib/apps/view-kits/evaluate-kpi.ts \
  src/lib/apps/view-kits/format-kpi.ts \
  src/lib/apps/view-kits/default-kpis.ts \
  src/lib/apps/view-kits/kpi-context.ts \
  src/lib/apps/view-kits/kits/workflow-hub.ts \
  src/lib/apps/view-kits/kits/tracker.ts \
  src/lib/apps/view-kits/index.ts \
  src/lib/apps/view-kits/data.ts \
  src/lib/apps/view-kits/types.ts \
  src/lib/apps/view-kits/__tests__/evaluate-kpi.test.ts \
  src/lib/apps/view-kits/__tests__/format-kpi.test.ts \
  src/lib/apps/view-kits/__tests__/default-kpis.test.ts \
  src/lib/apps/view-kits/__tests__/workflow-hub.test.ts \
  src/lib/apps/view-kits/__tests__/tracker.test.ts \
  src/lib/apps/view-kits/__tests__/dispatcher.test.ts \
  src/components/apps/kpi-strip.tsx \
  src/components/apps/last-run-card.tsx \
  src/components/apps/schedule-cadence-chip.tsx \
  src/components/apps/run-now-button.tsx \
  src/components/apps/__tests__/kpi-strip.test.tsx \
  src/components/apps/__tests__/last-run-card.test.tsx \
  src/components/apps/__tests__/schedule-cadence-chip.test.tsx \
  src/components/apps/__tests__/run-now-button.test.tsx \
  src/components/apps/kit-view/slots/kpis.tsx \
  src/components/apps/kit-view/slots/header.tsx \
  src/app/apps/[id]/page.tsx \
  features/composed-app-kit-tracker-and-hub.md \
  features/roadmap.md \
  features/changelog.md
```

(Adjust if Task 13 didn't actually need to modify `header.tsx` — the diff there is small and may have been noop.)

- [ ] **Step 19.2: Verify the staged set looks right**

Run: `git status --short` — review carefully. Expected: 27ish files in M/A states, none under `node_modules`, no `.env*`, no leftover scratch files.

- [ ] **Step 19.3: Commit with a single focused message**

```bash
git commit -m "$(cat <<'EOF'
feat(apps): composed-app kit tracker + workflow-hub (Phase 2)

Ships Phase 2 of the Composed Apps Domain-Aware View — two real view kits
(Tracker, Workflow Hub) plus four shared primitives (KPIStrip, LastRunCard,
ScheduleCadenceChip, RunNowButton) and a 5-branch KPI evaluation engine.

- Tracker: hero = entries table via TableSpreadsheet, KPI strip above,
  schedule cadence chip + Run Now in header
- Workflow Hub: catch-all fallback; KPIs + per-blueprint LastRunCards +
  ErrorTimeline for failed tasks
- evaluateKpi: pure switch over KpiSpec.source.kind (5 branches), unit-
  testable via injected KpiContext
- defaultTrackerKpis: synthesizes 1-4 KpiSpecs from hero columns when the
  manifest doesn't declare view.bindings.kpis
- loadRuntimeState now kit-aware: populates heroTable + cadence + KPIs for
  Tracker; blueprintLastRuns + counts + failedTasks for Workflow Hub
- Habit Tracker (no view: declared) auto-renders as Tracker via Phase 1.2's
  inference; Phase 1.1's placeholderKit still serves coach/ledger/inbox/
  research until Phases 3-4 ship

Verification:
- ~56 new unit tests; full apps suite green
- Browser smoke: /apps/habit-tracker renders Tracker (KPIs, hero table,
  cadence chip); manifest sheet still reachable

Spec: features/composed-app-kit-tracker-and-hub.md
Plan: docs/superpowers/plans/2026-05-02-composed-app-kit-tracker-and-hub.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 19.4: Verify commit**

Run: `git log --oneline -3`
Expected: New commit on top with the title above; previous commit `d9df179b` still present.

Run: `git status`
Expected: clean working tree.

---

## Self-Review (run before handing off)

### Spec coverage check

- [x] `KPIStrip` exists at `src/components/apps/kpi-strip.tsx` — Task 5
- [x] `LastRunCard` exists at `src/components/apps/last-run-card.tsx` — Task 8
- [x] `ScheduleCadenceChip` exists at `src/components/apps/schedule-cadence-chip.tsx` — Task 6
- [x] `RunNowButton` exists at `src/components/apps/run-now-button.tsx` — Task 7
- [x] `KPIStrip` supports formats int/currency/percent/duration/relative via `formatKpi` (called by `evaluateKpi`) and renders 1-6 tiles responsively — Task 1, 5
- [x] `RunNowButton` posts to blueprint trigger endpoint — Task 7. Inputs sheet **deferred** to Phase 3 (called out explicitly in the changelog entry per Task 18.3); current behavior surfaces blueprint-needs-inputs as a toast error rather than blocking
- [x] `WorkflowHubKit` registered + renders for ≥2 blueprints OR no clear hero table — Tasks 10 + 15. Phase 1.2's `rule6_multiBlueprint` already returns `workflow-hub` for these manifests; the resolved kit is now real, not placeholder
- [x] `TrackerKit` registered + renders for habit-tracker / reading-radar — Tasks 11 + 15. Phase 1.2's `rule2_tracker` returns `tracker` for these manifests
- [x] `evaluateKpi` covers 5 source.kind cases, each unit-tested — Task 2
- [x] Browser smoke for `/apps/habit-tracker` Tracker layout — Task 17
- [ ] Browser smoke for `/apps/<multi-blueprint-app>` Workflow Hub layout — **deferred**: no multi-blueprint app currently installed in `~/.ainative/apps/`. Acceptance criterion shifts to a unit-test assertion (`workflowHubKit.buildModel` populates secondary cards per blueprint — Task 10.1's "populates secondary cards" test). If a multi-blueprint app gets installed later, manually visit and visual-check
- [x] Manifest auto-inference picks tracker for habit-tracker (no `view:` declared) — covered by `inference.test.ts` from Phase 1.2; Task 17's HTTP smoke verifies end-to-end
- [x] Unit tests for `WorkflowHubKit.resolve` + `buildModel` (empty / single / multi blueprint cases) — Task 10
- [x] Unit tests for `TrackerKit.resolve` + `buildModel` (missing-bindings + explicit-bindings) — Task 11
- [x] No new React state in any kit file — `tracker.ts` and `workflow-hub.ts` import no React hooks; `useState` only appears in `RunNowButton` which is a primitive (not a kit) and explicitly client-marked

### Type consistency check

- `KitId` usage across types.ts / index.ts / data.ts is consistent (string literal union, no enum drift)
- `KpiSpec` is derived via `NonNullable<ViewConfig["bindings"]["kpis"]>[number]` in three places (evaluate-kpi, default-kpis, tracker, data) — all use the same derivation pattern, no shadow type
- `KpiTile` shape (`{id, label, value, hint?, trend?, spark?}`) is consistent across types.ts / format-kpi.ts / evaluate-kpi.ts / kpi-strip.tsx
- `RuntimeTaskSummary` defined once in types.ts; data.ts builds them; workflow-hub.ts consumes them; consistent shape throughout

### Placeholder scan

- No "TBD", "TODO", "implement later" in any task body
- All step instructions include actual code, not "similar to X" handwaves
- The two intentional deferrals (RunNowButton inputs sheet; Workflow Hub multi-blueprint browser smoke) are explicitly called out with "deferred" labels and clear rationale; not silent gaps

---

**End of plan.**
