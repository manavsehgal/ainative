import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";

import {
  getApp,
  invalidateAppsCache,
  writeAppManifest,
  type AppManifest,
} from "../registry";

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ainative-write-manifest-test-"));
}

function seedManifest(dir: string, manifest: Partial<AppManifest> & { id: string; name: string }): void {
  const appDir = path.join(dir, manifest.id);
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(
    path.join(appDir, "manifest.yaml"),
    yaml.dump(manifest),
    "utf-8"
  );
}

const BASE: AppManifest = {
  id: "habit-tracker",
  version: "0.1.0",
  name: "Habit Tracker",
  description: "Daily habits.",
  profiles: [],
  blueprints: [],
  tables: [],
  schedules: [],
};

describe("writeAppManifest", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = makeTmp();
    invalidateAppsCache();
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes a valid manifest atomically", () => {
    seedManifest(tmp, BASE);

    const updated: AppManifest = {
      ...BASE,
      view: { kit: "tracker", bindings: {}, hideManifestPane: false },
    };

    writeAppManifest("habit-tracker", updated, tmp);

    const reloaded = getApp("habit-tracker", tmp);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.manifest.view?.kit).toBe("tracker");
  });

  it("rejects a schema-violating manifest before touching disk", () => {
    seedManifest(tmp, BASE);

    const broken = {
      ...BASE,
      view: { kit: "not-a-real-kit", bindings: {}, hideManifestPane: false },
    } as unknown as AppManifest;

    expect(() => writeAppManifest("habit-tracker", broken, tmp)).toThrow();

    // Original on disk should be unchanged.
    const reloaded = getApp("habit-tracker", tmp);
    expect(reloaded?.manifest.view).toBeUndefined();
  });

  it("throws on missing app dir without leaving artifacts", () => {
    expect(() => writeAppManifest("ghost-app", BASE, tmp)).toThrow(
      /App not found/
    );
    expect(fs.existsSync(path.join(tmp, "ghost-app"))).toBe(false);
  });

  it("does not leave a .tmp file behind when rename fails", () => {
    seedManifest(tmp, BASE);

    // Mock renameSync to throw — simulates a mid-write failure.
    const renameSpy = vi
      .spyOn(fs, "renameSync")
      .mockImplementation(() => {
        throw new Error("Simulated rename failure");
      });

    const updated: AppManifest = {
      ...BASE,
      view: { kit: "ledger", bindings: {}, hideManifestPane: false },
    };

    expect(() => writeAppManifest("habit-tracker", updated, tmp)).toThrow(
      /Simulated rename failure/
    );

    renameSpy.mockRestore();

    // Manifest dir should NOT contain any leftover .tmp files.
    const entries = fs.readdirSync(path.join(tmp, "habit-tracker"));
    const tmpFiles = entries.filter((e) => e.includes(".tmp"));
    expect(tmpFiles).toEqual([]);

    // And the original manifest should still parse cleanly (untouched).
    const reloaded = getApp("habit-tracker", tmp);
    expect(reloaded?.manifest.view).toBeUndefined();
    expect(reloaded?.manifest.name).toBe("Habit Tracker");
  });

  it("invalidates the apps cache so subsequent reads see the new state", () => {
    seedManifest(tmp, BASE);

    const before = getApp("habit-tracker", tmp);
    expect(before?.manifest.view).toBeUndefined();

    const updated: AppManifest = {
      ...BASE,
      view: { kit: "workflow-hub", bindings: {}, hideManifestPane: false },
    };
    writeAppManifest("habit-tracker", updated, tmp);

    const after = getApp("habit-tracker", tmp);
    expect(after?.manifest.view?.kit).toBe("workflow-hub");
  });
});
