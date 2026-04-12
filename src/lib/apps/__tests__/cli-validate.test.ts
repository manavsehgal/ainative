import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as yaml from "js-yaml";
import { validateSapDirectory } from "../cli/validate";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-cli-validate-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeManifest(dir: string, manifest: Record<string, unknown>) {
  writeFileSync(join(dir, "manifest.yaml"), yaml.dump(manifest));
}

function validManifest(): Record<string, unknown> {
  return {
    id: "test-app",
    name: "Test App",
    version: "1.0.0",
    description: "A test app",
    author: { name: "Test" },
    platform: { minVersion: "0.9.0" },
    marketplace: {
      category: "general",
      tags: [],
      difficulty: "beginner",
      pricing: "free",
    },
    sidebar: {
      label: "Test",
      icon: "Rocket",
      route: "/app/test-app",
    },
    provides: {
      profiles: [],
      blueprints: [],
      tables: [],
      schedules: [],
      triggers: [],
      pages: [],
    },
  };
}

describe("validateSapDirectory", () => {
  it("passes with a valid manifest", () => {
    writeManifest(tempDir, validManifest());
    const result = validateSapDirectory(tempDir);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when manifest.yaml is missing", () => {
    const result = validateSapDirectory(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("manifest.yaml not found");
  });

  it("fails with invalid YAML", () => {
    writeFileSync(join(tempDir, "manifest.yaml"), ":\n  - :\n  bad: [unterminated");
    const result = validateSapDirectory(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("reports schema validation errors", () => {
    writeManifest(tempDir, { id: "test" }); // Missing required fields
    const result = validateSapDirectory(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("warns about missing README", () => {
    writeManifest(tempDir, validManifest());
    const result = validateSapDirectory(tempDir);
    expect(result.warnings.some((w) => w.includes("README.md"))).toBe(true);
  });

  it("passes with README present", () => {
    writeManifest(tempDir, validManifest());
    writeFileSync(join(tempDir, "README.md"), "# Test");
    const result = validateSapDirectory(tempDir);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("README.md"))).toBe(false);
  });

  it("checks provides references against files", () => {
    const manifest = validManifest();
    (manifest.provides as Record<string, string[]>).tables = ["missing-table"];
    writeManifest(tempDir, manifest);

    const result = validateSapDirectory(tempDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("missing-table"))).toBe(true);
  });

  it("passes when provides references exist as files", () => {
    const manifest = validManifest();
    (manifest.provides as Record<string, string[]>).tables = ["users"];
    writeManifest(tempDir, manifest);

    mkdirSync(join(tempDir, "templates"), { recursive: true });
    writeFileSync(
      join(tempDir, "templates", "users.yaml"),
      yaml.dump({ name: "Users", columns: [{ name: "id", type: "text" }] }),
    );

    const result = validateSapDirectory(tempDir);
    expect(result.errors.filter((e) => e.includes("users"))).toHaveLength(0);
  });

  it("validates template YAML files for columns", () => {
    writeManifest(tempDir, validManifest());
    mkdirSync(join(tempDir, "templates"), { recursive: true });
    writeFileSync(
      join(tempDir, "templates", "bad.yaml"),
      yaml.dump({ name: "Bad Table" }), // missing columns
    );

    const result = validateSapDirectory(tempDir);
    expect(result.warnings.some((w) => w.includes("columns"))).toBe(true);
  });
});
