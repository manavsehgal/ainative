# Instance Bootstrap & Branch Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an idempotent first-boot installer that establishes branch discipline (creates a `local` branch, installs a consent-gated pre-push hook) for every git-clone user of ainative, without breaking the canonical dev repo.

**Architecture:** New `src/lib/instance/` module with 5 files (types, detect, git-ops, settings, bootstrap). Two-phase execution: Phase A (non-destructive — instanceId generation + local branch creation) runs on every first boot; Phase B (pre-push hook + pushRemote config) requires explicit user consent via a first-boot notification. Layered dev-mode gates (`STAGENT_DEV_MODE` env var, `.git/ainative-dev-mode` sentinel, `STAGENT_INSTANCE_MODE` override) short-circuit the entire module in the canonical dev repo. Integrated into `src/instrumentation.ts` before scheduler startup.

**Tech Stack:** TypeScript, Node `execFileSync` (argv arrays, no shell), better-sqlite3 settings table, Drizzle ORM, vitest, Next.js `register()` instrumentation hook.

---

## NOT in scope

- **Upgrade detection / polling / badge** — Delivered by `upgrade-detection` feature; depends on this plan's `settings.instance` schema and `git-ops.ts` wrapper.
- **Upgrade session UI / upgrade-assistant profile** — Delivered by `upgrade-session` feature.
- **Machine fingerprint generator** — Explicitly descoped via REDUCE compression; delivered entirely by `instance-license-metering` feature when needed.
- **`src/lib/instance/hooks/pre-push.sh` standalone file** — Explicitly descoped via REDUCE compression; the hook template is a string constant in `bootstrap.ts`, avoiding file-resolution complexity across dev/tsup/npm/npx.
- **Cloud license seat counting** — Separate `instance-license-metering` workstream, server-side.
- **Visual diff/merge UI for conflict resolution** — `upgrade-session` scope.
- **Auto-apply upgrades without user consent** — Out of scope by product principle.
- **Multi-instance listing, switching, or presets** — Future "Instance Manager" feature; explicitly rejected for now.
- **Settings → Instance UI section** — Delivered by `upgrade-session` feature.
- **`src/app/api/instance/*` routes** — Delivered by `upgrade-session` feature.

## What already exists

Reusable code and patterns confirmed during scope challenge:

- **`src/lib/utils/ainative-paths.ts:4`** — `getAinativeDataDir()` provides the `STAGENT_DATA_DIR || ~/.ainative` fallback. Private-instance detection is a single comparison against `join(homedir(), ".ainative")`.
- **`src/lib/settings/helpers.ts`** — `getSettingSync(key)` and `setSetting(key, value)` are the canonical read/write helpers for the `settings` key-value table. Synchronous is safe (better-sqlite3).
- **`src/lib/db/schema.ts:284`** — `settings` table (`key` PK, `value` TEXT, `updatedAt` epoch). No schema changes needed; this plan stores JSON-in-TEXT per TDR-011.
- **`src/instrumentation.ts:1-30`** — Next.js `register()` hook with dynamic imports inside a `try/catch`. Pattern: import module, call startup function, log error but don't crash. The new `ensureInstance()` call follows the same shape.
- **`src/lib/notifications/actionable.ts:12-17`** — Notification actions model with `ApprovalActionId` union type. The consent prompt follows this pattern with custom action IDs.
- **`bin/sync-worktree.sh:8-19`** — Worktree detection via `git rev-parse --git-common-dir` vs `--git-dir`. Port the logic into `detect.ts` so the module correctly handles ainative worktree setups.
- **`src/lib/settings/__tests__/budget-guardrails.test.ts:1-29`** — Reference vitest pattern: `mkdtempSync` for temp dirs, `vi.stubEnv("STAGENT_DATA_DIR", tempDir)` for isolation, `vi.resetModules()` between test cases, dynamic imports for modules that read env at load time.
- **`better-sqlite3` API** — All DB operations are synchronous; no need for async/await in `settings.ts`.
- **`node:child_process` `execFileSync`** — Accepts `(file, args[])` with strict argv separation; does NOT invoke a shell. This is the only safe git invocation pattern for this module.

## Error & Rescue Registry

| Error | Trigger | Impact | Rescue |
|---|---|---|---|
| `execFileSync("git", ...)` throws | Git not installed, corrupt repo, rebase in progress | `ensureInstance()` aborts this step | Catch in the specific `ensureX()` function, log to console, return failure for that step, continue with other steps. Bootstrap never crashes the app. |
| `writeFileSync` to `.git/hooks/pre-push` fails | Read-only FS, permission denied | Hook not installed | Log warning, mark guardrails as `installation_failed` in settings, continue boot |
| `settings.instance` JSON parse fails | DB corruption, concurrent write collision | Config read returns `null`, bootstrap re-generates | Wrap JSON.parse in try/catch; on failure, treat as missing config and re-run `ensureInstanceConfig()` |
| Pre-existing non-ainative pre-push hook | User has their own hook | Our install would overwrite it | Backup to `pre-push.ainative-backup` before writing ours; log warning |
| `.git/rebase-merge` present | User mid-rebase during `npm run dev` | Any git op might fail | `ensureLocalBranch()` detects the directory, skips branch creation, logs warning. User finishes rebase, next boot runs normally. |
| User sets `STAGENT_DEV_MODE=true` in production env by mistake | Env var leak from shell config | All guardrails disabled on a real instance | Non-issue — dev mode gate is opt-out; worst case user runs without guardrails until they remove the flag. Documented as safe. |
| Both dev-mode gates fail simultaneously on main dev repo | Contributor forgets env var AND sentinel is missing | Bootstrap runs in dev repo → creates `local` branch AND emits consent notification | Non-destructive Phase A is safe; Phase B is consent-gated so nothing breaks. User declines consent, manually deletes `local` branch if desired. |
| `notifications` table insert fails during consent creation | DB lock, disk full | Consent prompt missing, user never sees it | Log error, retry on next boot (consent state remains `not_yet`) |
| Settings write succeeds but consent notification insert fails | Partial failure mid-bootstrap | Inconsistent state | Wrap Phase A in a transaction where possible; for cross-table updates, use a reconciliation step on next boot that detects `consentStatus=not_yet` without a pending notification and re-creates it |

---

## File Structure

**New files:**
```
src/lib/instance/
  types.ts                    # InstanceConfig, Guardrails, EnsureResult, GitOps interfaces
  detect.ts                   # isDevMode(), hasGitDir(), isPrivateInstance(), detectRebaseInProgress()
  git-ops.ts                  # GitOps implementation + factory; injectable interface for tests
  settings.ts                 # getInstanceConfig(), setInstanceConfig(), getGuardrails(), setGuardrails()
  bootstrap.ts                # ensureInstance() orchestrator + Phase A/B functions + consent flow + hook template constant
  __tests__/
    detect.test.ts
    git-ops.test.ts
    settings.test.ts
    bootstrap.test.ts
```

**Modified files:**
```
src/instrumentation.ts        # Add ensureInstance() call before scheduler startup
```

---

## Task 1: Define types and interfaces

