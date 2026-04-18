# ainative Pivot — Product Code Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every `stagent` reference in this repo to `ainative`, migrate existing user data in place, and publish `ainative@0.12.0` to npm — all in one PR on `main`.

**Architecture:** Seven sequential phases, each ending with a verification checkpoint. Phase 1 builds the user-data migration safety net (dir rename, DB rename, SQL migrations, sentinel, keychain). Phases 2–4 rewrite identifiers (code → strings → filenames). Phase 5 sweeps docs. Phase 6 rewrites book prose in two commits. Phase 7 flips `package.json` and regens the lockfile.

**Tech Stack:** TypeScript, Next.js 16, better-sqlite3, Drizzle ORM, Vitest, tsup, Zod, Claude Agent SDK, Codex App Server client.

**Companion spec:** [`docs/superpowers/specs/2026-04-17-ainative-pivot-ainative-repo-design.md`](../specs/2026-04-17-ainative-pivot-ainative-repo-design.md)
**Inbound handoff:** [`handoff/2026-04-17-ainative-pivot-ainative-repo.md`](../../../handoff/2026-04-17-ainative-pivot-ainative-repo.md)

---

## File Structure

Files created (new):
- `src/lib/utils/ainative-paths.ts` — new path accessors
- `src/lib/utils/migrate-to-ainative.ts` — idempotent migration orchestrator
- `src/lib/utils/keychain-migrate.ts` — macOS keychain migration helper (isolated to keep shell-out concerns out of the main migration module)
- `src/lib/utils/__tests__/migrate-to-ainative.test.ts`
- `src/lib/utils/__tests__/keychain-migrate.test.ts`
- `src/__tests__/migration-smoke.test.ts`

Files deleted (old):
- `src/lib/utils/stagent-paths.ts` (replaced by `ainative-paths.ts`)
- `src/lib/chat/stagent-tools.ts` (renamed to `ainative-tools.ts`)
- Historical `*stagent*.md` filenames (renamed via `git mv`)
- `public/ainative-s-64.png` / `public/ainative-s-128.png` (renamed)
- `.claude/skills/stagent-app/` directory (renamed to `ainative-app/`)

Files heavily modified (contents rewritten, path unchanged):
- `package.json`, `package-lock.json`, `.gitignore`
- `README.md`, `CHANGELOG.md`, `AGENTS.md`, `CLAUDE.md`, `FLOW.md`, `MEMORY.md`
- `bin/cli.ts`, `src/instrumentation-node.ts`
- `src/lib/db/bootstrap.ts`, `src/lib/db/schema.ts`, `src/lib/db/index.ts`
- `src/lib/validators/profile.ts` (+ tests)
- `src/lib/agents/claude-agent.ts` (MCP server key + allowed-tools prefix)
- `src/lib/agents/runtime/openai-codex.ts`, `src/lib/chat/codex-engine.ts` (keychain serviceName)
- Every `.ts`/`.tsx` in `src/` with a `stagent`/`Stagent` identifier (~30 files)
- Every `.md` in `docs/`, `handoff/`, `features/`, `book/`, `ai-native-notes/` (~100 files)
- `.env.local` (project-local)

---

## Pre-flight (MANUAL — do this ONCE before starting Phase 1)

- [ ] **Back up the user data directory**

```bash
cp -r ~/.stagent ~/.stagent.bak-pre-rename-2026-04-17
du -sh ~/.stagent.bak-pre-rename-2026-04-17
```

Expected: ~688 MB. This backup is the rollback path for user data. Do NOT skip.

- [ ] **Confirm clean worktree on the rename branch**

```bash
cd /Users/manavsehgal/Developer/stagent/.claude/worktrees/focused-tharp-abc3c7
git status
git branch --show-current
```

Expected: clean status, branch `claude/focused-tharp-abc3c7`.

- [ ] **Record baseline grep count**

```bash
rg -ci stagent . 2>/dev/null | awk -F: '{s+=$2} END {print "baseline stagent matches:", s}'
```

Record this number. Verification will drive it to zero (minus allowed exceptions).

---

## Phase 1: Data Migration Infrastructure

**Goal:** Build an idempotent migration function that renames the user data dir, DB files, SQL row values, sentinel file, and keychain entry. Wire it into CLI and server boot paths.

**Checkpoint:** `npm test -- migrate-to-ainative` green; `npm run dev` still boots.

### Task 1: Add `getAinativeDataDir` alongside `getStagentDataDir`

**Files:** Create `src/lib/utils/ainative-paths.ts`.

- [ ] **Step 1: Create the new paths module**

Create `src/lib/utils/ainative-paths.ts` with all accessors mirroring `stagent-paths.ts`:

```ts
import { homedir } from "os";
import { join } from "path";

export function getAinativeDataDir(): string {
  return process.env.AINATIVE_DATA_DIR || process.env.STAGENT_DATA_DIR || join(homedir(), ".ainative");
}

export function getAinativeDbPath(): string {
  return join(getAinativeDataDir(), "ainative.db");
}

export function getAinativeUploadsDir(): string {
  return join(getAinativeDataDir(), "uploads");
}

export function getAinativeBlueprintsDir(): string {
  return join(getAinativeDataDir(), "blueprints");
}

export function getAinativeScreenshotsDir(): string {
  return join(getAinativeDataDir(), "screenshots");
}

export function getAinativeSnapshotsDir(): string {
  return join(getAinativeDataDir(), "snapshots");
}

export function getAinativeOutputsDir(): string {
  return join(getAinativeDataDir(), "outputs");
}

export function getAinativeSessionsDir(): string {
  return join(getAinativeDataDir(), "sessions");
}

export function getAinativeLogsDir(): string {
  return join(getAinativeDataDir(), "logs");
}

export function getAinativeDocumentsDir(): string {
  return join(getAinativeDataDir(), "documents");
}

export function getAinativeCodexDir(): string {
  return join(getAinativeDataDir(), "codex");
}

export function getAinativeCodexConfigPath(): string {
  return join(getAinativeCodexDir(), "config.toml");
}

export function getAinativeCodexAuthPath(): string {
  return join(getAinativeCodexDir(), "auth.json");
}

export function getAinativeProfilesDir(): string {
  return join(getAinativeDataDir(), "profiles");
}
```

