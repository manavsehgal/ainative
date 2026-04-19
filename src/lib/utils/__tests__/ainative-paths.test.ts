import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAinativePluginsDir, getAinativePluginExamplesDir } from "../ainative-paths";
import path from "node:path";

describe("plugin path helpers", () => {
  let originalDataDir: string | undefined;
  beforeEach(() => {
    originalDataDir = process.env.AINATIVE_DATA_DIR;
    process.env.AINATIVE_DATA_DIR = "/tmp/test-ainative";
  });
  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.AINATIVE_DATA_DIR;
    else process.env.AINATIVE_DATA_DIR = originalDataDir;
  });

  it("getAinativePluginsDir returns <dataDir>/plugins", () => {
    expect(getAinativePluginsDir()).toBe(path.join("/tmp/test-ainative", "plugins"));
  });

  it("getAinativePluginExamplesDir resolves under the package src tree", () => {
    const dir = getAinativePluginExamplesDir();
    expect(dir).toMatch(/src[\\/]+lib[\\/]+plugins[\\/]+examples$/);
  });
});
