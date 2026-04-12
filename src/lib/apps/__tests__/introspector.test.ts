import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-introspector-"));
  vi.resetModules();
  vi.stubEnv("STAGENT_DATA_DIR", tempDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tempDir, { recursive: true, force: true });
});

async function loadModules() {
  const { db } = await import("@/lib/db");
  const { projects, schedules, documents } = await import("@/lib/db/schema");
  const { introspectProject } = await import("../introspector");
  const { installApp } = await import("../service");

  return { db, projects, schedules, documents, introspectProject, installApp };
}

describe("introspectProject", () => {
  it("throws for non-existent project", async () => {
    const { introspectProject } = await loadModules();
    await expect(introspectProject("nonexistent")).rejects.toThrow(
      'Project "nonexistent" not found',
    );
  });

  it("returns fingerprint for installed app project", async () => {
    const { introspectProject, installApp } = await loadModules();

    // Install wealth-manager to get a real project
    const instance = await installApp("wealth-manager");
    expect(instance.projectId).toBeTruthy();

    const fingerprint = await introspectProject(instance.projectId!);

    expect(fingerprint.projectId).toBe(instance.projectId);
    expect(fingerprint.projectName).toBe("Wealth Manager");
    expect(fingerprint.tables.length).toBeGreaterThan(0);
    expect(fingerprint.tables[0].columns.length).toBeGreaterThan(0);
    expect(fingerprint.tables[0].rowCount).toBeGreaterThanOrEqual(0);
  });

  it("returns schedules for project", async () => {
    const { introspectProject, installApp } = await loadModules();

    const instance = await installApp("wealth-manager");
    const fingerprint = await introspectProject(instance.projectId!);

    // Wealth manager has schedules
    expect(fingerprint.schedules.length).toBeGreaterThan(0);
    expect(fingerprint.schedules[0]).toHaveProperty("cronExpression");
    expect(fingerprint.schedules[0]).toHaveProperty("status");
  });

  it("returns empty arrays for a bare project", async () => {
    const { db, projects, introspectProject } = await loadModules();

    const projectId = crypto.randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: "Empty Test",
      description: "A bare project",
      workingDirectory: null,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fingerprint = await introspectProject(projectId);

    expect(fingerprint.projectName).toBe("Empty Test");
    expect(fingerprint.tables).toHaveLength(0);
    expect(fingerprint.schedules).toHaveLength(0);
    expect(fingerprint.documents).toHaveLength(0);
  });
});