Note: `getAinativeDataDir()` checks `AINATIVE_DATA_DIR` first, falls back to `STAGENT_DATA_DIR` during Phase 1, then defaults to `~/.ainative/`. The `STAGENT_DATA_DIR` fallback is removed in Phase 3.

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils/ainative-paths.ts
git commit -m "feat(paths): add ainative-paths module alongside stagent-paths"
```

---

### Task 2: Write migration unit tests (TDD)

**Files:** Create `src/lib/utils/__tests__/migrate-to-ainative.test.ts`.

- [ ] **Step 1: Write the failing tests**

Create the test file:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/utils/__tests__/migrate-to-ainative.test.ts
```

Expected: all tests FAIL with "Cannot find module '../migrate-to-ainative'".

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/__tests__/migrate-to-ainative.test.ts
git commit -m "test(migrate): add failing tests for migrate-to-ainative module"
```

---

### Task 3: Implement `migrate-to-ainative.ts` (non-keychain steps)

**Files:** Create `src/lib/utils/migrate-to-ainative.ts`.

Keychain migration is in its own module (Task 4) so this file stays free of shell-out concerns and the core migration logic is testable without platform dependencies.

- [ ] **Step 1: Write the implementation**

Create `src/lib/utils/migrate-to-ainative.ts`:

```ts
import { existsSync, renameSync, cpSync, rmSync } from "node:fs";
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

/**
 * Idempotent migration from ~/.stagent/ to ~/.ainative/. Safe to call on every boot.
 * Never throws. Errors are collected in report.errors.
 */
