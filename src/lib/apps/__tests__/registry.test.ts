import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildPrimitivesSummary,
  deleteApp,
  deleteAppCascade,
  getApp,
  listApps,
  parseAppManifest,
} from "../registry";

function makeTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ainative-apps-test-"));
}

function writeManifest(dir: string, appId: string, body: string) {
  const appDir = path.join(dir, appId);
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, "manifest.yaml"), body, "utf-8");
  return appDir;
}

const WEALTH_MANIFEST = `
id: wealth-tracker
version: 0.1.0
name: Wealth Tracker
description: Personal portfolio check-ins.
persona: individual-investor
author: user
profiles:
  - id: wealth-tracker--portfolio-coach
    source: .claude/skills/wealth-tracker--portfolio-coach/
blueprints:
  - id: wealth-tracker--weekly-review
    source: ~/.ainative/blueprints/wealth-tracker--weekly-review.yaml
tables:
  - id: wealth-tracker--positions
    columns: [ticker, qty, cost_basis]
schedules:
  - id: wealth-tracker--monday-8am
    cron: "0 8 * * 1"
    runs: blueprint:wealth-tracker--weekly-review
permissions:
  preset: read-only
`;

describe("parseAppManifest", () => {
  it("parses a well-formed manifest", () => {
    const m = parseAppManifest(WEALTH_MANIFEST);
    expect(m).not.toBeNull();
    expect(m?.id).toBe("wealth-tracker");
    expect(m?.name).toBe("Wealth Tracker");
    expect(m?.profiles).toHaveLength(1);
    expect(m?.blueprints).toHaveLength(1);
    expect(m?.tables).toHaveLength(1);
    expect(m?.schedules).toHaveLength(1);
  });

  it("returns null on invalid yaml", () => {
    expect(parseAppManifest("::: not valid yaml :::")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parseAppManifest("name: only a name\n")).toBeNull();
  });

  it("tolerates missing optional sections", () => {
    const minimal = parseAppManifest("id: minimal\nname: Minimal\n");
    expect(minimal).not.toBeNull();
    expect(minimal?.profiles).toEqual([]);
    expect(minimal?.tables).toEqual([]);
  });
});

describe("buildPrimitivesSummary", () => {
  it("renders Calm Ops primitive summary with humanized cron", () => {
    const m = parseAppManifest(WEALTH_MANIFEST)!;
    const s = buildPrimitivesSummary(m);
    expect(s).toContain("Profile");
    expect(s).toContain("Blueprint");
    expect(s).toContain("1 table");
    expect(s).toContain("Monday");
    expect(s).toContain("8am");
    expect(s).toContain(" · ");
  });

  it("pluralizes tables correctly", () => {
    const m = parseAppManifest(`id: a\nname: A\ntables:\n  - id: a--t1\n  - id: a--t2\n`)!;
    expect(buildPrimitivesSummary(m)).toContain("2 tables");
  });

  it("handles empty composition", () => {
    const m = parseAppManifest("id: a\nname: A\n")!;
    expect(buildPrimitivesSummary(m)).toBe("");
  });

  it("omits schedule when no cron", () => {
    const m = parseAppManifest(
      `id: a\nname: A\nschedules:\n  - id: a--s1\n    runs: blueprint:x\n`
    )!;
    const s = buildPrimitivesSummary(m);
    expect(s).toContain("Schedule");
    expect(s).not.toContain("am");
  });
});

describe("listApps", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmp();
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns empty array when dir does not exist", () => {
    expect(listApps(path.join(tmp, "nope"))).toEqual([]);
  });

  it("returns empty array when dir is empty", () => {
    expect(listApps(tmp)).toEqual([]);
  });

  it("lists a single app manifest", () => {
    writeManifest(tmp, "wealth-tracker", WEALTH_MANIFEST);
    const apps = listApps(tmp);
    expect(apps).toHaveLength(1);
    expect(apps[0].id).toBe("wealth-tracker");
    expect(apps[0].profileCount).toBe(1);
    expect(apps[0].tableCount).toBe(1);
    expect(apps[0].scheduleCount).toBe(1);
  });

  it("lists multiple apps newest first", async () => {
    writeManifest(tmp, "older", "id: older\nname: Older\n");
    // stagger mtime
    await new Promise((r) => setTimeout(r, 10));
    writeManifest(tmp, "newer", "id: newer\nname: Newer\n");
    const apps = listApps(tmp);
    expect(apps.map((a) => a.id)).toEqual(["newer", "older"]);
  });

  it("skips directories without manifest.yaml", () => {
    fs.mkdirSync(path.join(tmp, "stray"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "stray", "README.md"), "# hi", "utf-8");
    expect(listApps(tmp)).toEqual([]);
  });

  it("skips manifests that fail schema validation", () => {
    writeManifest(tmp, "broken", "invalid: yaml: structure: [\n");
    expect(listApps(tmp)).toEqual([]);
  });

  it("collects all files under the app dir", () => {
    const dir = writeManifest(tmp, "wealth-tracker", WEALTH_MANIFEST);
    fs.mkdirSync(path.join(dir, "seed"));
    fs.writeFileSync(path.join(dir, "seed", "positions.csv"), "ticker\n", "utf-8");
    fs.writeFileSync(path.join(dir, "README.md"), "# hi", "utf-8");
    const [app] = listApps(tmp);
    expect(app.files.length).toBeGreaterThanOrEqual(3);
    expect(app.files.some((f) => f.endsWith("positions.csv"))).toBe(true);
  });
});

