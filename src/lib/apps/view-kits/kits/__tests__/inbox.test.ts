import { describe, expect, it } from "vitest";
import { inboxKit } from "../inbox";

const baseManifest = {
  id: "cfd",
  name: "Customer follow-up drafter",
  description: "Drafts follow-ups when new touchpoints land.",
  profiles: [{ id: "cs-coach" }],
  blueprints: [
    {
      id: "draft-followup",
      name: "Draft followup",
      trigger: { kind: "row-insert", table: "customer-touchpoints" },
    },
  ],
  schedules: [],
  tables: [
    {
      id: "customer-touchpoints",
      name: "customer-touchpoints",
      columns: [
        { name: "channel" },
        { name: "summary" },
        { name: "sentiment" },
      ],
    },
  ],
  view: undefined,
};

const baseColumns = [{
  tableId: "customer-touchpoints",
  columns: [
    { name: "channel" },
    { name: "summary" },
    { name: "sentiment" },
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
  scheduleCadence: null,
  inboxQueueRows: [],
  inboxSelectedRowId: null,
  inboxDraftDocument: null,
};

describe("inboxKit.resolve", () => {
  it("picks first table and first blueprint when bindings absent", () => {
    const proj = inboxKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    expect((proj as any).queueTableId).toBe("customer-touchpoints");
    expect((proj as any).draftBlueprintId).toBe("draft-followup");
  });

  it("computes triggerSource via detectTriggerSource", () => {
    const proj = inboxKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    expect((proj as any).triggerSource).toMatchObject({
      kind: "row-insert",
      table: "customer-touchpoints",
      blueprintId: "draft-followup",
    });
  });

  it("falls back to manual when manifest has no triggers/schedules", () => {
    const m = {
      ...baseManifest,
      blueprints: [{ id: "manual-bp", name: "Manual" }],
    };
    const proj = inboxKit.resolve({
      manifest: m as any,
      columns: baseColumns,
    });
    expect((proj as any).triggerSource.kind).toBe("manual");
  });
});

describe("inboxKit.buildModel", () => {
  it("renders header with triggerSourceChip and suppresses runNowBlueprintId for row-insert", () => {
    const proj = inboxKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    const model = inboxKit.buildModel(proj, baseRuntime as any);
    expect(model.header.triggerSourceChip?.kind).toBe("row-insert");
    expect(model.header.runNowBlueprintId).toBeUndefined();
  });

  it("includes runNowBlueprintId when triggerSource is manual or schedule", () => {
    const m = {
      ...baseManifest,
      blueprints: [{ id: "manual-bp", name: "Manual" }],
    };
    const proj = inboxKit.resolve({
      manifest: m as any,
      columns: baseColumns,
    });
    const model = inboxKit.buildModel(proj, {
      ...baseRuntime,
      app: { ...baseRuntime.app, manifest: m },
    } as any);
    expect(model.header.runNowBlueprintId).toBe("manual-bp");
  });

  it("hero is a custom kind with InboxSplitView content", () => {
    const proj = inboxKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    const model = inboxKit.buildModel(proj, baseRuntime as any);
    expect(model.hero?.kind).toBe("inbox-split");
    expect(model.hero?.content).toBeDefined();
  });

  it("activity slot is a throughput-strip", () => {
    const proj = inboxKit.resolve({
      manifest: baseManifest as any,
      columns: baseColumns,
    });
    const model = inboxKit.buildModel(proj, baseRuntime as any);
    expect(model.activity?.kind).toBe("throughput-strip");
    expect(model.activity?.content).toBeDefined();
  });
});
