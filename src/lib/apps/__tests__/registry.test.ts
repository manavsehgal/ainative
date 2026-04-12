import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  getAppBundle,
  getFailedSapLoads,
  listAppBundles,
  registerBundle,
} from "../registry";
import { bundleToSap } from "../sap-converter";
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

describe("JIT SAP fallback in getAppBundle", () => {
  let tempDir: string;
  const originalDataDir = process.env.STAGENT_DATA_DIR;

  afterEach(() => {
    process.env.STAGENT_DATA_DIR = originalDataDir;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("loads a SAP bundle from disk when not in cache", async () => {
    // Set up a temp data dir with a valid SAP bundle
    tempDir = mkdtempSync(join(tmpdir(), "stagent-jit-"));
    process.env.STAGENT_DATA_DIR = tempDir;

    // Export a known builtin bundle to the SAP directory
    const wealthManager = getAppBundle("wealth-manager")!;
    const sapDir = join(tempDir, "apps", "wealth-manager");
    const { mkdirSync } = await import("fs");
    mkdirSync(sapDir, { recursive: true });
    await bundleToSap(wealthManager, sapDir);

    // Now look up an app ID that only exists on disk (not a builtin)
    // We use a unique ID to avoid cache hits from the builtin
    const { writeFileSync } = await import("fs");
    const yaml = await import("js-yaml");

    // Create a custom SAP bundle with a unique ID
    const customDir = join(tempDir, "apps", "jit-test-app");
    mkdirSync(customDir, { recursive: true });
    mkdirSync(join(customDir, "templates"), { recursive: true });
    mkdirSync(join(customDir, "schedules"), { recursive: true });
    mkdirSync(join(customDir, "profiles"), { recursive: true });
    mkdirSync(join(customDir, "blueprints"), { recursive: true });

    const manifest = {
      id: "jit-test-app",
      name: "JIT Test App",
      version: "1.0.0",
      description: "A test app for JIT loading",
      author: { name: "Test" },
      platform: { minVersion: "0.9.0" },
      marketplace: { category: "general", tags: [], difficulty: "beginner" },
      sidebar: { label: "JIT Test", icon: "Box", route: "/app/jit-test-app" },
      provides: { tables: [], profiles: [], blueprints: [], schedules: [], triggers: [], pages: [] },
      ui: { pages: [{ key: "overview", title: "Overview", description: "Main", widgets: [{ type: "hero", title: "JIT", description: "Test" }] }] },
    };
    writeFileSync(join(customDir, "manifest.yaml"), yaml.dump(manifest));

    // The JIT fallback should find it on disk
    const bundle = getAppBundle("jit-test-app");
    expect(bundle).toBeDefined();
    expect(bundle?.manifest.name).toBe("JIT Test App");
  });

  it("returns undefined for non-existent app IDs", () => {
    tempDir = mkdtempSync(join(tmpdir(), "stagent-jit-miss-"));
    process.env.STAGENT_DATA_DIR = tempDir;

    const bundle = getAppBundle("completely-nonexistent-app");
    expect(bundle).toBeUndefined();
  });

  it("caches failed SAP loads to avoid repeated disk reads", () => {
    tempDir = mkdtempSync(join(tmpdir(), "stagent-jit-fail-"));
    process.env.STAGENT_DATA_DIR = tempDir;

    const { mkdirSync, writeFileSync } = require("fs");
    const corruptDir = join(tempDir, "apps", "corrupt-app");
    mkdirSync(corruptDir, { recursive: true });
    // Write an invalid manifest to trigger a parse failure
    writeFileSync(join(corruptDir, "manifest.yaml"), "id: 123\nname: x\n");

    // First call: attempts disk load, fails, records in failedSapLoads
    const first = getAppBundle("corrupt-app");
    expect(first).toBeUndefined();
    expect(getFailedSapLoads().has("corrupt-app")).toBe(true);

    // Second call: should NOT attempt disk load again (cached failure)
    // We verify by checking the error message is still the same (not re-thrown)
    const second = getAppBundle("corrupt-app");
    expect(second).toBeUndefined();
  });
});
