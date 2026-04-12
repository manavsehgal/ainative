import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  sapToBundle,
  sapToBundleSync,
  bundleToSap,
  applyNamespace,
  stripNamespace,
  checkPlatformCompat,
  validateFileReferences,
} from "../sap-converter";
import { getAppBundle } from "../registry";
import type { SapManifest } from "../types";

const FIXTURE_DIR = join(__dirname, "fixtures", "wealth-manager.sap");

let tempDir: string;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function makeTempDir(label: string): string {
  tempDir = mkdtempSync(join(tmpdir(), `stagent-sap-${label}-`));
  return tempDir;
}

describe("namespace helpers", () => {
  it("applyNamespace prefixes a key", () => {
    expect(applyNamespace("my-app", "positions")).toBe("my-app--positions");
  });

  it("applyNamespace is idempotent for already-prefixed keys", () => {
    expect(applyNamespace("my-app", "my-app--positions")).toBe("my-app--positions");
  });

  it("stripNamespace removes the prefix", () => {
    expect(stripNamespace("my-app", "my-app--positions")).toBe("positions");
  });

  it("stripNamespace leaves unprefixed keys unchanged", () => {
    expect(stripNamespace("my-app", "positions")).toBe("positions");
  });
});

describe("sapToBundle", () => {
  it("parses the wealth-manager fixture into a valid AppBundle", async () => {
    const bundle = await sapToBundle(FIXTURE_DIR);

    expect(bundle.manifest.id).toBe("wealth-manager");
    expect(bundle.manifest.name).toBe("Wealth Manager");
    expect(bundle.manifest.version).toBe("1.0.0");
    expect(bundle.manifest.category).toBe("finance");
    expect(bundle.manifest.difficulty).toBe("intermediate");
  });

  it("applies namespace prefixes to table keys", async () => {
    const bundle = await sapToBundle(FIXTURE_DIR);

    const tableKeys = bundle.tables.map((t) => t.key);
    expect(tableKeys).toContain("wealth-manager--positions");
    expect(tableKeys).toContain("wealth-manager--transactions");
    expect(tableKeys).toContain("wealth-manager--watchlist");
  });

  it("applies namespace prefixes to schedule keys", async () => {
    const bundle = await sapToBundle(FIXTURE_DIR);

    expect(bundle.schedules[0].key).toBe("wealth-manager--daily-review");
  });

  it("applies namespace prefixes to profile IDs", async () => {
    const bundle = await sapToBundle(FIXTURE_DIR);

    const profileIds = bundle.profiles.map((p) => p.id);
    expect(profileIds).toContain("wealth-manager--wealth-manager");
    expect(profileIds).toContain("wealth-manager--financial-analyst");
  });

  it("applies namespace prefixes to blueprint IDs", async () => {
    const bundle = await sapToBundle(FIXTURE_DIR);

    const bpIds = bundle.blueprints.map((b) => b.id);
    expect(bpIds).toContain("wealth-manager--investment-research");
    expect(bpIds).toContain("wealth-manager--financial-reporting");
  });

  it("loads table columns and sample rows from YAML", async () => {
    const bundle = await sapToBundle(FIXTURE_DIR);

    const positions = bundle.tables.find((t) => t.key === "wealth-manager--positions");
    expect(positions).toBeDefined();
    expect(positions!.columns).toHaveLength(7);
    expect(positions!.sampleRows).toHaveLength(3);
    expect(positions!.columns[0].name).toBe("symbol");
  });

  it("loads schedule prompt and cron from YAML", async () => {
    const bundle = await sapToBundle(FIXTURE_DIR);

    expect(bundle.schedules[0].cronExpression).toBe("0 16 * * 1-5");
    expect(bundle.schedules[0].prompt).toContain("Review the portfolio");
  });

  it("extracts profile labels from markdown headings", async () => {
    const bundle = await sapToBundle(FIXTURE_DIR);

    const wm = bundle.profiles.find((p) => p.id === "wealth-manager--wealth-manager");
    expect(wm?.label).toBe("Wealth Manager");
  });

  it("derives permissions from provides", async () => {
    const bundle = await sapToBundle(FIXTURE_DIR);

    expect(bundle.manifest.permissions).toContain("projects:create");
    expect(bundle.manifest.permissions).toContain("tables:create");
    expect(bundle.manifest.permissions).toContain("schedules:create");
    expect(bundle.manifest.permissions).toContain("profiles:link");
    expect(bundle.manifest.permissions).toContain("blueprints:link");
  });

  it("throws on missing manifest.yaml", async () => {
    const dir = makeTempDir("no-manifest");
    await expect(sapToBundle(dir)).rejects.toThrow("Missing manifest.yaml");
  });

  it("throws on invalid manifest.yaml", async () => {
    const dir = makeTempDir("bad-manifest");
    const { writeFileSync } = await import("fs");
    writeFileSync(join(dir, "manifest.yaml"), "id: 123\nname: x\n");
    await expect(sapToBundle(dir)).rejects.toThrow("Invalid manifest.yaml");
  });

  it("throws on missing file references", async () => {
    const dir = makeTempDir("missing-refs");
    const { writeFileSync } = await import("fs");
    const yaml = await import("js-yaml");
    const manifest = {
      id: "test-app",
      name: "Test App",
      version: "1.0.0",
      description: "A test app with missing file references for validation",
      author: { name: "Test" },
      platform: { minVersion: "0.9.0" },
      marketplace: { category: "general", tags: [], difficulty: "beginner" },
      sidebar: { label: "Test", icon: "Box", route: "/app/test-app" },
      provides: { tables: ["missing-table"], profiles: [], blueprints: [], schedules: [], triggers: [], pages: [] },
    };
    writeFileSync(join(dir, "manifest.yaml"), yaml.dump(manifest));
    await expect(sapToBundle(dir)).rejects.toThrow("Missing files");
  });
});

