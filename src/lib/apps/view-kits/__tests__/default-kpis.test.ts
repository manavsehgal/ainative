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
