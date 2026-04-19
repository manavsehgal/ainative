// src/lib/plugins/__tests__/install-path-parity.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import { reloadPlugins } from "../registry";

function setupDataDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, "plugins", "demo"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "plugins", "demo", "plugin.yaml"),
    yaml.dump({ id: "demo", version: "0.1.0", apiVersion: "0.14", kind: "primitives-bundle" })
  );
  return dir;
}

describe("install-path parity", () => {
  let npxLikeDir: string;
  let cloneLikeDir: string;

  beforeEach(() => {
    npxLikeDir = setupDataDir("npx-data-");      // simulates ~/.ainative-folder/
    cloneLikeDir = setupDataDir("clone-data-");  // simulates ~/.ainative/
  });

  afterEach(() => {
    fs.rmSync(npxLikeDir, { recursive: true, force: true });
    fs.rmSync(cloneLikeDir, { recursive: true, force: true });
    delete process.env.AINATIVE_DATA_DIR;
  });

  it("loader output is identical (modulo paths) across both data dirs", () => {
    process.env.AINATIVE_DATA_DIR = npxLikeDir;
    const npxResult = reloadPlugins().map((p) => ({
      ...p, rootDir: "<dir>",
    }));

    process.env.AINATIVE_DATA_DIR = cloneLikeDir;
    const cloneResult = reloadPlugins().map((p) => ({
      ...p, rootDir: "<dir>",
    }));

    expect(npxResult).toEqual(cloneResult);
  });
});
