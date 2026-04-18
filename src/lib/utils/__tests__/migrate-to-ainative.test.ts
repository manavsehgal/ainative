import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { migrateFromStagent } from "../migrate-to-ainative";

function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), "ainative-migrate-test-"));
}

describe("migrateFromStagent", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = makeTempHome();
    vi.stubEnv("HOME", tempHome);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("renames ~/.stagent/ to ~/.ainative/ when only old dir exists", async () => {
    const oldDir = join(tempHome, ".stagent");
    const newDir = join(tempHome, ".ainative");
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(join(oldDir, "marker.txt"), "hello");

    const report = await migrateFromStagent({ home: tempHome });

    expect(existsSync(oldDir)).toBe(false);
    expect(existsSync(newDir)).toBe(true);
    expect(readFileSync(join(newDir, "marker.txt"), "utf8")).toBe("hello");
    expect(report.dirMigrated).toBe(true);
  });

  it("is idempotent — second call is a no-op", async () => {
    const oldDir = join(tempHome, ".stagent");
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(join(oldDir, "marker.txt"), "hello");

    await migrateFromStagent({ home: tempHome });
    const secondReport = await migrateFromStagent({ home: tempHome });

    expect(secondReport.dirMigrated).toBe(false);
  });

  it("renames stagent.db, stagent.db-shm, stagent.db-wal inside moved dir", async () => {
    const oldDir = join(tempHome, ".stagent");
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(join(oldDir, "stagent.db"), "db");
    writeFileSync(join(oldDir, "stagent.db-shm"), "shm");
    writeFileSync(join(oldDir, "stagent.db-wal"), "wal");

    const report = await migrateFromStagent({ home: tempHome });

    const newDir = join(tempHome, ".ainative");
    expect(existsSync(join(newDir, "ainative.db"))).toBe(true);
    expect(existsSync(join(newDir, "ainative.db-shm"))).toBe(true);
    expect(existsSync(join(newDir, "ainative.db-wal"))).toBe(true);
    expect(report.dbFilesRenamed).toBe(3);
  });

  it("rewrites mcp__stagent__ prefix in agent_profiles.allowed_tools", async () => {
    const oldDir = join(tempHome, ".stagent");
    mkdirSync(oldDir, { recursive: true });
    const dbPath = join(oldDir, "stagent.db");
    const db = new Database(dbPath);
    db.exec(`CREATE TABLE agent_profiles (id TEXT PRIMARY KEY, allowed_tools TEXT)`);
    db.prepare("INSERT INTO agent_profiles VALUES (?, ?)").run(
      "test",
      JSON.stringify(["mcp__stagent__create_task", "mcp__stagent__list_projects"]),
    );
    db.close();

    await migrateFromStagent({ home: tempHome });

    const newDb = new Database(join(tempHome, ".ainative", "ainative.db"));
    const row = newDb.prepare("SELECT allowed_tools FROM agent_profiles WHERE id = ?").get("test") as { allowed_tools: string };
    newDb.close();

    expect(row.allowed_tools).toContain("mcp__ainative__create_task");
    expect(row.allowed_tools).not.toContain("mcp__stagent__");
  });

  it("rewrites sourceFormat stagent → ainative in import_meta", async () => {
    const oldDir = join(tempHome, ".stagent");
    mkdirSync(oldDir, { recursive: true });
    const dbPath = join(oldDir, "stagent.db");
    const db = new Database(dbPath);
    db.exec(`CREATE TABLE agent_profiles (id TEXT PRIMARY KEY, import_meta TEXT)`);
    db.prepare("INSERT INTO agent_profiles VALUES (?, ?)").run(
      "test",
      JSON.stringify({ sourceFormat: "stagent" }),
    );
    db.close();

    await migrateFromStagent({ home: tempHome });

    const newDb = new Database(join(tempHome, ".ainative", "ainative.db"));
    const row = newDb.prepare("SELECT import_meta FROM agent_profiles WHERE id = ?").get("test") as { import_meta: string };
    newDb.close();

    expect(row.import_meta).toContain('"sourceFormat":"ainative"');
  });

  it("returns empty report when neither old nor new dir exists", async () => {
    const report = await migrateFromStagent({ home: tempHome });
    expect(report.dirMigrated).toBe(false);
    expect(report.dbFilesRenamed).toBe(0);
  });

  it("leaves new dir untouched when only new dir exists", async () => {
    const newDir = join(tempHome, ".ainative");
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(newDir, "keep.txt"), "keep");

    const report = await migrateFromStagent({ home: tempHome });

    expect(existsSync(join(newDir, "keep.txt"))).toBe(true);
    expect(report.dirMigrated).toBe(false);
  });
});
