import { describe, expect, it } from "vitest";
import type { AppManifest } from "@/lib/apps/registry";
import { loadColumnSchemas, resolveKit } from "../index";
import { placeholderKit } from "../kits/placeholder";

function makeManifest(over: Partial<AppManifest> = {}): AppManifest {
  return {
    id: "x",
    name: "X",
    profiles: [],
    blueprints: [],
    tables: [],
    schedules: [],
    ...over,
  } as AppManifest;
}

describe("resolveKit — KitId to KitDefinition lookup", () => {
  it("returns placeholderKit for the literal 'placeholder' id", () => {
    expect(resolveKit("placeholder")).toBe(placeholderKit);
  });

  it("returns the registered kit for tracker and workflow-hub (Phase 2)", () => {
    expect(resolveKit("tracker").id).toBe("tracker");
    expect(resolveKit("workflow-hub").id).toBe("workflow-hub");
  });

  it("falls back to placeholderKit for kit ids reserved for later phases", () => {
    expect(resolveKit("ledger")).toBe(placeholderKit);
    expect(resolveKit("coach")).toBe(placeholderKit);
    expect(resolveKit("inbox")).toBe(placeholderKit);
    expect(resolveKit("research")).toBe(placeholderKit);
  });
});

describe("loadColumnSchemas — reads column data per manifest table", () => {
  it("returns empty array when manifest has no tables", async () => {
    const m = makeManifest();
    const out = await loadColumnSchemas(m, async () => []);
    expect(out).toEqual([]);
  });

  it("queries each manifest table and shapes results into ColumnSchemaRef", async () => {
    const m = makeManifest({
      tables: [{ id: "t1" }, { id: "t2" }],
    });
    const out = await loadColumnSchemas(m, async (id) => {
      if (id === "t1") {
        return [
          { name: "amount", dataType: "number", config: '{"semantic":"currency"}' },
          { name: "date", dataType: "date", config: null },
        ];
      }
      if (id === "t2") {
        return [{ name: "title", dataType: "text", config: null }];
      }
      return [];
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      tableId: "t1",
      columns: [
        { name: "amount", type: "number", semantic: "currency" },
        { name: "date", type: "date", semantic: undefined },
      ],
    });
    expect(out[1]).toEqual({
      tableId: "t2",
      columns: [{ name: "title", type: "text", semantic: undefined }],
    });
  });

  it("tolerates a fetcher that throws or returns empty for missing tables", async () => {
    const m = makeManifest({ tables: [{ id: "missing" }, { id: "ok" }] });
    const out = await loadColumnSchemas(m, async (id) => {
      if (id === "missing") throw new Error("not found");
      return [{ name: "x", dataType: "text", config: null }];
    });
    expect(out).toEqual([
      { tableId: "missing", columns: [] },
      { tableId: "ok", columns: [{ name: "x", type: "text", semantic: undefined }] },
    ]);
  });

  it("tolerates malformed config JSON without throwing", async () => {
    const m = makeManifest({ tables: [{ id: "t1" }] });
    const out = await loadColumnSchemas(m, async () => [
      { name: "x", dataType: "text", config: "not json" },
    ]);
    expect(out[0].columns[0].semantic).toBeUndefined();
  });
});
