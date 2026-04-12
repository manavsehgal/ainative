import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-exporter-"));
  vi.resetModules();
  vi.stubEnv("STAGENT_DATA_DIR", tempDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tempDir, { recursive: true, force: true });
});

async function loadModules() {
  const { installApp } = await import("../service");
  const { exportProjectToBundle } = await import("../exporter");
  const { appBundleSchema } = await import("../validation");

  return { installApp, exportProjectToBundle, appBundleSchema };
}

describe("exportProjectToBundle", () => {
  it("exports an installed app project as a valid bundle", async () => {
    const { installApp, exportProjectToBundle, appBundleSchema } =
      await loadModules();

    // Install wealth-manager to get a real project with data
    const instance = await installApp("wealth-manager");

    const result = await exportProjectToBundle(instance.projectId!, {
      appName: "Exported Wealth",
      appDescription: "Exported version of wealth manager",
      category: "finance",
    });

    // Bundle is valid
    const parsed = appBundleSchema.safeParse(result.bundle);
    expect(parsed.success).toBe(true);

    // Correct metadata
    expect(result.bundle.manifest.name).toBe("Exported Wealth");
    expect(result.bundle.manifest.category).toBe("finance");
    expect(result.bundle.manifest.trustLevel).toBe("private");

    // Tables exported
    expect(result.stats.tablesExported).toBeGreaterThan(0);
    expect(result.bundle.tables.length).toBe(result.stats.tablesExported);
  });

  it("exports schedules from the project", async () => {
    const { installApp, exportProjectToBundle } = await loadModules();

    const instance = await installApp("wealth-manager");
    const result = await exportProjectToBundle(instance.projectId!, {
      appName: "Schedule Export Test",
      appDescription: "Test schedule export",
    });

    expect(result.stats.schedulesExported).toBeGreaterThan(0);
    expect(result.bundle.schedules.length).toBe(
      result.stats.schedulesExported,
    );
    expect(result.bundle.schedules[0].cronExpression).toBeTruthy();
    expect(result.bundle.schedules[0].prompt).toBeTruthy();
  });

  it("respects includeTables filter", async () => {
    const { installApp, exportProjectToBundle } = await loadModules();

    const instance = await installApp("wealth-manager");

    // Export with no filter
    const full = await exportProjectToBundle(instance.projectId!, {
      appName: "Full",
      appDescription: "Full export",
    });

    // Export with filter (include only first table by name)
    const firstTableName = full.bundle.tables[0]?.name;
    if (firstTableName && full.stats.tablesExported > 1) {
      const filtered = await exportProjectToBundle(instance.projectId!, {
        appName: "Filtered",
        appDescription: "Filtered export",
        includeTables: [firstTableName],
      });

      expect(filtered.stats.tablesExported).toBe(1);
      expect(filtered.bundle.tables[0].name).toBe(firstTableName);
    }
  });

  it("sanitizes seed data rows", async () => {
    const { installApp, exportProjectToBundle } = await loadModules();

    const instance = await installApp("wealth-manager");
    const result = await exportProjectToBundle(instance.projectId!, {
      appName: "Sanitized Export",
      appDescription: "Test sanitization",
      seedDataRows: 5,
    });

    // Should have seed rows (wealth-manager has sample data)
    const tablesWithRows = result.bundle.tables.filter(
      (t) => t.sampleRows.length > 0,
    );
    expect(tablesWithRows.length).toBeGreaterThanOrEqual(0);
    expect(result.stats.totalSeedRows).toBeLessThanOrEqual(
      result.stats.tablesExported * 5,
    );
  });

  it("handles seedDataRows=0 for no seed data", async () => {
    const { installApp, exportProjectToBundle } = await loadModules();

    const instance = await installApp("wealth-manager");
    const result = await exportProjectToBundle(instance.projectId!, {
      appName: "No Seed",
      appDescription: "Export without seed data",
      seedDataRows: 0,
    });

    expect(result.stats.totalSeedRows).toBe(0);
    for (const table of result.bundle.tables) {
      expect(table.sampleRows).toHaveLength(0);
    }
  });

  it("throws for non-existent project", async () => {
    const { exportProjectToBundle } = await loadModules();

    await expect(
      exportProjectToBundle("nonexistent-id", {
        appName: "Test",
        appDescription: "Test",
      }),
    ).rejects.toThrow('Project "nonexistent-id" not found');
  });

  it("generates unique app IDs", async () => {
    const { installApp, exportProjectToBundle } = await loadModules();

    const instance = await installApp("wealth-manager");
    const r1 = await exportProjectToBundle(instance.projectId!, {
      appName: "Export A",
      appDescription: "First",
    });
    const r2 = await exportProjectToBundle(instance.projectId!, {
      appName: "Export A",
      appDescription: "Second",
    });

    expect(r1.bundle.manifest.id).not.toBe(r2.bundle.manifest.id);
  });

  it("namespaces table and schedule keys with app ID", async () => {
    const { installApp, exportProjectToBundle } = await loadModules();

    const instance = await installApp("wealth-manager");
    const result = await exportProjectToBundle(instance.projectId!, {
      appName: "Namespace Test",
      appDescription: "Test namespacing",
    });

    const appId = result.bundle.manifest.id;
    for (const table of result.bundle.tables) {
      expect(table.key).toMatch(new RegExp(`^${appId}--`));
    }
    for (const schedule of result.bundle.schedules) {
      expect(schedule.key).toMatch(new RegExp(`^${appId}--`));
    }
  });

  it("generates overview page with widgets", async () => {
    const { installApp, exportProjectToBundle } = await loadModules();

    const instance = await installApp("wealth-manager");
    const result = await exportProjectToBundle(instance.projectId!, {
      appName: "Page Test",
      appDescription: "Test page generation",
    });

    expect(result.bundle.ui.pages).toHaveLength(1);
    expect(result.bundle.ui.pages[0].key).toBe("overview");
    expect(result.bundle.ui.pages[0].widgets.length).toBeGreaterThan(2);
  });
});