**Files:**
- Create: `src/lib/instance/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
/**
 * Instance bootstrap shared types.
 * See features/instance-bootstrap.md for full design rationale.
 */

export interface InstanceConfig {
  instanceId: string;
  branchName: string;
  isPrivateInstance: boolean;
  createdAt: number;
}

export type ConsentStatus = "not_yet" | "enabled" | "declined_permanently";

export interface Guardrails {
  prePushHookInstalled: boolean;
  prePushHookVersion: string;
  pushRemoteBlocked: string[];
  consentStatus: ConsentStatus;
  firstBootCompletedAt: number | null;
}

export type EnsureSkipReason =
  | "dev_mode_env"
  | "dev_mode_sentinel"
  | "no_git"
  | "rebase_in_progress";

export type EnsureStepStatus = "ok" | "skipped" | "failed";

export interface EnsureStepResult {
  step: string;
  status: EnsureStepStatus;
  reason?: string;
}

export interface EnsureResult {
  skipped?: EnsureSkipReason;
  steps: EnsureStepResult[];
}

/**
 * Injectable wrapper around git commands.
 * Real implementation in git-ops.ts uses execFileSync.
 * Tests provide a mock implementation.
 */
export interface GitOps {
  /** Returns true if the current working directory is inside a git repo (not a worktree of the main repo). */
  isGitRepo(): boolean;
  /** Returns the absolute path to the .git directory for the current repo. */
  getGitDir(): string;
  /** Returns the currently checked-out branch name, or null if detached HEAD. */
  getCurrentBranch(): string | null;
  /** Returns true if a branch with the given name exists locally. */
  branchExists(name: string): boolean;
  /** Creates a new branch at the current HEAD and checks it out. */
  createAndCheckoutBranch(name: string): void;
  /** Sets a git config value. Throws on failure. */
  setConfig(key: string, value: string): void;
}
```

- [ ] **Step 2: Run tsc to verify types compile**

Run: `npx tsc --noEmit src/lib/instance/types.ts`
Expected: No output (types valid)

- [ ] **Step 3: Commit**

```bash
git add src/lib/instance/types.ts
git commit -m "feat(instance): add type definitions for bootstrap module"
```

---

## Task 2: Implement detect.ts (dev-mode gates, git presence, private instance detection)

**Files:**
- Create: `src/lib/instance/detect.ts`
- Test: `src/lib/instance/__tests__/detect.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/instance/__tests__/detect.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir, homedir } from "os";

let tempDir: string;
let gitDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ainative-detect-"));
  gitDir = join(tempDir, ".git");
  mkdirSync(gitDir, { recursive: true });
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tempDir, { recursive: true, force: true });
});

async function loadDetect() {
  return await import("../detect");
}

describe("isDevMode", () => {
  it("returns true when STAGENT_DEV_MODE=true", async () => {
    vi.stubEnv("STAGENT_DEV_MODE", "true");
    const { isDevMode } = await loadDetect();
    expect(isDevMode(tempDir)).toBe(true);
  });

  it("returns true when .git/ainative-dev-mode sentinel file exists", async () => {
    writeFileSync(join(gitDir, "ainative-dev-mode"), "");
    const { isDevMode } = await loadDetect();
    expect(isDevMode(tempDir)).toBe(true);
  });

  it("returns false when neither gate is set", async () => {
    const { isDevMode } = await loadDetect();
    expect(isDevMode(tempDir)).toBe(false);
  });

  it("returns false when STAGENT_INSTANCE_MODE=true overrides env gate", async () => {
    vi.stubEnv("STAGENT_DEV_MODE", "true");
    vi.stubEnv("STAGENT_INSTANCE_MODE", "true");
    const { isDevMode } = await loadDetect();
    expect(isDevMode(tempDir)).toBe(false);
  });

  it("returns false when STAGENT_INSTANCE_MODE=true overrides sentinel gate", async () => {
    writeFileSync(join(gitDir, "ainative-dev-mode"), "");
    vi.stubEnv("STAGENT_INSTANCE_MODE", "true");
    const { isDevMode } = await loadDetect();
    expect(isDevMode(tempDir)).toBe(false);
  });
});

describe("hasGitDir", () => {
  it("returns true when .git directory exists", async () => {
    const { hasGitDir } = await loadDetect();
    expect(hasGitDir(tempDir)).toBe(true);
  });

  it("returns false when .git is absent", async () => {
    rmSync(gitDir, { recursive: true, force: true });
    const { hasGitDir } = await loadDetect();
    expect(hasGitDir(tempDir)).toBe(false);
  });
});

describe("isPrivateInstance", () => {
  it("returns false when STAGENT_DATA_DIR is unset", async () => {
    const { isPrivateInstance } = await loadDetect();
    expect(isPrivateInstance()).toBe(false);
  });

  it("returns false when STAGENT_DATA_DIR equals default ~/.ainative", async () => {
    vi.stubEnv("STAGENT_DATA_DIR", join(homedir(), ".ainative"));
    const { isPrivateInstance } = await loadDetect();
    expect(isPrivateInstance()).toBe(false);
  });

  it("returns true when STAGENT_DATA_DIR is a custom path", async () => {
    vi.stubEnv("STAGENT_DATA_DIR", "/Users/manavsehgal/.ainative-wealth");
    const { isPrivateInstance } = await loadDetect();
    expect(isPrivateInstance()).toBe(true);
  });
});

describe("detectRebaseInProgress", () => {
  it("returns true when .git/rebase-merge exists", async () => {
    mkdirSync(join(gitDir, "rebase-merge"));
    const { detectRebaseInProgress } = await loadDetect();
    expect(detectRebaseInProgress(tempDir)).toBe(true);
  });

  it("returns true when .git/rebase-apply exists", async () => {
    mkdirSync(join(gitDir, "rebase-apply"));
    const { detectRebaseInProgress } = await loadDetect();
    expect(detectRebaseInProgress(tempDir)).toBe(true);
  });

  it("returns false when no rebase state directories exist", async () => {
    const { detectRebaseInProgress } = await loadDetect();
    expect(detectRebaseInProgress(tempDir)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/instance/__tests__/detect.test.ts`
Expected: FAIL with "Cannot find module '../detect'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/instance/detect.ts
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Returns true if the current environment is the canonical ainative dev repo
 * and should skip all instance bootstrap operations.
 *
 * Layered gates:
 * 1. STAGENT_DEV_MODE=true env var (primary, per-developer)
 * 2. .git/ainative-dev-mode sentinel file (secondary, git-dir-scoped)
 *
 * Override: STAGENT_INSTANCE_MODE=true forces bootstrap to run even in dev
 * mode, so contributors can test the feature in the main repo.
 */
export function isDevMode(cwd: string = process.cwd()): boolean {
  // Opt-in override beats opt-out gates
  if (process.env.STAGENT_INSTANCE_MODE === "true") return false;

  // Gate 1: env var
  if (process.env.STAGENT_DEV_MODE === "true") return true;

  // Gate 2: sentinel file inside .git (never cloned, never committed)
  if (existsSync(join(cwd, ".git", "ainative-dev-mode"))) return true;

  return false;
}

/** Returns true if a .git directory exists at the given path. */
export function hasGitDir(cwd: string = process.cwd()): boolean {
  return existsSync(join(cwd, ".git"));
}

/**
 * Returns true if STAGENT_DATA_DIR is set to a non-default path,
 * indicating this clone is running as an isolated private instance.
 */
export function isPrivateInstance(): boolean {
  const override = process.env.STAGENT_DATA_DIR;
  if (!override) return false;
  const defaultDir = join(homedir(), ".ainative");
  return override !== defaultDir;
}

/**
 * Returns true if a rebase is in progress in the current repo.
 * Both rebase-merge (interactive) and rebase-apply (non-interactive) are detected.
 */