describe("sapToBundleSync", () => {
  it("produces identical output to sapToBundle", async () => {
    const asyncResult = await sapToBundle(FIXTURE_DIR);
    const syncResult = sapToBundleSync(FIXTURE_DIR);

    expect(syncResult.manifest).toEqual(asyncResult.manifest);
    expect(syncResult.tables).toEqual(asyncResult.tables);
    expect(syncResult.schedules).toEqual(asyncResult.schedules);
    expect(syncResult.profiles).toEqual(asyncResult.profiles);
    expect(syncResult.blueprints).toEqual(asyncResult.blueprints);
    expect(syncResult.ui).toEqual(asyncResult.ui);
  });

  it("throws on missing manifest.yaml (sync)", () => {
    const dir = makeTempDir("no-manifest-sync");
    expect(() => sapToBundleSync(dir)).toThrow("Missing manifest.yaml");
  });
});

describe("bundleToSap", () => {
  it("exports the wealth-manager builtin to a .sap directory", async () => {
    const bundle = getAppBundle("wealth-manager")!;
    const dir = makeTempDir("export");
    await bundleToSap(bundle, dir);

    const { existsSync } = await import("fs");
    expect(existsSync(join(dir, "manifest.yaml"))).toBe(true);
    expect(existsSync(join(dir, "templates", "positions.yaml"))).toBe(true);
    expect(existsSync(join(dir, "templates", "transactions.yaml"))).toBe(true);
    expect(existsSync(join(dir, "templates", "watchlist.yaml"))).toBe(true);
    expect(existsSync(join(dir, "schedules", "daily-review.yaml"))).toBe(true);
    expect(existsSync(join(dir, "profiles", "wealth-manager.md"))).toBe(true);
    expect(existsSync(join(dir, "blueprints", "investment-research.yaml"))).toBe(true);
    expect(existsSync(join(dir, "README.md"))).toBe(true);
  });

  it("strips namespace prefixes in exported YAML", async () => {
    const bundle = getAppBundle("wealth-manager")!;
    const dir = makeTempDir("strip");
    await bundleToSap(bundle, dir);

    const { readFileSync } = await import("fs");
    const yaml = await import("js-yaml");
    const manifest = yaml.load(readFileSync(join(dir, "manifest.yaml"), "utf-8")) as Record<string, unknown>;
    const provides = manifest.provides as Record<string, string[]>;

    // Keys should NOT have the wealth-manager-- prefix
    expect(provides.tables).toContain("positions");
    expect(provides.tables).not.toContain("wealth-manager--positions");
    expect(provides.schedules).toContain("daily-review");
    expect(provides.profiles).toContain("wealth-manager");
  });
});

