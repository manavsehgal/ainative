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
    const proj = trackerKit.resolve({
      manifest: app.manifest,
      columns: cols,
    }) as Record<string, unknown>;
    expect(proj.heroTableId).toBe("logs");
    expect(proj.cadenceScheduleId).toBe("sch-1");
    expect(proj.runsBlueprintId).toBe("review");
    expect(Array.isArray(proj.kpiSpecs)).toBe(true);
    expect((proj.kpiSpecs as unknown[]).length).toBeGreaterThan(0);
  });

  it("returns undefined heroTableId when manifest has no tables", () => {
    const app = makeApp({});
    const proj = trackerKit.resolve({
      manifest: app.manifest,
      columns: [],
    }) as Record<string, unknown>;
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
    const proj = trackerKit.resolve({
      manifest: app.manifest,
      columns: [],
    }) as Record<string, unknown>;
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
    const proj = trackerKit.resolve({
      manifest: app.manifest,
      columns: [],
    }) as Record<string, unknown>;
    const specs = proj.kpiSpecs as Array<{ id: string }>;
    expect(specs[0].id).toBe("custom");
    expect(specs).toHaveLength(1);
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
