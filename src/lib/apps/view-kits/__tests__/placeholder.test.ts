import { describe, it, expect } from "vitest";
import { placeholderKit } from "../kits/placeholder";
import type { AppDetail, AppManifest } from "@/lib/apps/registry";
import type { RuntimeState } from "../types";

function makeApp(overrides: Partial<AppDetail> = {}): AppDetail {
  const manifest = {
    id: "demo-app",
    name: "Demo",
    description: "Demo description",
    profiles: [],
    blueprints: [],
    tables: [],
    schedules: [],
  } as unknown as AppManifest;

  return {
    id: "demo-app",
    name: "Demo",
    description: "Demo description",
    rootDir: "/tmp/demo",
    primitivesSummary: "",
    profileCount: 0,
    blueprintCount: 0,
    tableCount: 0,
    scheduleCount: 0,
    scheduleHuman: null,
    createdAt: 0,
    files: [],
    manifest,
    ...overrides,
  };
}

describe("placeholderKit", () => {
  it("builds a ViewModel with header + manifest footer for an empty manifest", () => {
    const app = makeApp();
    const proj = placeholderKit.resolve({ manifest: app.manifest, columns: [] });
    const runtime: RuntimeState = { app };

    const model = placeholderKit.buildModel(proj, runtime);

    expect(model.header.title).toBe("Demo");
    expect(model.header.description).toBe("Demo description");
    expect(model.footer).toBeDefined();
    expect(model.footer?.appId).toBe("demo-app");
    expect(model.footer?.body).toBeTruthy();
  });

  it("surfaces composition data in the manifest pane for a full manifest", () => {
    const manifest = {
      id: "habit-tracker",
      name: "Habit Tracker",
      description: "Tracks habits",
      profiles: [{ id: "habit-tracker--coach" }],
      blueprints: [{ id: "habit-tracker--review" }],
      tables: [{ id: "tbl-1", columns: ["habit"] }],
      schedules: [{ id: "sch-1", cron: "0 20 * * *" }],
    } as unknown as AppManifest;

    const app = makeApp({
      id: "habit-tracker",
      name: "Habit Tracker",
      description: "Tracks habits",
      manifest,
      profileCount: 1,
      blueprintCount: 1,
      tableCount: 1,
      scheduleCount: 1,
      files: ["/tmp/habit-tracker/manifest.yaml"],
    });
    const proj = placeholderKit.resolve({ manifest, columns: [] });
    const runtime: RuntimeState = {
      app,
      recentTaskCount: 5,
      scheduleCadence: "daily 8pm",
    };

    const model = placeholderKit.buildModel(proj, runtime);

    expect(model.header.title).toBe("Habit Tracker");
    expect(model.footer).toBeDefined();
    expect(model.footer?.appName).toBe("Habit Tracker");
    expect(model.footer?.manifestYaml).toContain("habit-tracker");
    expect(model.footer?.manifestYaml).toContain("profiles:");
    // Body is a ReactNode (composition cards + files list); we only assert it exists.
    expect(model.footer?.body).toBeTruthy();
  });
});