export function detectRebaseInProgress(cwd: string = process.cwd()): boolean {
  const gitDir = join(cwd, ".git");
  return (
    existsSync(join(gitDir, "rebase-merge")) ||
    existsSync(join(gitDir, "rebase-apply"))
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/instance/__tests__/detect.test.ts`
Expected: PASS — 13 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/instance/detect.ts src/lib/instance/__tests__/detect.test.ts
git commit -m "feat(instance): add dev-mode gates and clone detection"
```

---

## Task 3: Implement git-ops.ts with injectable interface

**Files:**
- Create: `src/lib/instance/git-ops.ts`
- Test: `src/lib/instance/__tests__/git-ops.test.ts`

- [ ] **Step 1: Write the failing test (uses a real temp-dir git repo)**

```typescript
// src/lib/instance/__tests__/git-ops.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

function runGit(args: string[], cwd: string) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ainative-git-ops-"));
  runGit(["init", "-b", "main"], tempDir);
  runGit(["config", "user.email", "test@example.com"], tempDir);
  runGit(["config", "user.name", "Test"], tempDir);
  writeFileSync(join(tempDir, "README.md"), "# test\n");
  runGit(["add", "README.md"], tempDir);
  runGit(["commit", "-m", "initial"], tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("RealGitOps", () => {
  it("isGitRepo returns true in a real repo", async () => {
    const { createGitOps } = await import("../git-ops");
    const ops = createGitOps(tempDir);
    expect(ops.isGitRepo()).toBe(true);
  });

  it("isGitRepo returns false outside a git repo", async () => {
    const nonRepo = mkdtempSync(join(tmpdir(), "ainative-nogit-"));
    try {
      const { createGitOps } = await import("../git-ops");
      const ops = createGitOps(nonRepo);
      expect(ops.isGitRepo()).toBe(false);
    } finally {
      rmSync(nonRepo, { recursive: true, force: true });
    }
  });

  it("getCurrentBranch returns main after init", async () => {
    const { createGitOps } = await import("../git-ops");
    const ops = createGitOps(tempDir);
    expect(ops.getCurrentBranch()).toBe("main");
  });

  it("branchExists returns true for main, false for missing", async () => {
    const { createGitOps } = await import("../git-ops");
    const ops = createGitOps(tempDir);
    expect(ops.branchExists("main")).toBe(true);
    expect(ops.branchExists("local")).toBe(false);
  });

  it("createAndCheckoutBranch creates local at current HEAD", async () => {
    const { createGitOps } = await import("../git-ops");
    const ops = createGitOps(tempDir);
    const mainSha = execFileSync("git", ["rev-parse", "main"], { cwd: tempDir, encoding: "utf-8" }).trim();
    ops.createAndCheckoutBranch("local");
    expect(ops.getCurrentBranch()).toBe("local");
    expect(ops.branchExists("local")).toBe(true);
    const localSha = execFileSync("git", ["rev-parse", "local"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(localSha).toBe(mainSha);
    // main is not modified
    const mainShaAfter = execFileSync("git", ["rev-parse", "main"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(mainShaAfter).toBe(mainSha);
  });

  it("setConfig writes branch.local.pushRemote", async () => {
    const { createGitOps } = await import("../git-ops");
    const ops = createGitOps(tempDir);
    ops.createAndCheckoutBranch("local");
    ops.setConfig("branch.local.pushRemote", "no_push");
    const value = execFileSync("git", ["config", "--get", "branch.local.pushRemote"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(value).toBe("no_push");
  });

  it("getGitDir returns absolute path to .git directory", async () => {
    const { createGitOps } = await import("../git-ops");
    const ops = createGitOps(tempDir);
    expect(ops.getGitDir()).toBe(join(tempDir, ".git"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/instance/__tests__/git-ops.test.ts`
Expected: FAIL with "Cannot find module '../git-ops'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/instance/git-ops.ts
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import type { GitOps } from "./types";

/**
 * Real git operations wrapper. All commands use execFileSync with argv arrays —
 * no shell interpolation, ever. File is the literal "git"; user-provided values
 * flow through the args array which git parses without shell involvement.
 */
export function createGitOps(cwd: string = process.cwd()): GitOps {
  function run(args: string[]): string {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  }

  return {
    isGitRepo(): boolean {
      try {
        run(["rev-parse", "--is-inside-work-tree"]);
        return true;
      } catch {
        return false;
      }
    },

    getGitDir(): string {
      return join(cwd, ".git");
    },

    getCurrentBranch(): string | null {
      try {
        const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
        return branch === "HEAD" ? null : branch;
      } catch {
        return null;
      }
    },

    branchExists(name: string): boolean {
      try {
        run(["rev-parse", "--verify", `refs/heads/${name}`]);
        return true;
      } catch {
        return false;
      }
    },

    createAndCheckoutBranch(name: string): void {
      run(["checkout", "-b", name]);
    },

    setConfig(key: string, value: string): void {
      run(["config", key, value]);
    },
  };
}

/** Test helper: detect if execFileSync would find git on this system. */
export function isGitAvailable(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/instance/__tests__/git-ops.test.ts`
Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/instance/git-ops.ts src/lib/instance/__tests__/git-ops.test.ts
git commit -m "feat(instance): add injectable git-ops wrapper"
```

---

## Task 4: Implement settings.ts (typed wrappers around settings table)

**Files:**
- Create: `src/lib/instance/settings.ts`
- Test: `src/lib/instance/__tests__/settings.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/instance/__tests__/settings.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ainative-instance-settings-"));
  vi.resetModules();
  vi.stubEnv("STAGENT_DATA_DIR", tempDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tempDir, { recursive: true, force: true });
});

async function loadModule() {
  return await import("../settings");
}

describe("getInstanceConfig / setInstanceConfig", () => {
  it("returns null before any config is written", async () => {
    const { getInstanceConfig } = await loadModule();
    expect(getInstanceConfig()).toBeNull();
  });

  it("round-trips a config through set/get", async () => {
    const { setInstanceConfig, getInstanceConfig } = await loadModule();
    setInstanceConfig({
      instanceId: "abc-123",
      branchName: "local",
      isPrivateInstance: false,
      createdAt: 1700000000,
    });
    const config = getInstanceConfig();
    expect(config).toEqual({
      instanceId: "abc-123",
      branchName: "local",
      isPrivateInstance: false,
      createdAt: 1700000000,
    });
  });

  it("returns null when stored value is corrupt JSON", async () => {
    const { getSettingSync, setSetting } = await import("@/lib/settings/helpers");
    await setSetting("instance", "not-valid-json");
    const { getInstanceConfig } = await loadModule();
    expect(getInstanceConfig()).toBeNull();
    // Sanity: raw value is still the corrupt string
    expect(getSettingSync("instance")).toBe("not-valid-json");
  });
});

describe("getGuardrails / setGuardrails", () => {
  it("returns defaults before any guardrails are written", async () => {
    const { getGuardrails } = await loadModule();
    expect(getGuardrails()).toEqual({
      prePushHookInstalled: false,
      prePushHookVersion: "",
      pushRemoteBlocked: [],
      consentStatus: "not_yet",
      firstBootCompletedAt: null,
    });
  });

  it("round-trips guardrails through set/get", async () => {
    const { setGuardrails, getGuardrails } = await loadModule();
    setGuardrails({
      prePushHookInstalled: true,
      prePushHookVersion: "1.0.0",
      pushRemoteBlocked: ["local", "wealth-mgr"],
      consentStatus: "enabled",
      firstBootCompletedAt: 1700000000,
    });
    expect(getGuardrails()).toEqual({
      prePushHookInstalled: true,
      prePushHookVersion: "1.0.0",
      pushRemoteBlocked: ["local", "wealth-mgr"],
      consentStatus: "enabled",
      firstBootCompletedAt: 1700000000,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/instance/__tests__/settings.test.ts`
Expected: FAIL with "Cannot find module '../settings'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/instance/settings.ts
import { getSettingSync, setSetting } from "@/lib/settings/helpers";
import type { InstanceConfig, Guardrails } from "./types";

const INSTANCE_KEY = "instance";
const GUARDRAILS_KEY = "instance.guardrails";

const DEFAULT_GUARDRAILS: Guardrails = {
  prePushHookInstalled: false,
  prePushHookVersion: "",
  pushRemoteBlocked: [],
  consentStatus: "not_yet",
  firstBootCompletedAt: null,
};

function readJson<T>(key: string): T | null {
  const raw = getSettingSync(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getInstanceConfig(): InstanceConfig | null {
  return readJson<InstanceConfig>(INSTANCE_KEY);
}

export function setInstanceConfig(config: InstanceConfig): void {
  // setSetting is async but wraps a sync better-sqlite3 call;
  // fire-and-forget is safe here because the underlying operation completes synchronously.
  void setSetting(INSTANCE_KEY, JSON.stringify(config));
}

export function getGuardrails(): Guardrails {
  return readJson<Guardrails>(GUARDRAILS_KEY) ?? { ...DEFAULT_GUARDRAILS };
}

export function setGuardrails(guardrails: Guardrails): void {
  void setSetting(GUARDRAILS_KEY, JSON.stringify(guardrails));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/instance/__tests__/settings.test.ts`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/instance/settings.ts src/lib/instance/__tests__/settings.test.ts
git commit -m "feat(instance): add typed settings helpers for instance config"
```

---

## Task 5: Implement Phase A of bootstrap (instanceId + local branch creation)

**Files:**
- Create: `src/lib/instance/bootstrap.ts` (partial — Phase A only this task)
- Test: `src/lib/instance/__tests__/bootstrap.test.ts` (partial)

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/instance/__tests__/bootstrap.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { GitOps } from "../types";

let tempDir: string;
let dataDir: string;

function runGit(args: string[], cwd: string) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function initRepo(dir: string) {
  runGit(["init", "-b", "main"], dir);
  runGit(["config", "user.email", "test@example.com"], dir);
  runGit(["config", "user.name", "Test"], dir);
  writeFileSync(join(dir, "README.md"), "# test\n");
  runGit(["add", "README.md"], dir);
  runGit(["commit", "-m", "initial"], dir);
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ainative-bootstrap-repo-"));
  dataDir = mkdtempSync(join(tmpdir(), "ainative-bootstrap-data-"));
  initRepo(tempDir);
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("STAGENT_DATA_DIR", dataDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tempDir, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
});

describe("ensureInstanceConfig (Phase A)", () => {
  it("generates a new instanceId on first call", async () => {
    const { ensureInstanceConfig } = await import("../bootstrap");
    const result = ensureInstanceConfig(tempDir);
    expect(result.status).toBe("ok");
    const { getInstanceConfig } = await import("../settings");
    const config = getInstanceConfig();
    expect(config).not.toBeNull();
    expect(config!.instanceId).toMatch(/^[a-f0-9-]{36}$/);
    expect(config!.branchName).toBe("local");
    expect(config!.isPrivateInstance).toBe(false);
    expect(config!.createdAt).toBeGreaterThan(0);
  });

  it("does not regenerate instanceId on subsequent calls", async () => {
    const { ensureInstanceConfig } = await import("../bootstrap");
    ensureInstanceConfig(tempDir);
    const { getInstanceConfig } = await import("../settings");
    const firstId = getInstanceConfig()!.instanceId;
    ensureInstanceConfig(tempDir);
    const secondId = getInstanceConfig()!.instanceId;
    expect(secondId).toBe(firstId);
  });
});

describe("ensureLocalBranch (Phase A)", () => {
  it("creates local branch at current HEAD when it does not exist", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureLocalBranch } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    const mainSha = execFileSync("git", ["rev-parse", "main"], { cwd: tempDir, encoding: "utf-8" }).trim();
    const result = ensureLocalBranch(ops);
    expect(result.status).toBe("ok");
    expect(ops.branchExists("local")).toBe(true);
    expect(ops.getCurrentBranch()).toBe("local");
    const localSha = execFileSync("git", ["rev-parse", "local"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(localSha).toBe(mainSha);
    const mainShaAfter = execFileSync("git", ["rev-parse", "main"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(mainShaAfter).toBe(mainSha);
  });

  it("is a no-op when local branch already exists", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureLocalBranch } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    ops.createAndCheckoutBranch("local");
    const shaBefore = execFileSync("git", ["rev-parse", "local"], { cwd: tempDir, encoding: "utf-8" }).trim();
    const result = ensureLocalBranch(ops);
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("branch_exists");
    const shaAfter = execFileSync("git", ["rev-parse", "local"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(shaAfter).toBe(shaBefore);
  });

  it("creates local at current HEAD even when user has local commits on main", async () => {
    // Simulate user with commits on main that diverge from origin
    writeFileSync(join(tempDir, "custom.txt"), "user work\n");
    runGit(["add", "custom.txt"], tempDir);
    runGit(["commit", "-m", "user customization"], tempDir);
    const mainSha = execFileSync("git", ["rev-parse", "main"], { cwd: tempDir, encoding: "utf-8" }).trim();

    const { createGitOps } = await import("../git-ops");
    const { ensureLocalBranch } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    const result = ensureLocalBranch(ops);

    expect(result.status).toBe("ok");
    expect(ops.branchExists("local")).toBe(true);
    // local points at the user's customized HEAD, not origin/main
    const localSha = execFileSync("git", ["rev-parse", "local"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(localSha).toBe(mainSha);
    // main is unchanged
    const mainShaAfter = execFileSync("git", ["rev-parse", "main"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(mainShaAfter).toBe(mainSha);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts`
Expected: FAIL with "Cannot find module '../bootstrap'"

- [ ] **Step 3: Write the Phase A implementation**

```typescript
// src/lib/instance/bootstrap.ts
import { randomUUID } from "crypto";
import type { EnsureStepResult, GitOps } from "./types";
import { getInstanceConfig, setInstanceConfig } from "./settings";
import { isPrivateInstance } from "./detect";

const DEFAULT_BRANCH_NAME = "local";

/**
 * Phase A step 1: ensure the instance config row exists with a stable instanceId.
 * Idempotent — returns early if config already exists.
 */
export function ensureInstanceConfig(_cwd: string = process.cwd()): EnsureStepResult {
  const existing = getInstanceConfig();
  if (existing) {
    return { step: "instance-config", status: "skipped", reason: "already_exists" };
  }
  setInstanceConfig({
    instanceId: randomUUID(),
    branchName: DEFAULT_BRANCH_NAME,
    isPrivateInstance: isPrivateInstance(),
    createdAt: Math.floor(Date.now() / 1000),
  });
  return { step: "instance-config", status: "ok" };
}

/**
 * Phase A step 2: create the `local` branch at current HEAD if it doesn't exist.
 * Non-destructive: `git checkout -b local` preserves whatever branch the user
 * was on, including any local commits. Safe on drifted-main scenarios.
 */
export function ensureLocalBranch(git: GitOps): EnsureStepResult {
  if (git.branchExists(DEFAULT_BRANCH_NAME)) {
    return { step: "local-branch", status: "skipped", reason: "branch_exists" };
  }
  try {
    git.createAndCheckoutBranch(DEFAULT_BRANCH_NAME);
    return { step: "local-branch", status: "ok" };
  } catch (err) {
    return {
      step: "local-branch",
      status: "failed",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts`
Expected: PASS — 5 tests passing (two in ensureInstanceConfig, three in ensureLocalBranch)

- [ ] **Step 5: Commit**

```bash
git add src/lib/instance/bootstrap.ts src/lib/instance/__tests__/bootstrap.test.ts
git commit -m "feat(instance): implement bootstrap Phase A (config + local branch)"
```

---

## Task 6: Implement Phase B (pre-push hook install + pushRemote config)

**Files:**
- Modify: `src/lib/instance/bootstrap.ts` (append Phase B functions + hook template)
- Modify: `src/lib/instance/__tests__/bootstrap.test.ts` (append Phase B tests)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/instance/__tests__/bootstrap.test.ts`:

```typescript
import { existsSync, readFileSync, statSync, chmodSync } from "fs";

describe("ensurePrePushHook (Phase B)", () => {
  it("writes a pre-push hook with the STAGENT_HOOK_VERSION marker", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensurePrePushHook } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    const result = ensurePrePushHook(ops);
    expect(result.status).toBe("ok");
    const hookPath = join(tempDir, ".git", "hooks", "pre-push");
    expect(existsSync(hookPath)).toBe(true);
    const content = readFileSync(hookPath, "utf-8");
    expect(content).toContain("STAGENT_HOOK_VERSION=");
    expect(content).toContain("ALLOW_PRIVATE_PUSH");
    // Executable bit set
    const mode = statSync(hookPath).mode & 0o777;
    expect(mode & 0o100).toBeTruthy();
  });

  it("is a no-op when a hook with matching version already exists", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensurePrePushHook } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    ensurePrePushHook(ops); // first install
    const firstMtime = statSync(join(tempDir, ".git", "hooks", "pre-push")).mtimeMs;
    // Wait briefly then call again
    const result = ensurePrePushHook(ops);
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("already_installed");
    const secondMtime = statSync(join(tempDir, ".git", "hooks", "pre-push")).mtimeMs;
    expect(secondMtime).toBe(firstMtime);
  });

  it("backs up a pre-existing non-ainative hook before installing", async () => {
    const customHook = "#!/bin/sh\necho custom hook\n";
    writeFileSync(join(tempDir, ".git", "hooks", "pre-push"), customHook);
    chmodSync(join(tempDir, ".git", "hooks", "pre-push"), 0o755);
    const { createGitOps } = await import("../git-ops");
    const { ensurePrePushHook } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    const result = ensurePrePushHook(ops);
    expect(result.status).toBe("ok");
    const backupPath = join(tempDir, ".git", "hooks", "pre-push.ainative-backup");
    expect(existsSync(backupPath)).toBe(true);
    expect(readFileSync(backupPath, "utf-8")).toBe(customHook);
    // Ours is now installed
    expect(readFileSync(join(tempDir, ".git", "hooks", "pre-push"), "utf-8"))
      .toContain("STAGENT_HOOK_VERSION=");
  });
});

describe("ensureBranchPushConfig (Phase B)", () => {
  it("sets branch.local.pushRemote=no_push", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureLocalBranch, ensureBranchPushConfig } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    ensureLocalBranch(ops);
    const result = ensureBranchPushConfig(ops, ["local"]);
    expect(result.status).toBe("ok");
    const value = execFileSync("git", ["config", "--get", "branch.local.pushRemote"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(value).toBe("no_push");
  });

  it("handles multiple blocked branches", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureBranchPushConfig } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    ops.createAndCheckoutBranch("wealth-mgr");
    ops.createAndCheckoutBranch("investor-mgr");
    const result = ensureBranchPushConfig(ops, ["wealth-mgr", "investor-mgr"]);
    expect(result.status).toBe("ok");
    expect(execFileSync("git", ["config", "--get", "branch.wealth-mgr.pushRemote"], { cwd: tempDir, encoding: "utf-8" }).trim()).toBe("no_push");
    expect(execFileSync("git", ["config", "--get", "branch.investor-mgr.pushRemote"], { cwd: tempDir, encoding: "utf-8" }).trim()).toBe("no_push");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts`
Expected: FAIL with "ensurePrePushHook is not a function" or similar import error

- [ ] **Step 3: Append the Phase B implementation**

Append to `src/lib/instance/bootstrap.ts`:

```typescript
import { existsSync, readFileSync, writeFileSync, chmodSync, renameSync } from "fs";
import { join } from "path";

export const STAGENT_HOOK_VERSION = "1.0.0";

/**
 * Pre-push hook template. Installed verbatim at .git/hooks/pre-push.
 *
 * Reads the blocked branch list from the ainative SQLite settings table
 * via a bounded sqlite3 invocation. The query is hardcoded — no user
 * input reaches the shell.
 *
 * Escape hatch: set ALLOW_PRIVATE_PUSH=1 in env to bypass the guardrail
 * for legitimate cherry-pick pushes.
 */
const PRE_PUSH_HOOK_TEMPLATE = `#!/bin/sh
# STAGENT_HOOK_VERSION=${STAGENT_HOOK_VERSION}
# Blocks pushes of private instance branches to origin.
# Escape hatch: ALLOW_PRIVATE_PUSH=1 git push ...
#
# Generated by src/lib/instance/bootstrap.ts — do not edit manually.

if [ "$ALLOW_PRIVATE_PUSH" = "1" ]; then
  exit 0
fi

current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ -z "$current_branch" ]; then
  exit 0
fi

# Read blocked branches from ainative settings (JSON array).
data_dir="\${STAGENT_DATA_DIR:-$HOME/.ainative}"
db_path="$data_dir/ainative.db"
if [ ! -f "$db_path" ] || ! command -v sqlite3 >/dev/null 2>&1; then
  exit 0
fi

blocked_json=$(sqlite3 "$db_path" "SELECT value FROM settings WHERE key='instance.guardrails';" 2>/dev/null)
if [ -z "$blocked_json" ]; then
  exit 0
fi

# Extract pushRemoteBlocked array entries without jq dependency
if echo "$blocked_json" | grep -q "\\"$current_branch\\""; then
  echo "ainative: refusing to push private instance branch '$current_branch' to origin." >&2
  echo "ainative: set ALLOW_PRIVATE_PUSH=1 to override (not recommended)." >&2
  exit 1
fi

exit 0
`;

/**
 * Phase B step 1: install the pre-push hook at .git/hooks/pre-push.
 * Idempotent: checks version marker in existing file; backs up foreign hooks.
 */
export function ensurePrePushHook(git: GitOps): EnsureStepResult {
  const hookPath = join(git.getGitDir(), "hooks", "pre-push");
  const markerLine = `STAGENT_HOOK_VERSION=${STAGENT_HOOK_VERSION}`;

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf-8");
    if (existing.includes(markerLine)) {
      return { step: "pre-push-hook", status: "skipped", reason: "already_installed" };
    }
    if (existing.includes("STAGENT_HOOK_VERSION=")) {
      // Older ainative version — overwrite without backup
      try {
        writeFileSync(hookPath, PRE_PUSH_HOOK_TEMPLATE, { mode: 0o755 });
        return { step: "pre-push-hook", status: "ok", reason: "upgraded" };
      } catch (err) {
        return {
          step: "pre-push-hook",
          status: "failed",
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }
    // Foreign hook — back it up
    try {
      renameSync(hookPath, `${hookPath}.ainative-backup`);
    } catch (err) {
      return {
        step: "pre-push-hook",
        status: "failed",
        reason: `backup_failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  try {
    writeFileSync(hookPath, PRE_PUSH_HOOK_TEMPLATE, { mode: 0o755 });
    chmodSync(hookPath, 0o755);
    return { step: "pre-push-hook", status: "ok" };
  } catch (err) {
    return {
      step: "pre-push-hook",
      status: "failed",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Phase B step 2: set branch.<name>.pushRemote=no_push for each blocked branch.
 * Idempotent via git config semantics (setting the same value is a no-op).
 */
export function ensureBranchPushConfig(git: GitOps, branches: string[]): EnsureStepResult {
  const failures: string[] = [];
  for (const branch of branches) {
    try {
      git.setConfig(`branch.${branch}.pushRemote`, "no_push");
    } catch (err) {
      failures.push(`${branch}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (failures.length > 0) {
    return {
      step: "branch-push-config",
      status: "failed",
      reason: failures.join("; "),
    };
  }
  return { step: "branch-push-config", status: "ok" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts`
Expected: PASS — 10 tests total (5 Phase A + 5 Phase B)

- [ ] **Step 5: Commit**

```bash
git add src/lib/instance/bootstrap.ts src/lib/instance/__tests__/bootstrap.test.ts
git commit -m "feat(instance): implement bootstrap Phase B (hook + pushRemote)"
```

---

## Task 7: Add consent state management (settings-only, no schema changes)

**Rationale:** The `notifications.type` column (src/lib/db/schema.ts:93-103) is a strict enum with 8 values; adding `instance_guardrails_consent` would be a schema change, which the feature spec forbids. Instead, consent state lives entirely in `settings.instance.guardrails.consentStatus` — a data fact this feature owns. The UI surface for the consent prompt belongs to `upgrade-session` (Settings → Instance section), not `instance-bootstrap`. This strengthens the feature boundary: `instance-bootstrap` writes data, `upgrade-session` renders it.

**Effect on behavior:** Until `upgrade-session` ships, users who clone the repo get Phase A (local branch, instanceId) but NOT Phase B guardrails by default. That is the safer default — destructive operations require explicit opt-in. Users who already want the guardrails can set `consentStatus=enabled` manually via a SQL update or, post-`upgrade-session`, via the Settings UI.

**Files:**
- Modify: `src/lib/instance/bootstrap.ts` (append `resolveConsentDecision()` helper)
- Modify: `src/lib/instance/__tests__/bootstrap.test.ts` (append consent tests)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/instance/__tests__/bootstrap.test.ts`:

```typescript
describe("resolveConsentDecision", () => {
  it("returns {shouldRunPhaseB: false, reason: 'not_yet'} when consent is not_yet (default)", async () => {
    const { resolveConsentDecision } = await import("../bootstrap");
    const decision = resolveConsentDecision();
    expect(decision.shouldRunPhaseB).toBe(false);
    expect(decision.reason).toBe("not_yet");
  });

  it("returns {shouldRunPhaseB: true} when consent is enabled", async () => {
    const { setGuardrails } = await import("../settings");
    setGuardrails({
      prePushHookInstalled: false,
      prePushHookVersion: "",
      pushRemoteBlocked: [],
      consentStatus: "enabled",
      firstBootCompletedAt: null,
    });
    const { resolveConsentDecision } = await import("../bootstrap");
    const decision = resolveConsentDecision();
    expect(decision.shouldRunPhaseB).toBe(true);
    expect(decision.reason).toBe("enabled");
  });

  it("returns {shouldRunPhaseB: false, reason: 'declined_permanently'}", async () => {
    const { setGuardrails } = await import("../settings");
    setGuardrails({
      prePushHookInstalled: false,
      prePushHookVersion: "",
      pushRemoteBlocked: [],
      consentStatus: "declined_permanently",
      firstBootCompletedAt: null,
    });
    const { resolveConsentDecision } = await import("../bootstrap");
    const decision = resolveConsentDecision();
    expect(decision.shouldRunPhaseB).toBe(false);
    expect(decision.reason).toBe("declined_permanently");
  });

  it("initializes guardrails row with consentStatus='not_yet' on first call if settings has no row", async () => {
    const { getGuardrails, setGuardrails } = await import("../settings");
    // Verify nothing written yet — getGuardrails returns defaults
    expect(getGuardrails().consentStatus).toBe("not_yet");
    // First call should upsert the row so downstream reads are stable
    const { resolveConsentDecision } = await import("../bootstrap");
    resolveConsentDecision();
    // Still "not_yet" but now explicitly persisted
    const after = getGuardrails();
    expect(after.consentStatus).toBe("not_yet");
    expect(after.firstBootCompletedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts`
Expected: FAIL — "resolveConsentDecision is not a function"

- [ ] **Step 3: Implement the consent helper**

Append to `src/lib/instance/bootstrap.ts`:

```typescript
import { getGuardrails, setGuardrails } from "./settings";
import type { ConsentStatus } from "./types";

export interface ConsentDecision {
  shouldRunPhaseB: boolean;
  reason: ConsentStatus;
}

/**
 * Reads the current consent status from settings and returns a decision
 * about whether Phase B (destructive guardrail installation) should run.
 *
 * On first call, stamps firstBootCompletedAt so the system has a record
 * that bootstrap has run at least once. This enables the upgrade-session
 * feature to distinguish "never booted" from "booted but consent not yet
 * given" in its Settings → Instance UI.
 *
 * Does NOT create any UI artifact. The prompt surface is owned by
 * upgrade-session, which renders a "Enable guardrails" action in the
 * Settings → Instance section reading from settings.instance.guardrails.
 */
export function resolveConsentDecision(): ConsentDecision {
  const current = getGuardrails();

  // Stamp first-boot timestamp on first call
  if (current.firstBootCompletedAt === null) {
    setGuardrails({
      ...current,
      firstBootCompletedAt: Math.floor(Date.now() / 1000),
    });
  }

  return {
    shouldRunPhaseB: current.consentStatus === "enabled",
    reason: current.consentStatus,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts`
Expected: PASS — 14 tests total (10 previous + 4 consent)

- [ ] **Step 5: Commit**

```bash
git add src/lib/instance/bootstrap.ts src/lib/instance/__tests__/bootstrap.test.ts
git commit -m "feat(instance): add settings-based consent resolution"
```

---

## Task 8: Implement ensureInstance() orchestrator

**Files:**
- Modify: `src/lib/instance/bootstrap.ts` (append orchestrator)
- Modify: `src/lib/instance/__tests__/bootstrap.test.ts` (append orchestrator tests)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/instance/__tests__/bootstrap.test.ts`:

```typescript
describe("ensureInstance orchestrator", () => {
  it("returns skipped with dev_mode_env when STAGENT_DEV_MODE=true", async () => {
    vi.stubEnv("STAGENT_DEV_MODE", "true");
    const { ensureInstance } = await import("../bootstrap");
    const result = ensureInstance(tempDir);
    expect(result.skipped).toBe("dev_mode_env");
    expect(result.steps).toEqual([]);
    // Verify zero side effects
    expect(existsSync(join(tempDir, ".git", "hooks", "pre-push"))).toBe(false);
    const { createGitOps } = await import("../git-ops");
    expect(createGitOps(tempDir).branchExists("local")).toBe(false);
  });

  it("returns skipped with dev_mode_sentinel when sentinel file exists", async () => {
    writeFileSync(join(tempDir, ".git", "ainative-dev-mode"), "");
    const { ensureInstance } = await import("../bootstrap");
    const result = ensureInstance(tempDir);
    expect(result.skipped).toBe("dev_mode_sentinel");
    expect(result.steps).toEqual([]);
  });

  it("returns skipped with no_git when .git directory is absent", async () => {
    const noGitDir = mkdtempSync(join(tmpdir(), "ainative-nogit-"));
    try {
      const { ensureInstance } = await import("../bootstrap");
      const result = ensureInstance(noGitDir);
      expect(result.skipped).toBe("no_git");
    } finally {
      rmSync(noGitDir, { recursive: true, force: true });
    }
  });

  it("runs Phase A and stamps consent state on fresh clone (consent not_yet)", async () => {
    const { ensureInstance } = await import("../bootstrap");
    const result = ensureInstance(tempDir);
    expect(result.skipped).toBeUndefined();
    const steps = result.steps.map((s) => s.step);
    expect(steps).toContain("instance-config");
    expect(steps).toContain("local-branch");
    // Phase B skipped because consent is not_yet (no "consent" step — consent is resolved inline, not a step)
    expect(steps).not.toContain("pre-push-hook");
    expect(steps).not.toContain("branch-push-config");
    // local branch exists
    const { createGitOps } = await import("../git-ops");
    expect(createGitOps(tempDir).branchExists("local")).toBe(true);
    // hook not installed
    expect(existsSync(join(tempDir, ".git", "hooks", "pre-push"))).toBe(false);
    // Guardrails row has been stamped with firstBootCompletedAt
    const { getGuardrails } = await import("../settings");
    expect(getGuardrails().firstBootCompletedAt).not.toBeNull();
    expect(getGuardrails().consentStatus).toBe("not_yet");
  });

  it("runs Phase B when consent is enabled", async () => {
    const { setGuardrails } = await import("../settings");
    setGuardrails({
      prePushHookInstalled: false,
      prePushHookVersion: "",
      pushRemoteBlocked: [],
      consentStatus: "enabled",
      firstBootCompletedAt: null,
    });
    const { ensureInstance } = await import("../bootstrap");
    const result = ensureInstance(tempDir);
    const steps = result.steps.map((s) => s.step);
    expect(steps).toContain("pre-push-hook");
    expect(steps).toContain("branch-push-config");
    expect(existsSync(join(tempDir, ".git", "hooks", "pre-push"))).toBe(true);
  });

  it("STAGENT_INSTANCE_MODE=true override beats STAGENT_DEV_MODE=true", async () => {
    vi.stubEnv("STAGENT_DEV_MODE", "true");
    vi.stubEnv("STAGENT_INSTANCE_MODE", "true");
    const { ensureInstance } = await import("../bootstrap");
    const result = ensureInstance(tempDir);
    expect(result.skipped).toBeUndefined();
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it("is a full no-op on the second call (idempotent)", async () => {
    const { ensureInstance } = await import("../bootstrap");
    ensureInstance(tempDir);
    const result = ensureInstance(tempDir);
    // All Phase A steps return skipped
    for (const step of result.steps) {
      if (step.step === "instance-config" || step.step === "local-branch") {
        expect(step.status).toBe("skipped");
      }
    }
  });

  it("skips ensureLocalBranch with warning when rebase is in progress", async () => {
    mkdirSync(join(tempDir, ".git", "rebase-merge"));
    const { ensureInstance } = await import("../bootstrap");
    const result = ensureInstance(tempDir);
    const branchStep = result.steps.find((s) => s.step === "local-branch");
    expect(branchStep?.status).toBe("skipped");
    expect(branchStep?.reason).toBe("rebase_in_progress");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts`
Expected: FAIL — "ensureInstance is not a function"

- [ ] **Step 3: Implement the orchestrator**

Append to `src/lib/instance/bootstrap.ts`:

```typescript
import { isDevMode, hasGitDir, detectRebaseInProgress } from "./detect";
import { createGitOps } from "./git-ops";
import type { EnsureResult } from "./types";

/**
 * Main entry point called from src/instrumentation.ts.
 * Idempotent — safe to run on every boot.
 *
 * Execution order:
 * 1. Dev-mode gates (env + sentinel) — skip entirely if active
 * 2. .git presence check — skip if absent (npx runtime)
 * 3. Phase A: instanceId, local branch (non-destructive, always runs)
 * 4. Consent: create first-boot notification if status=not_yet
 * 5. Phase B: pre-push hook, pushRemote config (only if consent=enabled)
 */
export function ensureInstance(cwd: string = process.cwd()): EnsureResult {
  if (isDevMode(cwd)) {
    const reason = process.env.STAGENT_DEV_MODE === "true" ? "dev_mode_env" : "dev_mode_sentinel";
    return { skipped: reason, steps: [] };
  }

  if (!hasGitDir(cwd)) {
    return { skipped: "no_git", steps: [] };
  }

  const steps: EnsureStepResult[] = [];
  const git = createGitOps(cwd);

  // Phase A step 1: instance config
  steps.push(ensureInstanceConfig(cwd));

  // Phase A step 2: local branch — skip if rebase in progress
  if (detectRebaseInProgress(cwd)) {
    steps.push({ step: "local-branch", status: "skipped", reason: "rebase_in_progress" });
  } else {
    steps.push(ensureLocalBranch(git));
  }

  // Resolve consent (stamps firstBootCompletedAt on first call, returns decision)
  const decision = resolveConsentDecision();

  // Phase B — only if user has explicitly enabled guardrails
  if (decision.shouldRunPhaseB) {
    steps.push(ensurePrePushHook(git));

    const config = getInstanceConfig();
    const blockedBranches = config ? [config.branchName] : [];
    if (blockedBranches.length > 0) {
      steps.push(ensureBranchPushConfig(git, blockedBranches));
    }
  }

  return { steps };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts`
Expected: PASS — 22 tests total (14 previous + 8 orchestrator)

- [ ] **Step 5: Commit**

```bash
git add src/lib/instance/bootstrap.ts src/lib/instance/__tests__/bootstrap.test.ts
git commit -m "feat(instance): implement ensureInstance orchestrator with layered gates"
```

---

## Task 9: Integrate ensureInstance into instrumentation.ts

**Files:**
- Modify: `src/instrumentation.ts`

- [ ] **Step 1: Add a test that verifies instrumentation imports and calls ensureInstance**

This integration is hard to unit test because `instrumentation.ts` is a Next.js lifecycle hook. Instead, add a smoke test that verifies the import path is correct and the function returns without throwing in dev mode.

Create `src/__tests__/instrumentation-smoke.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

describe("instrumentation register()", () => {
  it("calls ensureInstance without throwing when NEXT_RUNTIME=nodejs and dev mode", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("STAGENT_DEV_MODE", "true");
    // All other startup calls mocked to no-ops would complicate the test.
    // We only need to verify the new ensureInstance import path resolves.
    const { ensureInstance } = await import("@/lib/instance/bootstrap");
    const result = ensureInstance();
    expect(result.skipped).toBe("dev_mode_env");
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Run smoke test to verify import resolves**

Run: `npx vitest run src/__tests__/instrumentation-smoke.test.ts`
Expected: PASS

- [ ] **Step 3: Modify `src/instrumentation.ts` to call ensureInstance before scheduler startup**

```typescript
// src/instrumentation.ts
export async function register() {
  // Only start background services on the server (not during build or edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Instance bootstrap — creates local branch, handles dev-mode gates, consent flow.
      // Runs BEFORE scheduler so instance config is available to scheduled polling.
      const { ensureInstance } = await import("@/lib/instance/bootstrap");
      const result = ensureInstance();
      if (result.skipped) {
        console.log(`[instance] bootstrap skipped: ${result.skipped}`);
      } else {
        for (const step of result.steps) {
          if (step.status === "failed") {
            console.error(`[instance] ${step.step} failed: ${step.reason}`);
          }
        }
      }

      // License manager — initialize from DB (creates default row if needed)
      const { licenseManager } = await import("@/lib/license/manager");
      licenseManager.initialize();
      licenseManager.startValidationTimer();

      const { startScheduler } = await import("@/lib/schedules/scheduler");
      startScheduler();

      const { startChannelPoller } = await import("@/lib/channels/poller");
      startChannelPoller();

      const { startAutoBackup } = await import("@/lib/snapshots/auto-backup");
      startAutoBackup();

      // History retention cleanup — prunes old agent_logs and usage_ledger
      // based on tier retention limit (Community: 30 days)
      startHistoryCleanup(licenseManager);

      // Telemetry batch flush (opt-in, every 5 minutes)
      const { startTelemetryFlush } = await import("@/lib/telemetry/queue");
      startTelemetryFlush();
    } catch (err) {
      console.error("Instrumentation startup failed:", err);
    }
  }
}

async function startHistoryCleanup(licenseManager: { getLimit: (r: "historyRetentionDays") => number }) {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  async function cleanup() {
    const retentionDays = licenseManager.getLimit("historyRetentionDays");
    if (!Number.isFinite(retentionDays)) return; // Unlimited retention

    const { db } = await import("@/lib/db");
    const { agentLogs, usageLedger } = await import("@/lib/db/schema");
    const { lt } = await import("drizzle-orm");

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    db.delete(agentLogs).where(lt(agentLogs.timestamp, cutoff)).run();
    db.delete(usageLedger).where(lt(usageLedger.startedAt, cutoff)).run();
  }

  // Run once at startup, then daily
  cleanup().catch(() => {});
  setInterval(() => cleanup().catch(() => {}), CLEANUP_INTERVAL);
}
```

- [ ] **Step 4: Run the smoke test and full instance test suite**

Run: `npx vitest run src/__tests__/instrumentation-smoke.test.ts src/lib/instance/`
Expected: PASS — all tests still passing

- [ ] **Step 5: Commit**

```bash
git add src/instrumentation.ts src/__tests__/instrumentation-smoke.test.ts
git commit -m "feat(instance): wire ensureInstance into instrumentation hook"
```

---

## Task 10: Manual verification in main dev repo

**Files:**
- None (manual verification)

- [ ] **Step 1: Confirm dev-mode gates are active in this clone**

Run these commands and verify expected output:

```bash
cd /Users/manavsehgal/Developer/ainative
grep "STAGENT_DEV_MODE=true" .env.local && echo "env gate: OK"
ls .git/ainative-dev-mode && echo "sentinel gate: OK"
```

Expected: both `env gate: OK` and `sentinel gate: OK` printed.

- [ ] **Step 2: Record current git state**

```bash
git branch | grep -E "^\*" > /tmp/ainative-pre-branch.txt
git config --get branch.main.pushRemote > /tmp/ainative-pre-pushremote.txt 2>/dev/null || echo "(not set)" > /tmp/ainative-pre-pushremote.txt
ls .git/hooks/pre-push > /tmp/ainative-pre-hook.txt 2>/dev/null || echo "(missing)" > /tmp/ainative-pre-hook.txt
```

- [ ] **Step 3: Start dev server once, let it boot, then stop**

```bash
npm run dev &
DEV_PID=$!
sleep 10
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
```

Expected: dev server starts, console shows `[instance] bootstrap skipped: dev_mode_env` (or `dev_mode_sentinel`) in output.

- [ ] **Step 4: Confirm git state is unchanged**

```bash
git branch | grep -E "^\*" > /tmp/ainative-post-branch.txt
git config --get branch.main.pushRemote > /tmp/ainative-post-pushremote.txt 2>/dev/null || echo "(not set)" > /tmp/ainative-post-pushremote.txt
ls .git/hooks/pre-push > /tmp/ainative-post-hook.txt 2>/dev/null || echo "(missing)" > /tmp/ainative-post-hook.txt

diff /tmp/ainative-pre-branch.txt /tmp/ainative-post-branch.txt && echo "branch: UNCHANGED"
diff /tmp/ainative-pre-pushremote.txt /tmp/ainative-post-pushremote.txt && echo "pushRemote: UNCHANGED"
diff /tmp/ainative-pre-hook.txt /tmp/ainative-post-hook.txt && echo "pre-push hook: UNCHANGED"
```

Expected: all three `UNCHANGED` messages printed. No new branches, no pushRemote set, no hook installed.

- [ ] **Step 5: Clean up and commit final checkpoint**

```bash
rm /tmp/ainative-pre-* /tmp/ainative-post-*
git add -A
git status   # should show nothing unexpected
```

No commit needed if all other tasks committed cleanly. This task is verification only.

---

## Self-Review Checklist

After implementing all 10 tasks, verify:

**1. Spec coverage:** Every acceptance criterion in `features/instance-bootstrap.md` maps to at least one task:
- [ ] Core functionality ACs → Tasks 5, 6, 8
- [ ] Dev-mode gate ACs → Tasks 2, 8
- [ ] Consent flow ACs → Task 7
- [ ] Guardrails ACs → Task 6
- [ ] Single-clone generalization test → Task 5 (`ensureLocalBranch` third test covers this)
- [ ] Main dev repo safety test → Task 10 (manual verification)

**2. Placeholder scan:** No `TODO`, `TBD`, "implement later", or vague error handling. Every code block is complete.

**3. Type consistency:** `EnsureStepResult`, `EnsureResult`, `GitOps`, `InstanceConfig`, `Guardrails`, `ConsentStatus` are all defined in Task 1 and used identically in Tasks 3-8. Method names match: `branchExists`, `createAndCheckoutBranch`, `setConfig`, `getCurrentBranch`, `isGitRepo`, `getGitDir`.

**4. Test count check:** Expected final count: detect.test.ts (13) + git-ops.test.ts (7) + settings.test.ts (5) + bootstrap.test.ts (22) + instrumentation-smoke.test.ts (1) = **48 tests** in the new test files. Bootstrap.test.ts breakdown: 5 Phase A + 5 Phase B + 4 consent + 8 orchestrator = 22. Run `npx vitest run src/lib/instance/ src/__tests__/instrumentation-smoke.test.ts` to verify.

**5. Main dev repo safety:** Task 10 manual verification MUST pass before merging. If any step shows a change, investigate before proceeding.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-07-instance-bootstrap.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Each of the 10 tasks is self-contained with exact code.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
