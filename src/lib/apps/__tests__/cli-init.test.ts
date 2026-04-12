import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as yaml from "js-yaml";
import { initSapDirectory } from "../cli/init";
import { validateSapDirectory } from "../cli/validate";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-cli-init-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("initSapDirectory", () => {
  it("creates a .sap directory with all subdirectories", () => {
    const sapDir = initSapDirectory(tempDir, { name: "My App" });

    expect(existsSync(sapDir)).toBe(true);
    expect(existsSync(join(sapDir, "manifest.yaml"))).toBe(true);
    expect(existsSync(join(sapDir, "README.md"))).toBe(true);
    expect(existsSync(join(sapDir, "templates"))).toBe(true);
    expect(existsSync(join(sapDir, "schedules"))).toBe(true);
    expect(existsSync(join(sapDir, "profiles"))).toBe(true);
    expect(existsSync(join(sapDir, "blueprints"))).toBe(true);
    expect(existsSync(join(sapDir, "seed-data"))).toBe(true);
  });

  it("generates correct manifest from options", () => {
    const sapDir = initSapDirectory(tempDir, {
      name: "Wealth Tracker",
      category: "finance",
      description: "Track your portfolio",
    });

    const manifest = yaml.load(
      readFileSync(join(sapDir, "manifest.yaml"), "utf-8"),
    ) as Record<string, unknown>;

    expect(manifest.id).toBe("wealth-tracker");
    expect(manifest.name).toBe("Wealth Tracker");
    expect((manifest.marketplace as Record<string, unknown>).category).toBe("finance");
    expect(manifest.description).toBe("Track your portfolio");
  });

  it("uses custom ID when provided", () => {
    const sapDir = initSapDirectory(tempDir, {
      name: "My App",
      id: "custom-id",
    });

    const manifest = yaml.load(
      readFileSync(join(sapDir, "manifest.yaml"), "utf-8"),
    ) as Record<string, unknown>;

    expect(manifest.id).toBe("custom-id");
    expect(sapDir).toContain("custom-id.sap");
  });

  it("generated directory passes validation", () => {
    const sapDir = initSapDirectory(tempDir, { name: "Valid App" });
    const result = validateSapDirectory(sapDir);
    expect(result.valid).toBe(true);
  });

  it("slugifies name for directory and ID", () => {
    const sapDir = initSapDirectory(tempDir, {
      name: "My Cool App 2.0!",
    });

    expect(sapDir).toContain("my-cool-app-2-0.sap");
  });
});
