// src/app/api/plugins/__tests__/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import { GET } from "../route";

let tmpDir: string;

describe("GET /api/plugins", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-plugins-"));
    fs.mkdirSync(path.join(tmpDir, "plugins", "demo"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "plugins", "demo", "plugin.yaml"),
      yaml.dump({ id: "demo", version: "0.1.0", apiVersion: "0.14", kind: "primitives-bundle" })
    );
    process.env.AINATIVE_DATA_DIR = tmpDir;
  });
  afterEach(() => {
    delete process.env.AINATIVE_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns the plugins list as JSON", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.plugins).toBeInstanceOf(Array);
    expect(body.plugins.find((p: { id: string }) => p.id === "demo")).toBeTruthy();
  });
});
