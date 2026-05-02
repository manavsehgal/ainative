import { describe, expect, it } from "vitest";
import { researchKit } from "../research";

const baseManifest = {
  id: "rd",
  name: "Research digest",
  description: "Weekly synthesis across configured sources.",
  profiles: [{ id: "research-analyst" }],
  blueprints: [{ id: "weekly-digest", name: "Weekly digest" }],
  schedules: [{ id: "fri-5pm", cron: "0 17 * * 5", runs: "weekly-digest" }],
  tables: [
    {
      id: "sources",
      name: "sources",
      columns: [
        { name: "name" },
        { name: "url" },
        { name: "cadence" },
      ],
    },
  ],
  view: undefined,
};

const baseColumns = [{
  tableId: "sources",
  columns: [
    { name: "name" },
    { name: "url" },
    { name: "cadence" },
  ],
}];

const baseRuntime = {
  app: {
    id: "app1",
    name: baseManifest.name,
    description: baseManifest.description,
    manifest: baseManifest,
    files: [],
  },
  recentTaskCount: 0,
  scheduleCadence: "Fridays at 5pm",
  cadence: { humanLabel: "Fridays at 5pm", nextFireMs: null },
  researchSources: [],
  latestSynthesisDocId: null,
  researchSynthesisContent: null,
  researchCitations: [],
  researchRecentRuns: [],
  researchSourcesCount: 0,
  researchLastSynthAge: null,
};

describe("researchKit.resolve", () => {
  it("picks first table and first blueprint when bindings absent", () => {
    const proj = researchKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    expect((proj as any).sourcesTableId).toBe("sources");
    expect((proj as any).synthesisBlueprintId).toBe("weekly-digest");
    expect((proj as any).cadenceScheduleId).toBe("fri-5pm");
  });
});

describe("researchKit.buildModel", () => {
  it("populates header with cadence chip + KPIs", () => {
    const proj = researchKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    const model = researchKit.buildModel(proj, baseRuntime as any);
    expect(model.header.cadenceChip).toBeDefined();
    expect(model.header.runNowBlueprintId).toBe("weekly-digest");
    expect(model.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "sources-count" }),
        expect.objectContaining({ id: "last-synth-age" }),
      ])
    );
  });

  it("hero is a research-split kind with sources + synthesis content", () => {
    const proj = researchKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    const model = researchKit.buildModel(proj, baseRuntime as any);
    expect(model.hero?.kind).toBe("research-split");
    expect(model.hero?.content).toBeDefined();
  });

  it("activity is run-history-timeline", () => {
    const proj = researchKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    const model = researchKit.buildModel(proj, baseRuntime as any);
    expect(model.activity?.kind).toBe("run-history-timeline");
    expect(model.activity?.content).toBeDefined();
  });

  it("includes manifest pane in footer", () => {
    const proj = researchKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    const model = researchKit.buildModel(proj, baseRuntime as any);
    expect(model.footer?.appId).toBe("app1");
  });
});