describe("getApp", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmp(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it("returns detail including manifest", () => {
    writeManifest(tmp, "wealth-tracker", WEALTH_MANIFEST);
    const detail = getApp("wealth-tracker", tmp);
    expect(detail).not.toBeNull();
    expect(detail?.manifest.id).toBe("wealth-tracker");
    expect(detail?.manifest.schedules[0].cron).toBe("0 8 * * 1");
  });

  it("returns null for missing app", () => {
    expect(getApp("nope", tmp)).toBeNull();
  });
});

describe("deleteApp", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmp(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it("removes the app directory recursively", () => {
    const dir = writeManifest(tmp, "wealth-tracker", WEALTH_MANIFEST);
    fs.writeFileSync(path.join(dir, "README.md"), "# hi", "utf-8");
    expect(deleteApp("wealth-tracker", tmp)).toBe(true);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it("returns false for unknown app id without throwing", () => {
    expect(deleteApp("nope", tmp)).toBe(false);
  });

  it("refuses a path-traversal id", () => {
    // Make a sibling dir OUTSIDE appsDir to confirm the guard
    const appsDir = path.join(tmp, "apps");
    fs.mkdirSync(appsDir, { recursive: true });
    const sibling = path.join(tmp, "other");
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(sibling, "secret.txt"), "keep me", "utf-8");
    expect(deleteApp("../other", appsDir)).toBe(false);
    expect(fs.existsSync(path.join(sibling, "secret.txt"))).toBe(true);
  });
});

describe("deleteAppCascade", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmp(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it("removes the manifest dir and reports project=false when no DB project exists", async () => {
    writeManifest(tmp, "wealth-tracker", WEALTH_MANIFEST);
    const result = await deleteAppCascade("wealth-tracker", { appsDir: tmp });
    expect(result.filesRemoved).toBe(true);
    expect(result.projectRemoved).toBe(false);
    expect(fs.existsSync(path.join(tmp, "wealth-tracker"))).toBe(false);
  });

  it("returns filesRemoved=false projectRemoved=false for an unknown app id", async () => {
    const result = await deleteAppCascade("does-not-exist", { appsDir: tmp });
    expect(result.filesRemoved).toBe(false);
    expect(result.projectRemoved).toBe(false);
  });

  it("refuses path-traversal ids and removes nothing", async () => {
    const appsDir = path.join(tmp, "apps");
    fs.mkdirSync(appsDir, { recursive: true });
    const sibling = path.join(tmp, "other");
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(sibling, "secret.txt"), "keep me", "utf-8");
    const result = await deleteAppCascade("../other", { appsDir });
    expect(result.filesRemoved).toBe(false);
    expect(fs.existsSync(path.join(sibling, "secret.txt"))).toBe(true);
  });

  it("calls deleteProjectCascade with the app id (verified via injected fn)", async () => {
    writeManifest(tmp, "wealth-tracker", WEALTH_MANIFEST);
    const calls: string[] = [];
    const result = await deleteAppCascade("wealth-tracker", {
      appsDir: tmp,
      deleteProjectFn: (id) => { calls.push(id); return true; },
    });
    expect(calls).toEqual(["wealth-tracker"]);
    expect(result.projectRemoved).toBe(true);
    expect(result.filesRemoved).toBe(true);
  });

  it("reports projectRemoved=true filesRemoved=false when only the DB row exists (orphaned)", async () => {
    // No manifest dir written — only the injected DB cascade succeeds
    const result = await deleteAppCascade("orphaned-row", {
      appsDir: tmp,
      deleteProjectFn: () => true,
    });
    expect(result.projectRemoved).toBe(true);
    expect(result.filesRemoved).toBe(false);
  });
});
