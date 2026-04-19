import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scanBundleSection } from "../registry";

describe("scanBundleSection<T>", () => {
  it("returns [] when the section directory doesn't exist", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scan-"));
    expect(scanBundleSection({ rootDir: tmp, section: "profiles", parseFile: () => ({}) })).toEqual([]);
    fs.rmSync(tmp, { recursive: true });
  });

  it("skips non-yaml files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scan-"));
    fs.mkdirSync(path.join(tmp, "profiles"));
    fs.writeFileSync(path.join(tmp, "profiles", "readme.txt"), "ignore me");
    fs.writeFileSync(path.join(tmp, "profiles", "p.yaml"), "");
    const calls: string[] = [];
    scanBundleSection({ rootDir: tmp, section: "profiles", parseFile: (f) => { calls.push(path.basename(f)); return null; } });
    expect(calls).toEqual(["p.yaml"]);
    fs.rmSync(tmp, { recursive: true });
  });

  it("drops entries where parseFile returned null", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scan-"));
    fs.mkdirSync(path.join(tmp, "tables"));
    fs.writeFileSync(path.join(tmp, "tables", "a.yaml"), "");
    fs.writeFileSync(path.join(tmp, "tables", "b.yaml"), "");
    const out = scanBundleSection<number>({ rootDir: tmp, section: "tables", parseFile: (f) => path.basename(f) === "a.yaml" ? 1 : null });
    expect(out).toEqual([1]);
    fs.rmSync(tmp, { recursive: true });
  });

  it("swallows parseFile throws with a warning, continues other files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scan-"));
    fs.mkdirSync(path.join(tmp, "blueprints"));
    fs.writeFileSync(path.join(tmp, "blueprints", "ok.yaml"), "");
    fs.writeFileSync(path.join(tmp, "blueprints", "bad.yaml"), "");
    const out = scanBundleSection<string>({
      rootDir: tmp, section: "blueprints",
      parseFile: (f) => { if (path.basename(f) === "bad.yaml") throw new Error("boom"); return "ok"; },
    });
    expect(out).toEqual(["ok"]);
    fs.rmSync(tmp, { recursive: true });
  });
});
