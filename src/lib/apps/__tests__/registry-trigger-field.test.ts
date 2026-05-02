import { describe, expect, it } from "vitest";
import { AppManifestSchema } from "@/lib/apps/registry";

const baseManifest = {
  id: "ut",
  name: "ut",
  profiles: [],
  blueprints: [],
  schedules: [],
  tables: [],
};

describe("BlueprintBase.trigger field", () => {
  it("accepts a row-insert trigger with table id", () => {
    const m = AppManifestSchema.parse({
      ...baseManifest,
      blueprints: [
        {
          id: "draft-followup",
          name: "Draft followup",
          trigger: { kind: "row-insert", table: "customer-touchpoints" },
        },
      ],
    });
    expect(m.blueprints[0]?.trigger?.kind).toBe("row-insert");
    expect((m.blueprints[0]?.trigger as any)?.table).toBe("customer-touchpoints");
  });

  it("accepts blueprints with no trigger field (backward compatible)", () => {
    const m = AppManifestSchema.parse({
      ...baseManifest,
      blueprints: [{ id: "weekly-digest", name: "Weekly digest" }],
    });
    expect(m.blueprints[0]?.trigger).toBeUndefined();
  });

  it("rejects a trigger missing the table id", () => {
    expect(() =>
      AppManifestSchema.parse({
        ...baseManifest,
        blueprints: [
          {
            id: "bad",
            name: "Bad",
            trigger: { kind: "row-insert" },
          },
        ],
      })
    ).toThrow();
  });

  it("rejects a trigger with unknown kind", () => {
    expect(() =>
      AppManifestSchema.parse({
        ...baseManifest,
        blueprints: [
          {
            id: "bad",
            name: "Bad",
            trigger: { kind: "webhook", url: "..." },
          },
        ],
      })
    ).toThrow();
  });
});
