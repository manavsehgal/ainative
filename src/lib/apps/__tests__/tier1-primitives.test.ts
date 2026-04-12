import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-tier1-"));
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

describe("tier1 bootstrap handlers", () => {
  it("bootstraps triggers into user_table_triggers", async () => {
    const { db, userTableTriggers, installApp, getAppInstance } = await loadModules();

    const result = await installApp("wealth-manager");
    expect(result.status).toBe("ready");

    // Check that trigger was created
    const triggers = db.select().from(userTableTriggers).all();
    const appTriggers = triggers.filter((t) =>
      result.resourceMap.triggers
        ? Object.values(result.resourceMap.triggers).includes(t.id)
        : false
    );
    expect(appTriggers).toHaveLength(1);
    expect(appTriggers[0].name).toBe("Position Price Alert");
    expect(appTriggers[0].triggerEvent).toBe("row_updated");
    expect(appTriggers[0].status).toBe("paused");
  });

  it("bootstraps notifications into notifications table", async () => {
    const { db, notifications, installApp } = await loadModules();

    const result = await installApp("wealth-manager");
    expect(result.resourceMap.notifications).toBeDefined();

    const notifIds = Object.values(result.resourceMap.notifications ?? {});
    expect(notifIds).toHaveLength(1);

    const notifRows = db.select().from(notifications).all();
    const appNotif = notifRows.find((n) => notifIds.includes(n.id));
    expect(appNotif).toBeDefined();
    expect(appNotif!.title).toBe("Daily Review Ready");
  });

  it("bootstraps saved views into user_table_views", async () => {
    const { db, userTableViews, installApp } = await loadModules();

    const result = await installApp("wealth-manager");
    expect(result.resourceMap.savedViews).toBeDefined();

    const viewIds = Object.values(result.resourceMap.savedViews ?? {});
    expect(viewIds).toHaveLength(1);

    const views = db.select().from(userTableViews).all();
    const appView = views.find((v) => viewIds.includes(v.id));
    expect(appView).toBeDefined();
    expect(appView!.name).toBe("High Conviction");
  });

  it("tracks documents in resourceMap as declarations", async () => {
    const { installApp } = await loadModules();

    const result = await installApp("wealth-manager");
    expect(result.resourceMap.documents).toBeDefined();
    expect(result.resourceMap.documents!["portfolio-reports"]).toBe(
      "declared:portfolio-reports"
    );
  });

  it("tracks envVars in resourceMap as declarations", async () => {
    const { installApp } = await loadModules();

    const result = await installApp("wealth-manager");
    expect(result.resourceMap.envVars).toBeDefined();
    expect(result.resourceMap.envVars!["MARKET_DATA_API_KEY"]).toBe(
      "declared:MARKET_DATA_API_KEY"
    );
  });

  it("bootstrap is idempotent — re-running does not create duplicates", async () => {
    const { db, userTableTriggers, userTableViews, installApp, bootstrapApp } =
      await loadModules();

    const result = await installApp("wealth-manager");
    const triggersBefore = db.select().from(userTableTriggers).all().length;
    const viewsBefore = db.select().from(userTableViews).all().length;

    // Re-bootstrap
    await bootstrapApp("wealth-manager");

    const triggersAfter = db.select().from(userTableTriggers).all().length;
    const viewsAfter = db.select().from(userTableViews).all().length;

    expect(triggersAfter).toBe(triggersBefore);
    expect(viewsAfter).toBe(viewsBefore);
  });

  it("growth-module also bootstraps all 5 tier1 primitives", async () => {
    const { installApp } = await loadModules();

    const result = await installApp("growth-module");
    expect(result.status).toBe("ready");

    expect(result.resourceMap.triggers).toBeDefined();
    expect(Object.keys(result.resourceMap.triggers!)).toHaveLength(1);

    expect(result.resourceMap.notifications).toBeDefined();
    expect(Object.keys(result.resourceMap.notifications!)).toHaveLength(1);

    expect(result.resourceMap.savedViews).toBeDefined();
    expect(Object.keys(result.resourceMap.savedViews!)).toHaveLength(1);

    expect(result.resourceMap.documents).toBeDefined();
    expect(result.resourceMap.envVars).toBeDefined();
  });
});

describe("tier1 validation schemas", () => {
  it("existing bundles without tier1 fields still validate", async () => {
    const { appBundleSchema } = await import("../validation");
    const { getAppBundle } = await import("../registry");

    // Remove tier1 fields to simulate legacy bundle
    const bundle = getAppBundle("wealth-manager")!;
    const legacy = {
      manifest: bundle.manifest,
      setupChecklist: bundle.setupChecklist,
      profiles: bundle.profiles,
      blueprints: bundle.blueprints,
      tables: bundle.tables,
      schedules: bundle.schedules,
      ui: bundle.ui,
    };

    const result = appBundleSchema.safeParse(legacy);
    expect(result.success).toBe(true);
  });

  it("full bundle with tier1 fields validates", async () => {
    const { appBundleSchema } = await import("../validation");
    const { getAppBundle } = await import("../registry");

    const bundle = getAppBundle("wealth-manager")!;
    const result = appBundleSchema.safeParse(bundle);
    expect(result.success).toBe(true);
  });
});