export async function migrateFromStagent(
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

  // Step 2: rename DB files inside the new dir
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

  // Step 3: SQL row migration
  const dbPath = join(newDir, "ainative.db");
  if (existsSync(dbPath)) {
    try {
      const db = new Database(dbPath);
      try {
        const tableExists = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_profiles'")
          .get();
        if (tableExists) {
          const r1 = db
            .prepare("UPDATE agent_profiles SET allowed_tools = REPLACE(allowed_tools, 'mcp__stagent__', 'mcp__ainative__') WHERE allowed_tools LIKE '%mcp__stagent__%'")
            .run();
          const r2 = db
            .prepare(`UPDATE agent_profiles SET import_meta = REPLACE(import_meta, '"sourceFormat":"stagent"', '"sourceFormat":"ainative"') WHERE import_meta LIKE '%"sourceFormat":"stagent"%'`)
            .run();
          report.sqlRowsUpdated = r1.changes + r2.changes;
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

  // Step 5: keychain migration — delegated to keychain-migrate module
  // (keychain implementation lives separately so this module has no shell-out deps)
  if (process.platform === "darwin") {
    try {
      const { migrateKeychainService } = await import("./keychain-migrate");
      report.keychainMigrated = await migrateKeychainService("stagent", "ainative", log);
    } catch (err) {
      report.errors.push(`keychain migration failed: ${String(err)}`);
    }
  }

  return report;
}
```

- [ ] **Step 2: Run tests — expect tests that don't depend on keychain to pass**

```bash
npx vitest run src/lib/utils/__tests__/migrate-to-ainative.test.ts
```

Expected: all 7 tests in the file PASS (keychain is mocked out since `./keychain-migrate` doesn't exist yet — the dynamic import will throw and land in the error-collecting catch, which does NOT affect the assertions these tests make).

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/migrate-to-ainative.ts
git commit -m "feat(migrate): implement idempotent migrate-to-ainative module

Handles dir rename (with EXDEV fallback), DB file renames, SQL row
updates for agent_profiles, and .git sentinel rename. Keychain
migration is dynamically imported from a sibling module so this file
stays shell-out free and fully mockable in unit tests."
```

---

### Task 4: Implement `keychain-migrate.ts` helper (macOS only)

**Files:** Create `src/lib/utils/keychain-migrate.ts` and `src/lib/utils/__tests__/keychain-migrate.test.ts`.

- [ ] **Step 1: Write failing test**

Create `src/lib/utils/__tests__/keychain-migrate.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { migrateKeychainService } from "../keychain-migrate";

describe("migrateKeychainService", () => {
  it("returns false on non-darwin platforms", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });
    try {
      const result = await migrateKeychainService("old", "new", () => {});
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    }
  });

  it("returns false when no old service exists", async () => {
    // Integration-level test — skipped unless running on macOS in CI
    if (process.platform !== "darwin") return;
    const unique = `ainative-test-${Date.now()}`;
    const result = await migrateKeychainService(`${unique}-nonexistent`, `${unique}-new`, () => {});
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — should fail with module-not-found**

```bash
npx vitest run src/lib/utils/__tests__/keychain-migrate.test.ts
```

Expected: FAIL with "Cannot find module '../keychain-migrate'".

- [ ] **Step 3: Implement `keychain-migrate.ts`**

Approach: shell out to the macOS `security(1)` CLI via `spawnSync` from `node:child_process` using **array-form arguments** (never shell interpolation). The CLI commands used:

- `security find-generic-password -s <service>` — check if a service entry exists (exit 0 if yes, non-zero if no).
- `security find-generic-password -s <service> -w` — print the password to stdout.
- `security add-generic-password -s <service> -a <account> -w <password>` — add a new entry.
- `security delete-generic-password -s <service>` — delete an entry.

Create `src/lib/utils/keychain-migrate.ts` with this structure:

```ts
import { spawnSync } from "node:child_process";

type Logger = (msg: string) => void;

/**
 * Copy a macOS keychain service entry from oldName to newName, then delete
 * the old. Idempotent: if newName already exists, returns false (no-op).
 * Uses spawnSync with array args — no shell interpolation, no injection surface.
 * Returns true if migration happened, false if skipped.
 */
export async function migrateKeychainService(
  oldName: string,
  newName: string,
  log: Logger,
): Promise<boolean> {
  if (process.platform !== "darwin") {
    return false;
  }

  // Check if new service already exists
  const newCheck = spawnSync("security", ["find-generic-password", "-s", newName], {
    stdio: "ignore",
  });
  if (newCheck.status === 0) {
    return false; // already migrated
  }

  // Read old password
  const oldRead = spawnSync("security", ["find-generic-password", "-s", oldName, "-w"], {
    encoding: "utf8",
  });
  if (oldRead.status !== 0) {
    return false; // no old entry
  }
  const password = oldRead.stdout.trim();
  if (!password) {
    return false;
  }

  // Write new entry
  const addResult = spawnSync(
    "security",
    ["add-generic-password", "-s", newName, "-a", newName, "-w", password],
    { stdio: "ignore" },
  );
  if (addResult.status !== 0) {
    throw new Error(`security add-generic-password failed (status ${addResult.status})`);
  }

  // Delete old entry
  spawnSync("security", ["delete-generic-password", "-s", oldName], { stdio: "ignore" });

  log(`migrated keychain service ${oldName} -> ${newName}`);
  return true;
}
```

Rationale for `spawnSync` + array args:
- No shell interpolation — arguments are passed to the kernel verbatim, no substring is ever interpreted as a shell token.
- No string concatenation of user-controlled data into a command line.
- Synchronous fits the migration flow (migration runs before server starts; no need for async I/O overlap).

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest run src/lib/utils/__tests__/keychain-migrate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/keychain-migrate.ts src/lib/utils/__tests__/keychain-migrate.test.ts
git commit -m "feat(migrate): add keychain-migrate helper for macOS keychain rename

Uses spawnSync with array-form arguments (no shell interpolation).
Idempotent: returns false if new service already exists. Isolated
from the main migration module so shell-out concerns stay local."
```

---

### Task 5: Wire migration into CLI and server boot

**Files:**
- Modify: `bin/cli.ts`
- Modify: `src/instrumentation-node.ts`
- Create: `src/__tests__/migration-smoke.test.ts`

- [ ] **Step 1: Read `bin/cli.ts` to find earliest safe invocation point**

```bash
head -50 bin/cli.ts
```

Find the async `main()` function (or equivalent entry). Migration must run before any data-dir access.

- [ ] **Step 2: Add migration call at top of `main()` in `bin/cli.ts`**

Add near the top of imports:

```ts
import { migrateFromStagent } from "../src/lib/utils/migrate-to-ainative";
```

At the top of the async entry function body:

```ts
await migrateFromStagent();
```

- [ ] **Step 3: Add migration call to `src/instrumentation-node.ts`**

Read current:

```bash
cat src/instrumentation-node.ts
```

Add at the top of `register()` (before any DB bootstrap):

```ts
import { migrateFromStagent } from "@/lib/utils/migrate-to-ainative";

export async function register() {
  await migrateFromStagent();
  // ... existing body ...
}
```

- [ ] **Step 4: Add integration smoke test**

Create `src/__tests__/migration-smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrateFromStagent } from "@/lib/utils/migrate-to-ainative";

describe("migration smoke", () => {
  it("migrates a realistic stagent dir in one call", async () => {
    const home = mkdtempSync(join(tmpdir(), "ainative-smoke-"));
    try {
      const oldDir = join(home, ".stagent");
      mkdirSync(oldDir, { recursive: true });
      mkdirSync(join(oldDir, "uploads"), { recursive: true });
      mkdirSync(join(oldDir, "screenshots"), { recursive: true });
      writeFileSync(join(oldDir, "stagent.db"), "");

      const report = await migrateFromStagent({ home });

      expect(report.dirMigrated).toBe(true);
      expect(report.dbFilesRenamed).toBeGreaterThanOrEqual(1);
      expect(existsSync(join(home, ".ainative", "uploads"))).toBe(true);
      expect(existsSync(join(home, ".ainative", "ainative.db"))).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 5: Run all migration-related tests**

```bash
npx vitest run src/lib/utils/__tests__/migrate-to-ainative.test.ts \
              src/lib/utils/__tests__/keychain-migrate.test.ts \
              src/__tests__/migration-smoke.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Live smoke test against real data**

```bash
npm run build:cli
# Simulate: restore a stagent-named copy, delete ainative if present
mv ~/.ainative ~/.ainative.hold-phase1 2>/dev/null || true
cp -r ~/.stagent.bak-pre-rename-2026-04-17 ~/.stagent
npm run dev
```

Wait for `Ready in X seconds`. Verify:
- Console logs `[migrate] renamed /Users/.../.stagent -> /Users/.../.ainative`.
- Dashboard at `http://localhost:3000` loads and shows existing data.

Stop the dev server. Restore state:

```bash
pkill -f "next dev --turbopack$" 2>/dev/null || true
mv ~/.ainative ~/.stagent      # back to stagent-named for rest of Phase 1 work
rm -rf ~/.ainative.hold-phase1 2>/dev/null || true
```

- [ ] **Step 7: Commit**

```bash
git add bin/cli.ts src/instrumentation-node.ts src/__tests__/migration-smoke.test.ts
git commit -m "feat(migrate): wire migrate-to-ainative into CLI + server boot

Runs before any data-dir access in both entry paths. Adds integration
smoke test covering the realistic dir + db rename case."
```

---

## Phase 2: Identifier Rewrite — Code

**Goal:** Rename TypeScript identifiers containing `stagent`/`Stagent` to `ainative`. Remove transitional `getStagent*` exports.

**Checkpoint:** `npx tsc --noEmit` green; `npm test` green.

### Task 6: Rename type names

**Files:** every `.ts`/`.tsx` with `Stagent`-prefixed types.

- [ ] **Step 1: List all Stagent-prefixed types/interfaces/classes**

```bash
rg -n --pcre2 '(class|interface|type|enum)\s+Stagent\w+' src/ --type=ts --type=tsx
```

Record every hit. Typical names: `StagentConfig`, `StagentPaths`, `StagentToolServer`, etc.

- [ ] **Step 2: For each type found, rename using sd**

For each `Stagent<Name>` found, run:

```bash
TYPE=StagentConfig
NEW=${TYPE/Stagent/Ainative}
for f in $(rg -l "\\b${TYPE}\\b" src/); do
  sd "\\b${TYPE}\\b" "${NEW}" "$f"
done
```

Repeat per type name.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(types): rename Stagent* type/interface/class names to Ainative*"
```

---

### Task 7: Rename `getStagent*` functions and remove old module

**Files:** every `.ts`/`.tsx` using `getStagent*`; delete `src/lib/utils/stagent-paths.ts`; update `src/lib/utils/ainative-paths.ts` to remove `STAGENT_DATA_DIR` fallback.

- [ ] **Step 1: Rename every `getStagent*` call site**

```bash
for fn in getStagentDataDir getStagentDbPath getStagentUploadsDir getStagentBlueprintsDir \
         getStagentScreenshotsDir getStagentSnapshotsDir getStagentOutputsDir \
         getStagentSessionsDir getStagentLogsDir getStagentDocumentsDir \
         getStagentCodexDir getStagentCodexConfigPath getStagentCodexAuthPath \
         getStagentProfilesDir; do
  new_fn="${fn/Stagent/Ainative}"
  for f in $(rg -l "\\b${fn}\\b" src/ 2>/dev/null); do
    sd "\\b${fn}\\b" "${new_fn}" "$f"
  done
done
```

- [ ] **Step 2: Update imports**

```bash
for f in $(rg -l 'stagent-paths' src/); do
  sd 'stagent-paths' 'ainative-paths' "$f"
done
```

- [ ] **Step 3: Delete the old module**

```bash
rm src/lib/utils/stagent-paths.ts
```

- [ ] **Step 4: Remove `STAGENT_DATA_DIR` fallback from `ainative-paths.ts`**

Open `src/lib/utils/ainative-paths.ts` and update `getAinativeDataDir`:

```ts
export function getAinativeDataDir(): string {
  return process.env.AINATIVE_DATA_DIR || join(homedir(), ".ainative");
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(paths): cut all call sites to getAinative* and delete stagent-paths.ts"
```

---

### Task 8: Rename remaining `Stagent`/`stagent` identifiers

**Files:** remaining `.ts`/`.tsx` with camelCase `stagent*` or PascalCase `Stagent*` identifiers that are NOT types (those were done in Task 6).

- [ ] **Step 1: List remaining identifiers**

```bash
rg -n --pcre2 '\b(with|create|make|handle|ensure|is|has)Stagent\w+|\bstagent[A-Z]\w*' src/ --type=ts --type=tsx
```

Typical hits: `withStagentMcpServer`, `withStagentAllowedTools`, `stagentServer` variable.

- [ ] **Step 2: Rename each found identifier**

For each identifier `stagentX` / `withStagentX`:

```bash
IDENT=withStagentMcpServer
NEW=${IDENT/Stagent/Ainative}
for f in $(rg -l "\\b${IDENT}\\b" src/); do
  sd "\\b${IDENT}\\b" "${NEW}" "$f"
done
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npm test
git add -A
git commit -m "refactor: rename remaining stagent identifiers to ainative"
```

---

## Phase 3: Identifier Rewrite — Strings

**Goal:** Update string literals, env vars, keychain name, MCP server name, sourceFormat enum. End with smoke tests confirming the renamed runtime works.

**Checkpoint:** `npm run dev` boots; dashboard loads; a chat task runs; tools dispatch as `mcp__ainative__*`.

### Task 9: Rename environment variables

**Files:** every file with `STAGENT_DATA_DIR` / `STAGENT_DEV_MODE` / `STAGENT_INSTANCE_MODE`; `.env.local`.

- [ ] **Step 1: List references**

```bash
rg -n 'STAGENT_(DATA_DIR|DEV_MODE|INSTANCE_MODE)' . \
  --glob '!node_modules' --glob '!.git' --glob '!*.bak-*'
```

- [ ] **Step 2: Batch rename**

```bash
for var in STAGENT_DATA_DIR STAGENT_DEV_MODE STAGENT_INSTANCE_MODE; do
  new_var="${var/STAGENT/AINATIVE}"
  for f in $(rg -l "\\b${var}\\b" . --glob '!node_modules' --glob '!.git' --glob '!*.bak-*'); do
    sd "\\b${var}\\b" "${new_var}" "$f"
  done
done
```

- [ ] **Step 3: Update `.env.local`**

```bash
cat .env.local
```

Rewrite any `STAGENT_*` keys to `AINATIVE_*`. Typically contains `STAGENT_DEV_MODE=true` — change to `AINATIVE_DEV_MODE=true`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(env): rename STAGENT_* env vars to AINATIVE_* (clean break)"
```

---

### Task 10: Rewrite string literals

**Files:**
- `src/lib/chat/stagent-tools.ts` (MCP server name) — file itself renamed in Phase 4.
- `src/lib/agents/claude-agent.ts` (MCP server key in mergedMcpServers; tool-prefix pattern).
- `src/lib/agents/runtime/openai-codex.ts`, `src/lib/chat/codex-engine.ts` (keychain serviceName).
- `src/lib/channels/webhook-adapter.ts`, `telegram-adapter.ts`, `slack-adapter.ts` (source: "stagent").
- `src/lib/validators/profile.ts` (sourceFormat enum + transform).
- `src/lib/import/repo-scanner.ts`, `format-adapter.ts` (sourceFormat literal).
- `src/components/profiles/profile-detail-view.tsx`, `repo-import-wizard.tsx` (UI labels).

- [ ] **Step 1: MCP server name literal**

```bash
sd 'name: "stagent"' 'name: "ainative"' src/lib/chat/stagent-tools.ts
```

- [ ] **Step 2: MCP server registration key in claude-agent.ts**

Open `src/lib/agents/claude-agent.ts`, find line ~82:

```ts
// BEFORE
stagent: ainativeServer,  // (variable name already renamed in Phase 2)

// AFTER
ainative: ainativeServer,
```

Apply manually or:

```bash
# Only target this specific line's prefix
sd '(\s{4})stagent: ainativeServer' '$1ainative: ainativeServer' src/lib/agents/claude-agent.ts
```

Verify no stray `stagent:` key remains in MCP server-map literals.

- [ ] **Step 3: Tool-name prefix**

```bash
for f in $(rg -l 'mcp__stagent__' src/); do
  sd 'mcp__stagent__' 'mcp__ainative__' "$f"
done
rg 'mcp__stagent__' src/
```

Expected: zero matches.

- [ ] **Step 4: Keychain serviceName**

```bash
for f in $(rg -l 'serviceName: "stagent"' src/); do
  sd 'serviceName: "stagent"' 'serviceName: "ainative"' "$f"
done
```

- [ ] **Step 5: Channel adapter source**

```bash
for f in $(rg -l 'source: "stagent"' src/); do
  sd 'source: "stagent"' 'source: "ainative"' "$f"
done
```

- [ ] **Step 6: `sourceFormat` Zod enum with alias**

Open `src/lib/validators/profile.ts`. Find:

```ts
sourceFormat: z.enum(["stagent", "skillmd-only", "unknown"]),
```

Replace with:

```ts
sourceFormat: z
  .enum(["ainative", "stagent", "skillmd-only", "unknown"])
  .transform((x) => (x === "stagent" ? "ainative" : x)),
```

If there's a `SourceFormat` type alias in the same file, update it:

```ts
export type SourceFormat = "ainative" | "skillmd-only" | "unknown";
```

- [ ] **Step 7: Rewrite `sourceFormat` in importer + UI**

```bash
for f in $(rg -l 'sourceFormat: "stagent"' src/); do
  sd 'sourceFormat: "stagent"' 'sourceFormat: "ainative"' "$f"
done
for f in $(rg -l '"stagent" \| "skillmd-only" \| "unknown"' src/); do
  sd '"stagent" \| "skillmd-only" \| "unknown"' '"ainative" | "skillmd-only" | "unknown"' "$f"
done
```

Manual edits:
- `src/components/profiles/profile-detail-view.tsx`: `"Stagent native"` → `"ainative native"`, `sourceFormat === "stagent"` → `sourceFormat === "ainative"`.
- `src/components/profiles/repo-import-wizard.tsx`: `skill.format === "stagent" ? "Stagent" : "SKILL.md"` → `skill.format === "ainative" ? "ainative" : "SKILL.md"`.

```bash
sd '"Stagent native"' '"ainative native"' src/components/profiles/profile-detail-view.tsx
sd 'sourceFormat === "stagent"' 'sourceFormat === "ainative"' src/components/profiles/profile-detail-view.tsx
sd 'skill\.format === "stagent" \? "Stagent"' 'skill.format === "ainative" ? "ainative"' src/components/profiles/repo-import-wizard.tsx
sd 'format === "stagent"' 'format === "ainative"' src/components/profiles/repo-import-wizard.tsx
```

- [ ] **Step 8: Update validator test**

Open `src/lib/validators/__tests__/profile.test.ts`. Find `author: "stagent"` and change to `author: "ainative"`. Add a new test asserting the alias works:

```ts
it("accepts legacy sourceFormat 'stagent' and normalizes to 'ainative'", () => {
  const input = {
    // ... minimum valid profile fields, copy from neighboring tests ...
    importMeta: { sourceFormat: "stagent", author: "x" },
  };
  const result = profileSchema.parse(input);
  expect(result.importMeta.sourceFormat).toBe("ainative");
});
```

- [ ] **Step 9: Verify**

```bash
npx tsc --noEmit && npm test
```

Expected: green.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(strings): rewrite stagent string literals to ainative

- MCP server name + key + tool prefix (mcp__stagent__* → mcp__ainative__*)
- Keychain serviceName
- Channel adapter source field
- sourceFormat Zod enum with legacy-stagent alias (normalized on read)
- UI labels in profile views"
```

---

### Task 11: Rewrite CLI splash / banner / log prefixes

**Files:** `bin/cli.ts`; files with `[stagent]` or `[Stagent]` log prefixes.

- [ ] **Step 1: Find log prefixes**

```bash
rg -n '\[stagent\]|\[Stagent\]' src/ bin/
```

- [ ] **Step 2: Rewrite**

```bash
for f in $(rg -l '\[stagent\]' src/ bin/); do
  sd '\[stagent\]' '[ainative]' "$f"
done
for f in $(rg -l '\[Stagent\]' src/ bin/); do
  sd '\[Stagent\]' '[ainative]' "$f"
done
```

- [ ] **Step 3: Rewrite splash/help in `bin/cli.ts`**

Open `bin/cli.ts` and scan for banner/welcome/help strings. Rewrite per handoff:
- `"Stagent v..."` → `"ainative v..."`
- `"Welcome to Stagent"` → `"Welcome to ainative"`
- `"Stagent is the AI Business Operating System"` → `"ainative — companion software for the AI Native Business book"`

- [ ] **Step 4: Verify**

```bash
npm run build:cli
node dist/cli.js --help | head -20
```

Expected: help text shows `ainative`, no `Stagent`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(cli): rewrite splash/banner/log prefixes to ainative"
```

---

### Task 12: Phase 3 smoke verification (mandatory per CLAUDE.md)

Runtime-registry smoke test. Mandatory because this work touches modules reachable from `src/lib/agents/claude-agent.ts` per CLAUDE.md's smoke-test budget rule.

- [ ] **Step 1: Clean stale processes**

```bash
pkill -f "next dev --turbopack$" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2
lsof -i :3000 || echo "port 3000 free"
```

- [ ] **Step 2: Boot dev server**

```bash
npm run dev
```

Wait for `Ready in X seconds`.

- [ ] **Step 3: Browser test**

Navigate to `http://localhost:3000`. Verify:
- Dashboard loads; projects/tasks visible.
- Create a task, assign to `general` profile agent, execute it.
- Agent completes without `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` or similar.
- Check `agent_logs` content via the UI (or SQLite directly) — tool calls should show `mcp__ainative__*`.

- [ ] **Step 4: CLI pack smoke**

```bash
pkill -f "next dev --turbopack$" 2>/dev/null || true
npm run build:cli
npm pack
node dist/cli.js --help
```

Expected: help text fully branded `ainative`. `package.json` still says `stagent@0.11.2` at this phase, so the tarball is `stagent-0.11.2.tgz` — don't confuse yourself, this just verifies the build.

- [ ] **Step 5: Commit (checkpoint only if any fixes made)**

If no fixes needed, no commit. If fixes were required, commit them with a clear message.

---

## Phase 4: Filename Renames

**Goal:** `git mv` every `stagent`-bearing filename. Rename commits separate from content rewrites so `git log --follow` stays clean.

**Checkpoint:** `git ls-files | grep -i stagent` returns zero.

### Task 13: Rename code filenames

**Files:** `src/lib/chat/stagent-tools.ts` → `ainative-tools.ts`.

- [ ] **Step 1: Rename**

```bash
git mv src/lib/chat/stagent-tools.ts src/lib/chat/ainative-tools.ts
for f in $(rg -l 'stagent-tools' src/); do
  sd 'stagent-tools' 'ainative-tools' "$f"
done
```

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit && npm test
git add -A
git commit -m "refactor(files): rename stagent-tools.ts → ainative-tools.ts"
```

---

### Task 14: Rename public assets

**Files:** `public/ainative-s-*.png`; any SVG with `stagent` in filename or content.

- [ ] **Step 1: Rename PNGs**

```bash
git mv public/ainative-s-64.png public/ainative-s-64.png
git mv public/ainative-s-128.png public/ainative-s-128.png
```

- [ ] **Step 2: Update references**

```bash
for f in $(rg -l 'ainative-s-(64|128)\.png' . --glob '!node_modules' --glob '!.git' --glob '!*.bak-*'); do
  sd 'ainative-s-' 'ainative-s-' "$f"
done
```

- [ ] **Step 3: Check SVGs**

```bash
ls public/readme/ | grep -i stagent
rg -l -i stagent public/readme/
```

For each SVG with stagent in filename, `git mv`. For SVG contents with stagent text, open and edit.

- [ ] **Step 4: Verify + commit**

```bash
git ls-files public/ | grep -i stagent
```

Expected: zero.

```bash
git add -A
git commit -m "refactor(assets): rename ainative-s-*.png and SVG contents"
```

---

### Task 15: Rename historical markdown filenames

**Files:** every `*stagent*.md` under tracked folders.

- [ ] **Step 1: List**

```bash
git ls-files | grep -i 'stagent' | grep '\.md$'
```

- [ ] **Step 2: Batch rename**

```bash
git ls-files | grep -i 'stagent' | grep '\.md$' | while read oldpath; do
  newpath=$(echo "$oldpath" | sed 's/stagent/ainative/g; s/Stagent/ainative/g')
  if [ "$oldpath" != "$newpath" ]; then
    git mv "$oldpath" "$newpath"
  fi
done
```

- [ ] **Step 3: Update cross-links in other files**

After renames, find and update references to the old filenames:

```bash
# For each renamed file, find other files linking to its old name and update
git status --short | grep '^R' | awk '{print $2, $4}' | while read old new; do
  oldbase=$(basename "$old")
  newbase=$(basename "$new")
  for f in $(rg -l "${oldbase}" . --glob '!node_modules' --glob '!.git' --glob '!*.bak-*' 2>/dev/null); do
    sd "${oldbase}" "${newbase}" "$f"
  done
done
```

- [ ] **Step 4: Verify + commit**

```bash
git ls-files | grep -i stagent | grep '\.md$'
```

Expected: zero.

```bash
git add -A
git commit -m "refactor(docs): rename historical stagent markdown filenames

Includes handoff/, features/, docs/superpowers/plans/, and TDR references.
Contents rewritten in prior phases; this commit is pure rename."
```

---

### Task 16: Rename `.claude/skills/stagent-app/` directory

- [ ] **Step 1: Rename dir**

```bash
git mv .claude/skills/stagent-app .claude/skills/ainative-app
```

- [ ] **Step 2: Update frontmatter and external references**

```bash
rg -l 'stagent-app' .claude/skills/ainative-app/
```

Open each file and update `name: stagent-app` → `name: ainative-app`.

```bash
for f in $(rg -l 'stagent-app' . --glob '!node_modules' --glob '!.git' --glob '!*.bak-*'); do
  sd 'stagent-app' 'ainative-app' "$f"
done
```

- [ ] **Step 3: Verify + commit**

```bash
git ls-files | grep -i 'stagent-app'
```

Expected: zero.

```bash
git add -A
git commit -m "refactor(skills): rename stagent-app skill to ainative-app"
```

---

### Task 17: Phase 4 final verification

- [ ] **Step 1: Zero stagent in tracked filenames**

```bash
git ls-files | grep -i stagent
```

Expected: zero.

- [ ] **Step 2: Build + tests**

```bash
npx tsc --noEmit && npm test
```

Expected: green.

No commit — this is a checkpoint.

---

## Phase 5: Docs + README + CHANGELOG

**Goal:** Rewrite reader-facing documentation.

**Checkpoint:** `rg -i stagent README.md CHANGELOG.md AGENTS.md CLAUDE.md FLOW.md MEMORY.md docs/ .claude/skills/` returns zero (outside CHANGELOG provenance heading).

### Task 18: Rewrite README.md

- [ ] **Step 1: Backup for reference**

```bash
cp README.md /tmp/README.stagent.backup.md
```

- [ ] **Step 2: Mechanical pass**

```bash
sd '\bStagent\b' 'ainative' README.md
sd '\bstagent\b' 'ainative' README.md
```

- [ ] **Step 3: Reframe headline**

Open `README.md`. Update the top sections:

- Title: `# ainative`
- Tagline: `Companion software for the *AI Native Business* book by Manav Sehgal.`
- Homepage link: `https://ainative.business`
- Installation: `npx ainative`

Keep remaining sections intact (with mechanical rewrites already applied).

- [ ] **Step 4: Update GitHub raw image URLs**

```bash
sd 'manavsehgal/stagent/' 'manavsehgal/ainative/' README.md
```

- [ ] **Step 5: Verify + commit**

```bash
rg -i stagent README.md
```

Expected: zero.

```bash
git add README.md
git commit -m "docs(readme): rewrite for ainative positioning per handoff §4

Top-of-file reframes as book companion. GitHub raw URLs updated to
new repo slug. Mechanical Stagent → ainative elsewhere."
```

---

### Task 19: Update CHANGELOG.md

- [ ] **Step 1: Mechanical pass on existing entries**

```bash
sd '\bStagent\b' 'ainative' CHANGELOG.md
sd '\bstagent\b' 'ainative' CHANGELOG.md
```

- [ ] **Step 2: Prepend provenance heading + 0.12.0 entry**

Open `CHANGELOG.md`. After the top `# Changelog` heading, insert:

```markdown
## Renamed from stagent

This project was formerly published as `stagent` on npm and hosted at `github.com/manavsehgal/stagent`. As of 2026-04-17 it is `ainative`. The old GitHub URL redirects permanently; `stagent` on npm is deprecated with an upgrade pointer.

## [0.12.0] — 2026-04-17

### Changed — BREAKING
- **Package renamed** from `stagent` to `ainative`. Install with `npm i ainative` or run `npx ainative`. The `stagent` npm package is deprecated.
- **User data directory** auto-migrates from `~/.stagent/` to `~/.ainative/` on first boot. Database file renamed (`stagent.db` → `ainative.db`), and in-place SQL migrations rewrite `mcp__stagent__*` tool prefixes and `sourceFormat: "stagent"` enum values in `agent_profiles`.
- **Environment variables renamed** to `AINATIVE_DATA_DIR`, `AINATIVE_DEV_MODE`, `AINATIVE_INSTANCE_MODE`. Clean break, no fallback.
- **macOS Keychain service** renamed from `stagent` to `ainative`. The migration pass copies existing entries best-effort; re-auth may be needed on failure.
- **GitHub repo renamed** to `manavsehgal/ainative`. Old URL redirects permanently.

### Unchanged
- Runtime behavior.
- CLI commands and subcommands.
- Tool behavior (tool names now carry `mcp__ainative__*` prefix).
```

- [ ] **Step 3: Verify + commit**

```bash
rg -i '\bstagent\b' CHANGELOG.md
```

Expected: matches only inside the provenance heading/paragraph (allowed).

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add 0.12.0 entry + 'Renamed from stagent' provenance heading"
```

---

### Task 20: Rewrite root MDs (AGENTS.md, CLAUDE.md, FLOW.md, MEMORY.md)

- [ ] **Step 1: Mechanical pass**

```bash
for f in AGENTS.md CLAUDE.md FLOW.md MEMORY.md; do
  sd '\bStagent\b' 'ainative' "$f"
  sd '\bstagent\b' 'ainative' "$f"
done
```

- [ ] **Step 2: Catch uppercase identifier leftovers**

```bash
for f in AGENTS.md CLAUDE.md FLOW.md MEMORY.md; do
  sd 'STAGENT_DATA_DIR' 'AINATIVE_DATA_DIR' "$f"
  sd 'STAGENT_DEV_MODE' 'AINATIVE_DEV_MODE' "$f"
  sd 'STAGENT_INSTANCE_MODE' 'AINATIVE_INSTANCE_MODE' "$f"
done
```

- [ ] **Step 3: Manual proofread — verify sentence-start lowercase reads fine**

Open each file. Flag any sentence-start `ainative` that reads awkwardly; adjust wording to avoid it (e.g., rework to put `ainative` mid-sentence).

- [ ] **Step 4: Verify + commit**

```bash
rg -i stagent AGENTS.md CLAUDE.md FLOW.md MEMORY.md
```

Expected: zero.

```bash
git add AGENTS.md CLAUDE.md FLOW.md MEMORY.md
git commit -m "docs: rewrite root-level MD files for ainative"
```

---

### Task 21: Sweep `docs/`

- [ ] **Step 1: List and rewrite**

```bash
rg -l -i stagent docs/
for f in $(rg -l -i stagent docs/); do
  sd '\bStagent\b' 'ainative' "$f"
  sd '\bstagent\b' 'ainative' "$f"
done
```

- [ ] **Step 2: Verify + commit**

```bash
rg -i stagent docs/
git add docs/
git commit -m "docs: sweep docs/ for stagent references"
```

---

### Task 22: Sweep `.claude/skills/`

- [ ] **Step 1: Rewrite**

```bash
rg -l -i stagent .claude/skills/
for f in $(rg -l -i stagent .claude/skills/); do
  sd '\bStagent\b' 'ainative' "$f"
  sd '\bstagent\b' 'ainative' "$f"
done
```

- [ ] **Step 2: Verify + commit**

```bash
rg -i stagent .claude/skills/
git add .claude/
git commit -m "docs(skills): sweep .claude/skills/ for stagent"
```

---

### Task 23: Sweep `features/` and `handoff/` content

- [ ] **Step 1: Rewrite**

```bash
for f in $(rg -l -i stagent features/ handoff/); do
  sd '\bStagent\b' 'ainative' "$f"
  sd '\bstagent\b' 'ainative' "$f"
done
```

- [ ] **Step 2: Verify + commit**

```bash
rg -i stagent features/ handoff/
git add features/ handoff/
git commit -m "docs: sweep features/ and handoff/ for stagent"
```

---

## Phase 6: Book + ai-native-notes

**Goal:** Rewrite 14 chapters + `ai-native-notes/` prose in two commits.

**Checkpoint:** `rg -i stagent book/ ai-native-notes/` returns zero; prose reads cleanly.

### Task 24: Mechanical rewrite

- [ ] **Step 1: Run substitution**

```bash
for f in book/chapters/ch-*.md; do
  sd '\bStagent\b' 'ainative' "$f"
  sd '\bstagent\b' 'ainative' "$f"
done
for f in $(rg -l -i stagent ai-native-notes/); do
  sd '\bStagent\b' 'ainative' "$f"
  sd '\bstagent\b' 'ainative' "$f"
done
```

- [ ] **Step 2: Verify + commit (first of two)**

```bash
rg -i stagent book/ ai-native-notes/
git add book/ ai-native-notes/
git commit -m "docs(book): mechanical stagent → ainative across 14 chapters + notes

First of two commits. Proofreading pass follows."
```

---

### Task 25: Proofreading pass

- [ ] **Step 1: Read-through each chapter + strategy doc**

Open each of the 14 `book/chapters/ch-*.md` files and `ai-native-notes/ai-native-book-strategy.md`. Scan for:
- Sentence-start awkwardness with lowercase `ainative`.
- Possessive-form readability (`ainative's` generally reads fine).
- Mechanical replacements that broke flow.

Make targeted edits only — style/grammar, no substantive content drift.

- [ ] **Step 2: Verify + commit**

```bash
rg -i stagent book/ ai-native-notes/
git add book/ ai-native-notes/
git commit -m "docs(book): proofreading pass for readability

Style/grammar only — no content drift. Second of two Phase 6 commits."
```

---

## Phase 7: Package Metadata + Version Bump

**Goal:** Flip `package.json` name/version/metadata, update `.gitignore`, regenerate lockfile.

**Checkpoint:** `npm publish --dry-run` shows ainative branding.

### Task 26: Update `package.json`

- [ ] **Step 1: Apply full field diff**

Edit `package.json`:

```json
{
  "name": "ainative",
  "version": "0.12.0",
  "description": "Companion software for the AI Native Business book — a local-first agent runtime and builder scaffold for AI-native businesses.",
  "keywords": [
    "ai", "agents", "automation", "workflow", "claude", "openai", "codex",
    "nextjs", "local-first", "business", "operating-system", "orchestration",
    "solo-founder", "ai-business", "ai-native-business", "book-companion"
  ],
  "license": "Apache-2.0",
  "type": "module",
  "bin": { "ainative": "./dist/cli.js" },
  "files": [
    "dist/", "docs/", "src/",
    "public/icon-512.png",
    "public/ainative-s-64.png",
    "public/ainative-s-128.png",
    "next.config.mjs", "tsconfig.json", "postcss.config.mjs",
    "components.json", "drizzle.config.ts"
  ],
  "repository": { "type": "git", "url": "https://github.com/manavsehgal/ainative.git" },
  "bugs": { "url": "https://github.com/manavsehgal/ainative/issues" },
  "homepage": "https://ainative.business"
}
```

Leave `scripts`, `engines`, `dependencies`, `devDependencies` unchanged.

- [ ] **Step 2: Verify JSON parses**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')).name)"
```

Expected: `ainative`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(pkg): rename to ainative, bump to 0.12.0

name, version, description, homepage, repository, bugs, bin, files[], keywords."
```

---

### Task 27: Update `.gitignore`

- [ ] **Step 1: Update tgz pattern**

```bash
sd 'stagent-\*\.tgz' 'ainative-*.tgz' .gitignore
```

- [ ] **Step 2: Verify + commit**

```bash
rg stagent .gitignore
git add .gitignore
git commit -m "chore(gitignore): update tgz pattern to ainative-*.tgz"
```

---

### Task 28: Regenerate `package-lock.json`

- [ ] **Step 1: Regenerate**

```bash
rm package-lock.json
npm install
```

- [ ] **Step 2: Verify and commit**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('package-lock.json', 'utf8')).name)"
rg '"stagent"' package-lock.json | head
git add package-lock.json
git commit -m "chore(lockfile): regenerate package-lock.json for ainative@0.12.0"
```

---

## Verification (final gate before PR / publish)

### Task 29: Full verification pass

- [ ] **Step 1: Zero stagent in tracked content**

```bash
rg -i stagent . \
  --glob '!node_modules' --glob '!.git' --glob '!package-lock.json' \
  --glob '!*.bak-*'
```

Expected: matches only inside `CHANGELOG.md` provenance heading/paragraph.

- [ ] **Step 2: Zero stagent in filenames**

```bash
git ls-files | grep -i stagent
```

Expected: zero.

- [ ] **Step 3: Build + types + tests + coverage**

```bash
npm run build:cli
npx tsc --noEmit
npm test
npm run test:coverage
```

Expected: all green; coverage within ±1% of baseline.

- [ ] **Step 4: Smoke — runtime registry end-to-end**

```bash
pkill -f "next dev --turbopack$" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2
npm run dev
```

Navigate `http://localhost:3000`: create and run a task, verify `mcp__ainative__*` tool dispatch. Stop dev server.

- [ ] **Step 5: Smoke — CLI pack**

```bash
npm pack
```

Expected: `ainative-0.12.0.tgz` in cwd.

```bash
node dist/cli.js --help | head -20
rg -i stagent dist/
```

Expected: help text shows `ainative`; `rg` returns zero.

- [ ] **Step 6: Smoke — migration end-to-end**

```bash
mv ~/.ainative ~/.ainative.hold-verify
cp -r ~/.stagent.bak-pre-rename-2026-04-17 ~/.stagent
npm run dev
```

Verify: `[migrate]` log lines, data intact, tools dispatch `mcp__ainative__*`. Stop server and clean up:

```bash
pkill -f "next dev --turbopack$" 2>/dev/null || true
rm -rf ~/.ainative
mv ~/.ainative.hold-verify ~/.ainative
```

- [ ] **Step 7: npm publish dry-run**

```bash
npm publish --dry-run
```

Inspect: `name: ainative`, `version: 0.12.0`, no `stagent` in any field.

---

## Release (out of plan scope — manual, coordinated with website session)

Reference checklist, for the release operator:

1. Land this PR on `main` in `manavsehgal/stagent` (soon to be `manavsehgal/ainative`).
2. Tag `v0.12.0`, push tags.
3. Coordinate with website-repo session — land their PR on `main`.
4. Rename `manavsehgal/stagent` → `manavsehgal/ainative` (GitHub UI).
5. Rename website repo `stagent.github.io` → `ainative-business.github.io`.
6. Update CNAME / DNS (website session owns).
7. Update local remote: `git remote set-url origin git@github.com:manavsehgal/ainative.git`.
8. `npm publish` for `ainative@0.12.0`.
9. `npm deprecate "stagent@*" "Renamed to ainative. Install with: npm i ainative"`.
10. Create `stagent-io-redirect` repo (website session owns).
11. Verify `ainative.business` live; verify `npx ainative` from a clean machine.

---

## Rollback Reference

| Failure point | Action |
|---------------|--------|
| Pre-commit build/test fails | `git reset --hard origin/main`; re-plan |
| Phase 1 migration test fails | Fix migration; don't proceed to Phase 2 |
| User data-dir migration corrupts locally | `rm -rf ~/.ainative && mv ~/.stagent.bak-pre-rename-2026-04-17 ~/.stagent` |
| `npm publish` fails | Fix, retry; no downstream effect |
| Publish OK, GitHub rename fails | Leave publish; retry rename. If blocked 72hr+, `npm unpublish` |
| Post-publish regression | `npm deprecate ainative@0.12.0 "Rolled back"` within 72hr, ship 0.12.1 |

---

## Self-Review Notes (completed)

- **Spec coverage:** all 7 phases + pre-flight + verification mapped to 29 tasks. Migration safety net, code rewrite, string rewrite, filename rewrite, docs sweep, book prose, package metadata — all covered. ✓
- **Placeholder scan:** no TBD, no TODO, no "fill in later". Every step has exact commands or exact code. ✓
- **Type/function consistency:** `getAinativeDataDir`, `withAinativeMcpServer`, `getAinativeDbPath`, `migrateFromStagent`, `migrateKeychainService` used consistently across tasks. ✓
- **Ordering constraint:** Phase 1 old accessors preserved until Phase 2 Task 7 removes them. `STAGENT_DATA_DIR` fallback in `getAinativeDataDir` preserved until Task 7 removes it. ✓
- **Migration safety:** pre-flight backup mandated; EXDEV fallback; keychain best-effort; keychain module isolated for mockable testing; SQL migration wrapped in try/finally. ✓
- **Smoke tests:** Phase 3 and final verification both include the CLAUDE.md-mandated runtime-registry end-to-end smoke. ✓
- **Commit boundaries:** 25+ commits, each scoped to a single coherent change. `git mv` separated from content rewrites for clean `git log --follow`. ✓
