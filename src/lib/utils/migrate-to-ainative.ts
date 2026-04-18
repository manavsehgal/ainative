import { existsSync, renameSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import Database from "better-sqlite3";

export interface MigrationReport {
  dirMigrated: boolean;
  dbFilesRenamed: number;
  sqlRowsUpdated: number;
  sentinelRenamed: boolean;
  keychainMigrated: boolean;
  errors: string[];
}

export interface MigrationOptions {
  home?: string;
  gitDir?: string;
  logger?: (msg: string) => void;
}

interface KeychainMigrateModule {
  migrateKeychainService: (
    oldName: string,
    newName: string,
    log: (msg: string) => void,
  ) => Promise<boolean>;
}

function hasSqliteHeader(path: string): boolean {
  const SQLITE_MAGIC = "SQLite format 3\0";
  try {
    const header = readFileSync(path, { encoding: null });
    return header.length >= 16 && header.subarray(0, 16).toString("binary") === SQLITE_MAGIC;
  } catch {
    return false;
  }
}

/**
 * Idempotent migration from ~/.stagent/ to ~/.ainative/. Safe to call on every boot.
 * Never throws — errors are collected in report.errors.
 */
export async function migrateLegacyData(
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const home = options.home ?? homedir();
  const gitDir = options.gitDir ?? join(process.cwd(), ".git");
  const log = options.logger ?? ((m: string) => console.log(`[migrate] ${m}`));
  const report: MigrationReport = {
    dirMigrated: false,
    dbFilesRenamed: 0,
    sqlRowsUpdated: 0,
    sentinelRenamed: false,
    keychainMigrated: false,
    errors: [],
  };

  const oldDir = join(home, ".stagent");
  const newDir = join(home, ".ainative");

  // Step 1: rename directory if needed
  if (existsSync(oldDir) && !existsSync(newDir)) {
    try {
      renameSync(oldDir, newDir);
      report.dirMigrated = true;
      log(`renamed ${oldDir} -> ${newDir}`);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "EXDEV") {
        try {
          cpSync(oldDir, newDir, { recursive: true });
          rmSync(oldDir, { recursive: true, force: true });
          report.dirMigrated = true;
          log(`copied ${oldDir} -> ${newDir} (cross-device fallback)`);
        } catch (copyErr) {
          report.errors.push(`dir copy failed: ${String(copyErr)}`);
          return report;
        }
      } else {
        report.errors.push(`dir rename failed: ${String(err)}`);
        return report;
      }
    }
  }

  // Step 2: rename DB files inside the new dir. If newDir exists from a
  // partial prior run (e.g., failed cpSync cross-device), iteration here is
  // safe — neither old nor new DB files may exist and the step becomes a no-op.
  if (existsSync(newDir)) {
    for (const suffix of ["", "-shm", "-wal"]) {
      const oldName = join(newDir, `stagent.db${suffix}`);
      const newName = join(newDir, `ainative.db${suffix}`);
      if (existsSync(oldName) && !existsSync(newName)) {
        try {
          renameSync(oldName, newName);
          report.dbFilesRenamed++;
        } catch (err) {
          report.errors.push(`db file rename failed (${suffix}): ${String(err)}`);
        }
      }
    }
  }

  // Step 3: SQL row migration. Only open the DB if it begins with the
  // SQLite magic header. Opening a non-SQLite file (e.g., a test fixture
  // placeholder) would succeed initially, then fail on the first prepare(),
  // and the close() in finally would silently delete co-located -shm/-wal.
  const dbPath = join(newDir, "ainative.db");
  if (existsSync(dbPath) && !hasSqliteHeader(dbPath)) {
    log(`skipping SQL migration — ${dbPath} exists but lacks SQLite header`);
  }
  if (existsSync(dbPath) && hasSqliteHeader(dbPath)) {
    try {
      const db = new Database(dbPath);
      try {
        const tableExists = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_profiles'")
          .get();
        if (tableExists) {
          // Run each statement independently — the agent_profiles table may have
          // been created without one or both columns (test or partial schema).
          // A failure in one update must not prevent the other from running.
          let changes = 0;
          try {
            const r1 = db
              .prepare("UPDATE agent_profiles SET allowed_tools = REPLACE(allowed_tools, 'mcp__stagent__', 'mcp__ainative__') WHERE allowed_tools LIKE '%mcp__stagent__%'")
              .run();
            changes += r1.changes;
          } catch (colErr) {
            // Column may not exist in older schema versions — skip silently.
            log(`allowed_tools update skipped: ${String(colErr)}`);
          }
          try {
            const r2 = db
              .prepare(`UPDATE agent_profiles SET import_meta = REPLACE(import_meta, '"sourceFormat":"stagent"', '"sourceFormat":"ainative"') WHERE import_meta LIKE '%"sourceFormat":"stagent"%'`)
              .run();
            changes += r2.changes;
          } catch (colErr) {
            // Column may not exist in older schema versions — skip silently.
            log(`import_meta update skipped: ${String(colErr)}`);
          }
          report.sqlRowsUpdated = changes;
          if (report.sqlRowsUpdated > 0) {
            log(`rewrote ${report.sqlRowsUpdated} agent_profiles row(s)`);
          }
        }
      } finally {
        db.close();
      }
    } catch (err) {
      report.errors.push(`SQL migration failed: ${String(err)}`);
    }
  }

  // Step 4: sentinel file rename
  if (existsSync(gitDir)) {
    const oldSentinel = join(gitDir, "stagent-dev-mode");
    const newSentinel = join(gitDir, "ainative-dev-mode");
    if (existsSync(oldSentinel) && !existsSync(newSentinel)) {
      try {
        renameSync(oldSentinel, newSentinel);
        report.sentinelRenamed = true;
        log(`renamed sentinel ${oldSentinel} -> ${newSentinel}`);
      } catch (err) {
        report.errors.push(`sentinel rename failed: ${String(err)}`);
      }
    }
  }

  // Step 5: keychain migration — delegated to sibling module via dynamic import.
  // The import may fail in Phase 1 if ./keychain-migrate hasn't landed yet (Task 4).
  // Treat any failure (module-not-found OR runtime error) as non-fatal and record.
  // Use a variable specifier so static bundler analysis does not attempt to resolve
  // the module at compile time (it may not yet exist when this module is compiled).
  if (process.platform === "darwin") {
    try {
      const keychainModule = "./keychain-migrate";
      const mod = (await import(/* @vite-ignore */ keychainModule)) as KeychainMigrateModule;
      report.keychainMigrated = await mod.migrateKeychainService("stagent", "ainative", log);
    } catch (err) {
      report.errors.push(`keychain migration failed: ${String(err)}`);
    }
  }

  return report;
}
