import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PRIMITIVE_MAP } from "../primitive-map";

describe("PRIMITIVE_MAP", () => {
  const profileIds = new Set(
    fs
      .readdirSync(path.join(process.cwd(), "src/lib/agents/profiles/builtins"))
      .filter((e) =>
        fs
          .statSync(
            path.join(process.cwd(), "src/lib/agents/profiles/builtins", e)
          )
          .isDirectory()
      )
  );

  const blueprintIds = new Set(
    fs
      .readdirSync(
        path.join(process.cwd(), "src/lib/workflows/blueprints/builtins")
      )
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.replace(/\.yaml$/, ""))
  );

  it("every entry references a live profile id", () => {
    for (const [keyword, plan] of Object.entries(PRIMITIVE_MAP)) {
      expect(
        profileIds.has(plan.profileId),
        `keyword "${keyword}" → unknown profile "${plan.profileId}"`
      ).toBe(true);
    }
  });

  it("every entry references a live blueprint id", () => {
    for (const [keyword, plan] of Object.entries(PRIMITIVE_MAP)) {
      expect(
        blueprintIds.has(plan.blueprintId),
        `keyword "${keyword}" → unknown blueprint "${plan.blueprintId}"`
      ).toBe(true);
    }
  });

  it("has no duplicate keywords", () => {
    const keys = Object.keys(PRIMITIVE_MAP);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has at least 10 entries", () => {
    expect(Object.keys(PRIMITIVE_MAP).length).toBeGreaterThanOrEqual(10);
  });
});
