import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  bootstrapStagentDatabase,
  hasLegacyStagentTables,
  hasMigrationHistory,
  markAllMigrationsApplied,
} from "../bootstrap";

const migrationsFolder = join(process.cwd(), "src", "lib", "db", "migrations");

describe("database bootstrap recovery", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "stagent-db-bootstrap-"));
    dbPath = join(tempDir, "stagent.db");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("recovers a bootstrapped database that has no drizzle migration history", () => {
    const bootstrapDb = new Database(dbPath);
    bootstrapStagentDatabase(bootstrapDb);

    expect(hasLegacyStagentTables(bootstrapDb)).toBe(true);
    expect(hasMigrationHistory(bootstrapDb)).toBe(false);

    markAllMigrationsApplied(bootstrapDb, migrationsFolder);
    expect(hasMigrationHistory(bootstrapDb)).toBe(true);
    bootstrapDb.close();

    const migratedDb = new Database(dbPath);
    const drizzleDb = drizzle(migratedDb);

    expect(() =>
      migrate(drizzleDb, {
        migrationsFolder,
      })
    ).not.toThrow();

    const migrationCount = migratedDb
      .prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations")
      .get() as { count: number };
    expect(migrationCount.count).toBe(9);
    migratedDb.close();
  });
});
