import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateManifestTriggers } from "../manifest-trigger-dispatch";
import * as registry from "../registry";
import * as instantiator from "@/lib/workflows/blueprints/instantiator";
import * as engine from "@/lib/workflows/engine";

vi.mock("../registry", async () => {
  const actual = await vi.importActual<typeof import("../registry")>("../registry");
  return { ...actual, listAppsWithManifestsCached: vi.fn() };
});

vi.mock("@/lib/workflows/blueprints/instantiator", () => ({
  instantiateBlueprint: vi.fn(),
}));

vi.mock("@/lib/workflows/engine", () => ({
  executeWorkflow: vi.fn(),
}));

vi.mock("@/lib/workflows/blueprints/registry", () => ({
  getBlueprint: vi.fn(),
}));
import * as bpRegistry from "@/lib/workflows/blueprints/registry";

describe("evaluateManifestTriggers — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("instantiates and runs one blueprint when one manifest subscribes", async () => {
    vi.mocked(registry.listAppsWithManifestsCached).mockReturnValue([
      {
        id: "test-app",
        manifest: {
          id: "test-app",
          name: "Test app",
          blueprints: [
            {
              id: "test-app--my-bp",
              trigger: { kind: "row-insert", table: "tbl-x" },
            },
          ],
          tables: [{ id: "tbl-x" }],
        },
      } as any,
    ]);

    vi.mocked(instantiator.instantiateBlueprint).mockResolvedValue({
      workflowId: "wf-1",
      name: "Test wf",
      stepsCount: 1,
      skippedSteps: [],
    });

    await evaluateManifestTriggers("tbl-x", "row-1", { foo: "bar" });

    expect(instantiator.instantiateBlueprint).toHaveBeenCalledTimes(1);
    expect(instantiator.instantiateBlueprint).toHaveBeenCalledWith(
      "test-app--my-bp",
      expect.any(Object),
      "test-app",
      { _contextRowId: "row-1" }
    );
    expect(engine.executeWorkflow).toHaveBeenCalledWith("wf-1");
  });
});

describe("evaluateManifestTriggers — match counts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when no manifest subscribes to the table", async () => {
    vi.mocked(registry.listAppsWithManifestsCached).mockReturnValue([]);
    await evaluateManifestTriggers("tbl-other", "row-1", {});
    expect(instantiator.instantiateBlueprint).not.toHaveBeenCalled();
    expect(engine.executeWorkflow).not.toHaveBeenCalled();
  });

  it("fires both apps when 2 manifests subscribe to the same table", async () => {
    vi.mocked(registry.listAppsWithManifestsCached).mockReturnValue([
      {
        id: "app-a",
        manifest: {
          id: "app-a",
          blueprints: [
            { id: "app-a--bp", trigger: { kind: "row-insert", table: "tbl-x" } },
          ],
        },
      } as any,
      {
        id: "app-b",
        manifest: {
          id: "app-b",
          blueprints: [
            { id: "app-b--bp", trigger: { kind: "row-insert", table: "tbl-x" } },
          ],
        },
      } as any,
    ]);

    vi.mocked(instantiator.instantiateBlueprint)
      .mockResolvedValueOnce({ workflowId: "wf-a", name: "A", stepsCount: 1, skippedSteps: [] })
      .mockResolvedValueOnce({ workflowId: "wf-b", name: "B", stepsCount: 1, skippedSteps: [] });

    await evaluateManifestTriggers("tbl-x", "row-1", {});

    expect(instantiator.instantiateBlueprint).toHaveBeenCalledTimes(2);
    expect(instantiator.instantiateBlueprint).toHaveBeenNthCalledWith(
      1, "app-a--bp", expect.any(Object), "app-a", { _contextRowId: "row-1" }
    );
    expect(instantiator.instantiateBlueprint).toHaveBeenNthCalledWith(
      2, "app-b--bp", expect.any(Object), "app-b", { _contextRowId: "row-1" }
    );
  });

  it("ignores manifests that subscribe to a different table", async () => {
    vi.mocked(registry.listAppsWithManifestsCached).mockReturnValue([
      {
        id: "app-a",
        manifest: {
          id: "app-a",
          blueprints: [
            { id: "app-a--bp", trigger: { kind: "row-insert", table: "tbl-other" } },
          ],
        },
      } as any,
    ]);

    await evaluateManifestTriggers("tbl-x", "row-1", {});
    expect(instantiator.instantiateBlueprint).not.toHaveBeenCalled();
  });
});

describe("evaluateManifestTriggers — variable substitution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves {{row.<col>}} placeholders from row data into instantiate variables", async () => {
    vi.mocked(registry.listAppsWithManifestsCached).mockReturnValue([
      {
        id: "app-x",
        manifest: {
          id: "app-x",
          blueprints: [
            { id: "app-x--bp", trigger: { kind: "row-insert", table: "tbl-x" } },
          ],
        },
      } as any,
    ]);

    // Blueprint declares variables with {{row.<col>}} defaults
    vi.mocked(bpRegistry.getBlueprint).mockReturnValue({
      id: "app-x--bp",
      name: "Test BP",
      pattern: "sequence",
      variables: [
        { id: "customer", type: "text", label: "Customer", required: true, default: "{{row.customer}}" },
        { id: "summary", type: "text", label: "Summary", required: true, default: "{{row.summary}}" },
        { id: "sentiment", type: "text", label: "Sentiment", required: false, default: "{{row.sentiment}}" },
      ],
      steps: [],
    } as any);

    vi.mocked(instantiator.instantiateBlueprint).mockResolvedValue({
      workflowId: "wf-1",
      name: "T",
      stepsCount: 1,
      skippedSteps: [],
    });

    await evaluateManifestTriggers("tbl-x", "row-1", {
      customer: "Acme Corp",
      summary: "Bug report",
      sentiment: "negative",
    });

    expect(instantiator.instantiateBlueprint).toHaveBeenCalledWith(
      "app-x--bp",
      expect.objectContaining({
        customer: "Acme Corp",
        summary: "Bug report",
        sentiment: "negative",
      }),
      "app-x",
      { _contextRowId: "row-1" }
    );
  });
});
