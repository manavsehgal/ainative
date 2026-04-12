import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-catalog-filter-"));
  vi.resetModules();
  vi.stubEnv("STAGENT_DATA_DIR", tempDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tempDir, { recursive: true, force: true });
});

async function loadModules() {
  const service = await import("../service");
  return service;
}

describe("listAppCatalog filters", () => {
  it("returns all apps when no filter is provided", async () => {
    const { listAppCatalog } = await loadModules();
    const all = listAppCatalog();
    expect(all.length).toBeGreaterThan(0);
  });

  it("filters by category", async () => {
    const { listAppCatalog } = await loadModules();
    const all = listAppCatalog();
    const financeApps = all.filter((a) => a.category === "finance");

    const filtered = listAppCatalog({ category: "finance" });
    expect(filtered).toHaveLength(financeApps.length);
    expect(filtered.every((a) => a.category === "finance")).toBe(true);
  });

  it("returns empty array for non-existent category", async () => {
    const { listAppCatalog } = await loadModules();
    const filtered = listAppCatalog({ category: "nonexistent" });
    expect(filtered).toHaveLength(0);
  });

  it("filters by search query matching name", async () => {
    const { listAppCatalog } = await loadModules();
    const filtered = listAppCatalog({ q: "wealth" });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((a) => a.name.toLowerCase().includes("wealth"))).toBe(true);
  });

  it("filters by search query matching description", async () => {
    const { listAppCatalog } = await loadModules();
    const all = listAppCatalog();
    // Use a word from the first app's description
    const firstDesc = all[0].description.split(" ")[0];
    const filtered = listAppCatalog({ q: firstDesc });
    expect(filtered.length).toBeGreaterThan(0);
  });

  it("combines category and search filters", async () => {
    const { listAppCatalog } = await loadModules();
    const all = listAppCatalog();
    const financeApp = all.find((a) => a.category === "finance");

    if (financeApp) {
      const filtered = listAppCatalog({
        category: "finance",
        q: financeApp.name.split(" ")[0],
      });
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((a) => a.category === "finance")).toBe(true);
    }
  });

  it("search is case-insensitive", async () => {
    const { listAppCatalog } = await loadModules();
    const lower = listAppCatalog({ q: "wealth" });
    const upper = listAppCatalog({ q: "WEALTH" });
    expect(lower).toEqual(upper);
  });

  it("multi-word search requires all terms to match", async () => {
    const { listAppCatalog } = await loadModules();
    const filtered = listAppCatalog({ q: "wealth manager" });
    expect(filtered.length).toBeGreaterThan(0);

    const noMatch = listAppCatalog({ q: "wealth zzzznonexistent" });
    expect(noMatch).toHaveLength(0);
  });
});

describe("getAppCatalogEntry", () => {
  it("returns a catalog entry for a valid app id", async () => {
    const { getAppCatalogEntry } = await loadModules();
    const entry = getAppCatalogEntry("wealth-manager");

    expect(entry).not.toBeNull();
    expect(entry!.appId).toBe("wealth-manager");
    expect(entry!.name).toBe("Wealth Manager");
    expect(entry!.tableCount).toBeGreaterThan(0);
  });

  it("returns null for an unknown app id", async () => {
    const { getAppCatalogEntry } = await loadModules();
    const entry = getAppCatalogEntry("nonexistent-app");
    expect(entry).toBeNull();
  });

  it("reflects installed status when app is installed", async () => {
    const { getAppCatalogEntry, installApp } = await loadModules();

    // Before install
    const before = getAppCatalogEntry("wealth-manager");
    expect(before!.installed).toBe(false);

    // Install
    await installApp("wealth-manager");

    // After install
    const after = getAppCatalogEntry("wealth-manager");
    expect(after!.installed).toBe(true);
    expect(after!.installedStatus).toBe("ready");
  });
});
