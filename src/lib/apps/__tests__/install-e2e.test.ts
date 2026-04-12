import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-install-e2e-"));
  vi.resetModules();
  vi.stubEnv("STAGENT_DATA_DIR", tempDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tempDir, { recursive: true, force: true });
});

async function loadModules() {
  const { db } = await import("@/lib/db");
  const schema = await import("@/lib/db/schema");
  const service = await import("../service");
  const registry = await import("../registry");

  return { db, ...schema, ...service, ...registry };
}

describe("app install end-to-end", () => {
  it("install → bootstrap → ready roundtrip for a built-in bundle", async () => {
    const { db, appInstances, projects, schedules, installApp, getAppInstance, getAppBundle } =
      await loadModules();

    const bundle = getAppBundle("wealth-manager");
    expect(bundle).toBeDefined();

    // Install the bundle
    const result = await installApp("wealth-manager");

    // Instance row exists with ready status
    expect(result.status).toBe("ready");
    expect(result.appId).toBe("wealth-manager");
    expect(result.manifest.name).toBe("Wealth Manager");

    // DB row matches
    const dbRow = db
      .select()
      .from(appInstances)
      .all()
      .find((r) => r.appId === "wealth-manager");
    expect(dbRow).toBeDefined();
    expect(dbRow!.status).toBe("ready");

    // Project was created
    const projectRows = db.select().from(projects).all();
    const linkedProject = projectRows.find((p) => p.id === result.projectId);
    expect(linkedProject).toBeDefined();
    expect(linkedProject!.name).toBe("Wealth Manager");

    // Schedules were provisioned (wealth-manager has schedule templates)
    if (bundle!.schedules.length > 0) {
      const scheduleRows = db
        .select()
        .from(schedules)
        .all()
        .filter((s) => s.projectId === result.projectId);
      expect(scheduleRows.length).toBeGreaterThanOrEqual(bundle!.schedules.length);
    }

    // Resource map tracks created resources
    expect(Object.keys(result.resourceMap.tables).length).toBe(bundle!.tables.length);
    expect(Object.keys(result.resourceMap.schedules).length).toBe(bundle!.schedules.length);

    // Verify via getAppInstance
    const fetched = getAppInstance("wealth-manager");
    expect(fetched).toBeDefined();
    expect(fetched!.status).toBe("ready");
  });

  it("uninstall cleans up instance and schedules", async () => {
    const { db, appInstances, schedules, installApp, uninstallApp, getAppInstance } =
      await loadModules();

    const result = await installApp("wealth-manager");
    const scheduleIds = Object.values(result.resourceMap.schedules);

    // Pre-condition: resources exist
    expect(
      db.select().from(appInstances).all().filter((r) => r.appId === "wealth-manager")
    ).toHaveLength(1);

    if (scheduleIds.length > 0) {
      expect(
        db.select().from(schedules).all().filter((s) => scheduleIds.includes(s.id))
      ).toHaveLength(scheduleIds.length);
    }

    // Uninstall
    uninstallApp("wealth-manager");

    // Instance row gone
    expect(getAppInstance("wealth-manager")).toBeNull();
    expect(
      db.select().from(appInstances).all().filter((r) => r.appId === "wealth-manager")
    ).toHaveLength(0);

    // Schedules cleaned up
    if (scheduleIds.length > 0) {
      expect(
        db.select().from(schedules).all().filter((s) => scheduleIds.includes(s.id))
      ).toHaveLength(0);
    }
  });

  it("installApp returns existing instance on duplicate (no race error)", async () => {
    const { installApp } = await loadModules();

    const first = await installApp("wealth-manager");
    const second = await installApp("wealth-manager");

    // Same instance returned, no error thrown
    expect(second.id).toBe(first.id);
    expect(second.appId).toBe("wealth-manager");
    expect(second.status).toBe("ready");
  });

  it("hydrateInstance returns corrupt status for invalid manifest JSON", async () => {
    const { db, appInstances, installApp, getAppInstance } = await loadModules();

    await installApp("wealth-manager");

    // Manually corrupt the manifest JSON in the DB
    db.update(appInstances)
      .set({ manifestJson: "<<<not json>>>" })
      .where((await import("drizzle-orm")).eq(appInstances.appId, "wealth-manager"))
      .run();

    // Fetch — should not throw, should return corrupt status
    const instance = getAppInstance("wealth-manager");
    expect(instance).not.toBeNull();
    expect(instance!.status).toBe("corrupt");
    expect(instance!.bootstrapError).toContain("corrupt");
    expect(instance!.manifest.name).toBe("Unknown App");
  });

  it("hydrateInstance returns corrupt status for invalid UI schema JSON", async () => {
    const { db, appInstances, installApp, getAppInstance } = await loadModules();

    await installApp("wealth-manager");

    // Corrupt only the UI schema
    db.update(appInstances)
      .set({ uiSchemaJson: "{broken" })
      .where((await import("drizzle-orm")).eq(appInstances.appId, "wealth-manager"))
      .run();

    const instance = getAppInstance("wealth-manager");
    expect(instance).not.toBeNull();
    expect(instance!.status).toBe("corrupt");
    expect(instance!.ui.pages).toEqual([]);
  });
});
