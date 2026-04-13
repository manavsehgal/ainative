import { describe, expect, it } from "vitest";
import { getAppBundle, listAppBundles } from "../registry";

describe("app bundle registry", () => {
  it("loads the built-in verified bundles", () => {
    const bundles = listAppBundles();

    expect(bundles.map((bundle) => bundle.manifest.id)).toEqual([
      "wealth-manager",
      "growth-module",
    ]);
  });

  it("returns a specific bundle by id", () => {
    const bundle = getAppBundle("wealth-manager");

    expect(bundle?.manifest.name).toBe("Wealth Manager");
    expect(bundle?.ui.pages[0]?.key).toBe("overview");
    expect(bundle?.tables).toHaveLength(3);
  });

  it("returns undefined for unknown bundles", () => {
    expect(getAppBundle("missing-app")).toBeUndefined();
  });
});
