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
  tableSumWindowed(
    table: string,
    column: string,
    sign: "positive" | "negative" | undefined,
    window: "mtd" | "qtd" | "ytd" | undefined
  ): Promise<KpiPrimitive>;
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
    case "tableSumWindowed":
      raw = await ctx.tableSumWindowed(
        spec.source.table,
        spec.source.column,
        spec.source.sign,
        spec.source.window
      );
      break;
  }
  return {
    id: spec.id,
    label: spec.label,
    value: formatKpi(raw, spec.format),
  };
}
