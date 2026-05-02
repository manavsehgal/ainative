import { describe, expect, it } from "vitest";
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

const baseColumns = [{
  tableId: "transactions",
  columns: [
    { name: "date", type: "date" },
    { name: "amount", type: "number", semantic: "currency" },
    { name: "category", type: "string" },
  ],
}];

describe("ledgerKit.resolve", () => {
  it("picks first table and first blueprint when bindings absent", () => {
    const proj = ledgerKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
      period: "mtd",
    });
    expect((proj as any).heroTableId).toBe("transactions");
    expect((proj as any).runsBlueprintId).toBe("monthly-close");
    expect((proj as any).period).toBe("mtd");
  });

  it("synthesizes Net/Inflow/Outflow + Run-rate KPIs", () => {
    const proj = ledgerKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
      period: "qtd",
    });
    const ids = (proj as any).kpiSpecs.map((s: any) => s.id);
    expect(ids).toEqual(["net", "inflow", "outflow", "run-rate"]);
  });

  it("infers amountColumn and categoryColumn from columns", () => {
    const proj = ledgerKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
      period: "mtd",
    });
    expect((proj as any).amountColumn).toBe("amount");
    expect((proj as any).categoryColumn).toBe("category");
  });

  it("defaults period to 'mtd' when undefined", () => {
    const proj = ledgerKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    expect((proj as any).period).toBe("mtd");
  });
});

describe("ledgerKit.buildModel", () => {
  it("renders hero with custom kind and runNowBlueprintId", () => {
    const proj = ledgerKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
      period: "mtd",
    });
    const runtime = {
      app: {
        id: "fp1",
        name: "Finance",
        description: null,
        manifest: baseManifest,
        files: [],
      },
      recentTaskCount: 0,
      scheduleCadence: null,
      ledgerSeries: [],
      ledgerCategories: [],
      ledgerTransactions: [],
      ledgerMonthlyClose: null,
      ledgerPeriod: "mtd" as const,
    };
    const model = ledgerKit.buildModel(proj, runtime as any);
    expect(model.hero?.kind).toBe("custom");
    expect(model.header.runNowBlueprintId).toBe("monthly-close");
  });

  it("includes manifest pane in footer", () => {
    const proj = ledgerKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
      period: "mtd",
    });
    const runtime = {
      app: { id: "fp1", name: "Finance", description: null, manifest: baseManifest, files: [] },
      recentTaskCount: 0,
      scheduleCadence: null,
      ledgerPeriod: "mtd" as const,
    };
    const model = ledgerKit.buildModel(proj, runtime as any);
    expect(model.footer?.appId).toBe("fp1");
  });
});
