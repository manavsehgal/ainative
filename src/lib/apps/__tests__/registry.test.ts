import { describe, expect, it } from "vitest";
import { getAppBundle, listAppBundles, registerBundle } from "../registry";
import type { AppBundle } from "../types";

// Minimal valid bundle for testing registerBundle
function makeTestBundle(id: string): AppBundle {
  return {
    manifest: {
      id,
      name: `Test ${id}`,
      version: "1.0.0",
      description: "A test bundle",
      category: "general",
      tags: [],
      difficulty: "beginner",
      estimatedSetupMinutes: 5,
      icon: "Rocket",
      trustLevel: "private",
      permissions: ["projects:create"],
      sidebarLabel: `Test ${id}`,
    },
    setupChecklist: ["Install the app"],
    profiles: [],
    blueprints: [],
    tables: [],
    schedules: [],
    ui: {
      pages: [
        {
          key: "overview",
          title: "Overview",
          description: "Main page",
          widgets: [
            {
              type: "hero",
              title: `Test ${id}`,
              description: "A test bundle",
            },
          ],
        },
      ],
    },
  };
}

describe("app bundle registry", () => {
  it("loads the built-in verified bundles", () => {
    const bundles = listAppBundles();

    expect(bundles.map((bundle) => bundle.manifest.id)).toContain(
      "wealth-manager",
    );
    expect(bundles.map((bundle) => bundle.manifest.id)).toContain(
      "growth-module",
    );
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

  it("registerBundle makes bundle findable via getAppBundle", () => {
    const bundle = makeTestBundle("test-register-1");
    registerBundle(bundle);

    const found = getAppBundle("test-register-1");
    expect(found).toBeDefined();
    expect(found?.manifest.name).toBe("Test test-register-1");
  });

  it("registerBundle overwrites existing bundle with same id", () => {
    const bundle1 = makeTestBundle("test-overwrite");
    registerBundle(bundle1);

    const bundle2 = makeTestBundle("test-overwrite");
    bundle2.manifest.name = "Updated Name";
    registerBundle(bundle2);

    expect(getAppBundle("test-overwrite")?.manifest.name).toBe("Updated Name");
  });

  it("registerBundle rejects invalid bundles", () => {
    const invalid = { manifest: { id: "bad" } } as unknown as AppBundle;
    expect(() => registerBundle(invalid)).toThrow(/Invalid app bundle/);
  });

  it("registered bundles appear in listAppBundles", () => {
    const bundle = makeTestBundle("test-list-check");
    registerBundle(bundle);

    const ids = listAppBundles().map((b) => b.manifest.id);
    expect(ids).toContain("test-list-check");
  });
});