describe("round-trip: bundleToSap → sapToBundle", () => {
  it("round-trips the wealth-manager builtin", async () => {
    const original = getAppBundle("wealth-manager")!;
    const dir = makeTempDir("roundtrip");

    // Export
    await bundleToSap(original, dir);

    // Re-import
    const reimported = await sapToBundle(dir);

    // Core manifest fields match
    expect(reimported.manifest.id).toBe(original.manifest.id);
    expect(reimported.manifest.name).toBe(original.manifest.name);
    expect(reimported.manifest.version).toBe(original.manifest.version);
    expect(reimported.manifest.description).toBe(original.manifest.description);
    expect(reimported.manifest.category).toBe(original.manifest.category);

    // Same number of tables, schedules, profiles, blueprints
    expect(reimported.tables).toHaveLength(original.tables.length);
    expect(reimported.schedules).toHaveLength(original.schedules.length);
    expect(reimported.profiles).toHaveLength(original.profiles.length);
    expect(reimported.blueprints).toHaveLength(original.blueprints.length);

    // Table keys match after stripping namespace (round-trip preserves portable keys)
    const appId = original.manifest.id;
    const originalTableKeys = original.tables.map((t) => stripNamespace(appId, t.key)).sort();
    const reimportedTableKeys = reimported.tables.map((t) => stripNamespace(appId, t.key)).sort();
    expect(reimportedTableKeys).toEqual(originalTableKeys);

    // Table columns preserved
    const origPositions = original.tables.find((t) => t.key === "positions")!;
    const rePositions = reimported.tables.find((t) => t.key === "wealth-manager--positions")!;
    expect(rePositions.columns).toHaveLength(origPositions.columns.length);
  });
});

describe("checkPlatformCompat", () => {
  it("returns compatible for current platform version", () => {
    const manifest = { platform: { minVersion: "0.1.0" } } as SapManifest;
    const result = checkPlatformCompat(manifest);
    expect(result.compatible).toBe(true);
  });

  it("returns incompatible when minVersion exceeds platform", () => {
    const manifest = { platform: { minVersion: "99.0.0" } } as SapManifest;
    const result = checkPlatformCompat(manifest);
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("outside range");
  });

  it("returns incompatible when maxVersion is below platform", () => {
    const manifest = { platform: { minVersion: "0.1.0", maxVersion: "0.2.0" } } as SapManifest;
    const result = checkPlatformCompat(manifest);
    expect(result.compatible).toBe(false);
  });
});

describe("validateFileReferences", () => {
  it("returns valid for the wealth-manager fixture", () => {
    const yaml = require("js-yaml");
    const fs = require("fs");
    const raw = fs.readFileSync(join(FIXTURE_DIR, "manifest.yaml"), "utf-8");
    const manifest = yaml.load(raw) as SapManifest;
    const result = validateFileReferences(FIXTURE_DIR, manifest);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("reports missing files", () => {
    const manifest = {
      provides: {
        tables: ["nonexistent"],
        schedules: [],
        profiles: [],
        blueprints: [],
        triggers: [],
        pages: [],
      },
    } as unknown as SapManifest;
    const result = validateFileReferences(FIXTURE_DIR, manifest);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("templates/nonexistent.yaml");
  });
});
