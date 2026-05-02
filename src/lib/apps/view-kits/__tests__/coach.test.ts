import { describe, expect, it } from "vitest";
import { coachKit } from "../kits/coach";

const baseManifest = {
  id: "weekly-portfolio-check-in",
  name: "Weekly portfolio check-in",
  profiles: [{ id: "wealth-manager-coach", name: "Wealth Coach" }],
  blueprints: [
    {
      id: "weekly-digest",
      name: "Weekly Digest",
      variables: [{ id: "asset", type: "text", label: "Asset", required: true }],
    },
  ],
  schedules: [{ id: "monday-8am", cron: "0 8 * * 1" }],
  tables: [],
  view: undefined,
};

const baseRuntime = {
  app: {
    id: "wp1",
    name: "Weekly check-in",
    description: null,
    manifest: baseManifest,
    files: [],
  },
  recentTaskCount: 5,
  scheduleCadence: "Mondays at 8am",
};

describe("coachKit.resolve", () => {
  it("picks first blueprint and first schedule when bindings absent", () => {
    const proj = coachKit.resolve({
      manifest: baseManifest as any,
      columns: [],
    });
    expect((proj as any).runsBlueprintId).toBe("weekly-digest");
    expect((proj as any).cadenceScheduleId).toBe("monday-8am");
  });

  it("threads blueprint variables into projection", () => {
    const proj = coachKit.resolve({
      manifest: baseManifest as any,
      columns: [],
    });
    expect((proj as any).runsBlueprintVars).toEqual([
      { id: "asset", type: "text", label: "Asset", required: true },
    ]);
  });
});

describe("coachKit.buildModel", () => {
  it("renders hero with task and previous runs", () => {
    const projection = coachKit.resolve({
      manifest: baseManifest as any,
      columns: [],
    });
    const runtime = {
      ...baseRuntime,
      coachLatestTask: {
        id: "t1",
        title: "Latest",
        status: "completed" as const,
        createdAt: Date.now(),
        result: "## OK",
      },
      coachPreviousRuns: [],
      coachCadenceCells: [],
    };
    const model = coachKit.buildModel(projection, runtime as any);
    expect(model.hero?.kind).toBe("custom");
    expect(model.header.runNowBlueprintId).toBe("weekly-digest");
    expect(model.header.runNowVariables).toBeDefined();
  });

  it("renders empty-state hero when no completed task yet", () => {
    const projection = coachKit.resolve({
      manifest: baseManifest as any,
      columns: [],
    });
    const runtime = {
      ...baseRuntime,
      coachLatestTask: null,
      coachPreviousRuns: [],
      coachCadenceCells: [],
    };
    const model = coachKit.buildModel(projection, runtime as any);
    expect(model.hero?.kind).toBe("custom");
  });

  it("includes manifest pane in footer", () => {
    const projection = coachKit.resolve({
      manifest: baseManifest as any,
      columns: [],
    });
    const runtime = {
      ...baseRuntime,
      coachLatestTask: null,
      coachPreviousRuns: [],
      coachCadenceCells: [],
    };
    const model = coachKit.buildModel(projection, runtime as any);
    expect(model.footer).toBeDefined();
    expect(model.footer?.appId).toBe("wp1");
  });
});
