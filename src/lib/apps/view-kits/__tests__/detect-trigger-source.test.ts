import { describe, expect, it, vi } from "vitest";
import { detectTriggerSource } from "../detect-trigger-source";

const baseManifest = {
  id: "ut",
  name: "ut",
  profiles: [],
  blueprints: [] as any[],
  schedules: [] as any[],
  tables: [] as any[],
};

describe("detectTriggerSource", () => {
  it("returns row-insert when a blueprint declares it and the table exists", () => {
    const m = {
      ...baseManifest,
      tables: [{ id: "customer-touchpoints" }],
      blueprints: [
        {
          id: "draft",
          name: "Draft",
          trigger: { kind: "row-insert", table: "customer-touchpoints" },
        },
      ],
    } as any;

    const result = detectTriggerSource(m);
    expect(result).toEqual({
      kind: "row-insert",
      table: "customer-touchpoints",
      blueprintId: "draft",
    });
  });

  it("falls back to schedule when row-insert table is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = {
      ...baseManifest,
      tables: [],
      blueprints: [
        {
          id: "draft",
          name: "Draft",
          trigger: { kind: "row-insert", table: "missing-table" },
        },
      ],
      schedules: [{ id: "s1", cron: "0 8 * * 1", runs: "draft" }],
    } as any;

    const result = detectTriggerSource(m);
    expect(result).toEqual({
      kind: "schedule",
      scheduleId: "s1",
      blueprintId: "draft",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("missing-table")
    );
    warn.mockRestore();
  });

  it("returns schedule when no trigger but a schedule binds the blueprint", () => {
    const m = {
      ...baseManifest,
      blueprints: [{ id: "weekly", name: "Weekly" }],
      schedules: [{ id: "s1", cron: "0 9 * * 1", runs: "weekly" }],
    } as any;

    expect(detectTriggerSource(m, "weekly")).toEqual({
      kind: "schedule",
      scheduleId: "s1",
      blueprintId: "weekly",
    });
  });

  it("returns manual when no trigger and no schedule references the blueprint", () => {
    const m = {
      ...baseManifest,
      blueprints: [{ id: "manual-bp", name: "Manual" }],
      schedules: [],
    } as any;

    expect(detectTriggerSource(m, "manual-bp")).toEqual({
      kind: "manual",
      blueprintId: "manual-bp",
    });
  });

  it("prefers preferredBlueprintId when two blueprints declare row-insert", () => {
    const m = {
      ...baseManifest,
      tables: [{ id: "tbl-a" }, { id: "tbl-b" }],
      blueprints: [
        {
          id: "first",
          name: "First",
          trigger: { kind: "row-insert", table: "tbl-a" },
        },
        {
          id: "second",
          name: "Second",
          trigger: { kind: "row-insert", table: "tbl-b" },
        },
      ],
    } as any;

    expect(detectTriggerSource(m, "second")).toEqual({
      kind: "row-insert",
      table: "tbl-b",
      blueprintId: "second",
    });
  });

  it("falls back to first match when preferredBlueprintId doesn't match", () => {
    const m = {
      ...baseManifest,
      tables: [{ id: "tbl-a" }],
      blueprints: [
        {
          id: "first",
          name: "First",
          trigger: { kind: "row-insert", table: "tbl-a" },
        },
      ],
    } as any;

    expect(detectTriggerSource(m, "nonexistent")).toEqual({
      kind: "row-insert",
      table: "tbl-a",
      blueprintId: "first",
    });
  });
});
