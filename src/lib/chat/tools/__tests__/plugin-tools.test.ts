import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import { pluginTools } from "../plugin-tools";
import type { ToolContext } from "../helpers";

let tmpDir: string;

function writePlugin(id: string) {
  const dir = path.join(tmpDir, "plugins", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "plugin.yaml"),
    yaml.dump({
      id,
      version: "0.1.0",
      apiVersion: "0.14",
      kind: "primitives-bundle",
    })
  );
}

describe("plugin chat tools", () => {
  let ctx: ToolContext;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-tools-"));
    process.env.AINATIVE_DATA_DIR = tmpDir;
    ctx = {};
    // Make sure the registry cache is clean before each test so that the
    // env-var change above takes effect for the very first scan.
    const { reloadPlugins } = await import("@/lib/plugins/registry");
    await reloadPlugins();
  });

  afterEach(async () => {
    delete process.env.AINATIVE_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const { reloadPlugins } = await import("@/lib/plugins/registry");
    await reloadPlugins();
  });

  it("reload_plugins rescans and returns summary", async () => {
    writePlugin("a");
    const tools = pluginTools(ctx);
    const reload = tools.find((t) => t.name === "reload_plugins");
    expect(reload).toBeTruthy();
    const result = await reload!.handler({});
    expect(result.content?.[0]?.text).toMatch(/"id":\s*"a"/);
    expect(result.content?.[0]?.text).toMatch(/loaded/);
  });

  it("list_plugins returns currently loaded plugins", async () => {
    writePlugin("a");
    const tools = pluginTools(ctx);
    await tools.find((t) => t.name === "reload_plugins")!.handler({});
    const list = tools.find((t) => t.name === "list_plugins");
    const result = await list!.handler({});
    expect(result.content?.[0]?.text).toMatch(/"id":\s*"a"/);
  });

  it("reload_plugin reloads a single plugin", async () => {
    writePlugin("a");
    const tools = pluginTools(ctx);
    await tools.find((t) => t.name === "reload_plugins")!.handler({});
    const result = await tools
      .find((t) => t.name === "reload_plugin")!
      .handler({ id: "a" });
    expect(result.content?.[0]?.text).toMatch(/"id":\s*"a"/);
  });
});
