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
