# Instance Bootstrap — Local-Branch-as-Tracking-Shim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert bootstrap-managed `local` branch (and `main` on domain clones) into tracking shims that re-align to `origin/main` on every boot, instead of branches created at HEAD via `git checkout -b` (which both swaps HEAD and never re-aligns afterward).

**Architecture:** Replace `createAndCheckoutBranch` with `createBranchAt(name, ref)` in `GitOps`. Replace `ensureLocalBranch` with `ensureLocalBranchShim` that uses `git branch -f <name> origin/main` (no HEAD movement, idempotent re-pointing). Add a parallel `ensureMainShim` that runs only on domain clones (`branchName !== "main"`) and includes a "is the shim currently checked out?" safety guard.

**Tech Stack:** TypeScript, Node child-process via `execFileSync` (already in `git-ops.ts`), vitest, better-sqlite3, Drizzle. Test pattern: temp-dir git repos via `mkdtempSync` + `vi.stubEnv("STAGENT_DATA_DIR", ...)`.

**Spec:** [features/instance-bootstrap-local-branch-shim.md](../../features/instance-bootstrap-local-branch-shim.md)

---

## NOT in scope

- **Auto-merge of `origin/main` into the working branch.** Bootstrap does not run `git merge`. The user (or upgrade-session) decides when to merge. Bootstrap only manages tracking shims.
- **`git checkout` calls of any kind in bootstrap.** Acceptance criterion 5 forbids HEAD-moving operations from bootstrap. Single-clone users who want to start working on `local` must `git checkout local` themselves.
- **Auto-rename of `local` → `<domain>-mgr`.** The `PRIVATE-INSTANCES.md` §1.7 manual ritual stays.
- **Changes to Phase B (pre-push hook, `pushRemoteBlocked`).** Out of scope; Phase B is unaffected.
- **`ensureOriginCanonical()` audit step** (flagged in spec's "Adjacent risk" section) — separate spec, separate plan.
- **Updating `PRIVATE-INSTANCES.md`** — file does not exist in this repo (verified via `ls`); the §1.7 ritual lives in user-side docs that are out of repo scope.

## What already exists (reuse, don't reinvent)

| Symbol | Path | What it does |
| --- | --- | --- |
| `git.revParse(ref)` | [src/lib/instance/git-ops.ts:67-73](../../src/lib/instance/git-ops.ts:67) | Returns SHA or `null`. Use for SHA equality and "ref unknown" detection. |
| `git.branchExists(name)` | [src/lib/instance/git-ops.ts:46-53](../../src/lib/instance/git-ops.ts:46) | Bool. Reuse unchanged. |
| `git.getCurrentBranch()` | [src/lib/instance/git-ops.ts:37-44](../../src/lib/instance/git-ops.ts:37) | Returns branch name or `null`. Use for the "shim-is-current-branch" safety check. |
| `EnsureStepResult` | [src/lib/instance/types.ts:42-46](../../src/lib/instance/types.ts:42) | Discriminated union `{ step, status, reason? }`. Reuse — same `step: "local-branch"` and add `step: "main-branch"`. |
| `detectRebaseInProgress(cwd)` | [src/lib/instance/detect.ts](../../src/lib/instance/detect.ts) | Already gates `ensureLocalBranch` at [bootstrap.ts:232-236](../../src/lib/instance/bootstrap.ts:232). Both shims will reuse this guard. |
| `getInstanceConfig()` | [src/lib/instance/settings.ts](../../src/lib/instance/settings.ts) | Used to read `branchName` for the domain-clone gate. Reuse. |
| `runGit(args, cwd)` test helper | [bootstrap.test.ts:10-12](../../src/lib/instance/__tests__/bootstrap.test.ts:10) | Wraps git invocation for tests. Will extend with a string-returning variant `getGit()` for SHA reads. |
| Test temp-dir scaffolding | [bootstrap.test.ts:14-36](../../src/lib/instance/__tests__/bootstrap.test.ts:14) | `initRepo()` + `beforeEach`/`afterEach`. Will add `setupOriginRemote()` and `advanceOriginMain()` helpers. |

**Sole caller of the to-be-removed `createAndCheckoutBranch`:** `ensureLocalBranch` at [bootstrap.ts:39](../../src/lib/instance/bootstrap.ts:39) (verified by repo-wide grep). Removal is safe.

## Error & Rescue Registry

| Failure mode | Symptom | Recovery |
| --- | --- | --- |
| `origin/main` not yet fetched (fresh checkout, poller hasn't run) | `revParse("refs/remotes/origin/main")` returns null | Skip with `reason: "no_upstream_main"`. Heals on next boot after upgrade-poller's fetch runs. |
| `main` is currently checked out on a domain clone | `getCurrentBranch() === "main"` | Skip `ensureMainShim` with `reason: "main_is_current_branch"`. Bootstrap never repoints a checked-out branch — that would alter the working tree. |
| Rebase in progress | `.git/rebase-merge` exists | Existing guard at [bootstrap.ts:232-236](../../src/lib/instance/bootstrap.ts:232) skips the branch step. Extend the same guard to `ensureMainShim`. |
| `git branch -f` fails (permissions, corrupted refs) | child-process call throws | Catch and return `status: "failed"`, `reason: <message>`. Bootstrap NEVER throws; downstream Phase B keeps running. |
| Existing user setup with §1.7 dead `local` shim | Shim already at `origin/main` SHA after the previous manual rename | SHA equality check → skip with `reason: "shim_aligned"`. No-op. |
| Single-clone user previously working on `local` (old contract) | `local` exists at user's HEAD with their commits | `getCurrentBranch() === "local"` → skip with `reason: "shim_is_current_branch"`. User's work preserved; they can manually decide whether to rebase. |

## File Structure

| Path | Action | Responsibility |
| --- | --- | --- |
| [src/lib/instance/types.ts](../../src/lib/instance/types.ts) | Modify | Replace `createAndCheckoutBranch` with `createBranchAt` in `GitOps` interface. |
| [src/lib/instance/git-ops.ts](../../src/lib/instance/git-ops.ts) | Modify | Implement `createBranchAt`. Remove `createAndCheckoutBranch`. |
| [src/lib/instance/__tests__/git-ops.test.ts](../../src/lib/instance/__tests__/git-ops.test.ts) | Modify | Replace 2 `createAndCheckoutBranch` tests with `createBranchAt` tests. |
| [src/lib/instance/bootstrap.ts](../../src/lib/instance/bootstrap.ts) | Modify | Rename `ensureLocalBranch` → `ensureLocalBranchShim`. Add `ensureMainShim`. Wire both into `ensureInstance()`. |
| [src/lib/instance/__tests__/bootstrap.test.ts](../../src/lib/instance/__tests__/bootstrap.test.ts) | Modify | Rewrite `ensureLocalBranch` describe block. Add `ensureMainShim` describe block. Add helpers. |
| [features/instance-bootstrap-local-branch-shim.md](../../features/instance-bootstrap-local-branch-shim.md) | Modify (close-out only) | Append "Verification run — 2026-04-17" section. Flip `status: planned` → `completed`. |

---

## Task 1: Update `GitOps` interface

**Files:**
- Modify: `src/lib/instance/types.ts` (lines 67-68 — `createAndCheckoutBranch` declaration)

- [ ] **Step 1: Edit the interface declaration**

In [src/lib/instance/types.ts](../../src/lib/instance/types.ts) replace the existing `createAndCheckoutBranch` declaration (with its docblock) at lines 67-68 with:

```ts
  /**
   * Creates or repoints a branch to a given ref WITHOUT checking it out.
   * Used for tracking shims that bootstrap re-aligns each boot.
   * Idempotent: -f means existing branch at a different SHA gets repointed,
   * non-existent branch gets created. Safe for shim semantics; do NOT use
   * for user-facing branch creation where data loss might be a concern.
   */
  createBranchAt(name: string, ref: string): void;
```

- [ ] **Step 2: Confirm callers break (red signal)**

Run: `cd /Users/manavsehgal/Developer/ainative/.claude/worktrees/loving-buck-fb4fec && npx tsc --noEmit 2>&1 | grep -E "(git-ops|bootstrap)" | head -10`

Expected: TypeScript errors at `src/lib/instance/git-ops.ts:55` (impl no longer satisfies interface) and `src/lib/instance/bootstrap.ts:39` (caller). Plus the two test files. This is the red signal that drives Tasks 2-7.

- [ ] **Step 3: Commit**

```
git add src/lib/instance/types.ts
git commit -m "refactor(instance): swap GitOps.createAndCheckoutBranch for createBranchAt

Step 1 of feature/instance-bootstrap-local-branch-shim. Interface change
only — implementations and callers fail to compile until subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Implement `createBranchAt` in `git-ops.ts`

**Files:**
- Modify: `src/lib/instance/git-ops.ts:55-57`
- Test: `src/lib/instance/__tests__/git-ops.test.ts:58-80`

- [ ] **Step 1: Write failing tests**

Replace the entire existing `createAndCheckoutBranch` describe block (lines ~56-80) of [git-ops.test.ts](../../src/lib/instance/__tests__/git-ops.test.ts) with the block below. The existing file already imports `runGit`, `writeFileSync`, `join`, and the `execFileSync` import for SHA-reading is already present at the top of the file — reuse them.

```ts
  describe("createBranchAt", () => {
    it("creates a branch at HEAD without checking it out", () => {
      const ops = createGitOps(tempDir);
      const headBefore = ops.revParse("HEAD")!;
      const currentBefore = ops.getCurrentBranch();
      ops.createBranchAt("test-shim", "HEAD");
      expect(ops.branchExists("test-shim")).toBe(true);
      expect(ops.revParse("test-shim")).toBe(headBefore);
      // Critical: HEAD must NOT move.
      expect(ops.getCurrentBranch()).toBe(currentBefore);
    });

    it("repoints an existing branch to a new ref (-f semantics)", () => {
      const ops = createGitOps(tempDir);
      ops.createBranchAt("test-shim", "HEAD");
      const firstSha = ops.revParse("test-shim")!;

      // Make a new commit on main so HEAD advances.
      writeFileSync(join(tempDir, "advance.txt"), "advance\n");
      runGit(["add", "advance.txt"], tempDir);
      runGit(["commit", "-m", "advance head"], tempDir);
      const newHead = ops.revParse("HEAD")!;
      expect(newHead).not.toBe(firstSha);

      // Repoint the shim — should succeed.
      ops.createBranchAt("test-shim", "HEAD");
      expect(ops.revParse("test-shim")).toBe(newHead);
    });

    it("throws when the ref is unknown", () => {
      const ops = createGitOps(tempDir);
      expect(() => ops.createBranchAt("test-shim", "refs/heads/nonexistent")).toThrow();
    });
  });
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run src/lib/instance/__tests__/git-ops.test.ts -t createBranchAt 2>&1 | tail -25`

Expected: all 3 tests fail (`createBranchAt` is not a function on the impl yet).

- [ ] **Step 3: Implement `createBranchAt` in `git-ops.ts`**

Replace lines 55-57 in [src/lib/instance/git-ops.ts](../../src/lib/instance/git-ops.ts) — the `createAndCheckoutBranch` method — with:

```ts
    createBranchAt(name: string, ref: string): void {
      // -f intentional: this is for tracking shims we own. Existing branch at
      // a different SHA gets repointed; non-existent branch gets created.
      run(["branch", "-f", name, ref]);
    },
```

- [ ] **Step 4: Run tests to verify green**

Run: `npx vitest run src/lib/instance/__tests__/git-ops.test.ts 2>&1 | tail -10`

Expected: every test in the file passes.

- [ ] **Step 5: Commit**

```
git add src/lib/instance/git-ops.ts src/lib/instance/__tests__/git-ops.test.ts
git commit -m "feat(instance): implement GitOps.createBranchAt — non-checkout branch ref

Replaces createAndCheckoutBranch (which used 'git checkout -b' and swapped
HEAD as a side effect). createBranchAt uses 'git branch -f' so HEAD never
moves, existing branches get repointed instead of erroring, and tracking
shims (local, main on domain clones) can be re-aligned each boot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add test helpers `setupOriginRemote` + `advanceOriginMain` + `getGit`

The shim functions need `origin/main` to exist in the test repo. Add helpers reused by Tasks 4, 5, 6.

**Files:**
- Modify: top of `src/lib/instance/__tests__/bootstrap.test.ts` (after `initRepo`)

- [ ] **Step 1: Add the helpers**

Insert after the existing `initRepo` function (around line 22) of [bootstrap.test.ts](../../src/lib/instance/__tests__/bootstrap.test.ts):

```ts
/**
 * Wraps the existing runGit() helper to capture stdout. The base runGit
 * uses stdio: "pipe" without an encoding so it returns nothing — this
 * variant captures the trimmed string output for SHA reads.
 */
function getGit(args: string[], cwd: string): string {
  const { execFileSync } = require("child_process");
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

/**
 * Creates a bare clone of `dir` as the `origin` remote and fetches it.
 * Returns the bare-clone path so callers can advance origin/main if needed.
 */
function setupOriginRemote(dir: string, bareDirParent: string): string {
  const bareDir = mkdtempSync(join(bareDirParent, "ainative-bootstrap-bare-"));
  rmSync(bareDir, { recursive: true, force: true });
  runGit(["clone", "--bare", dir, bareDir], dir);
  runGit(["remote", "add", "origin", bareDir], dir);
  runGit(["fetch", "origin", "main"], dir);
  return bareDir;
}

/**
 * Advances origin/main by adding a commit in the bare remote, then
 * re-fetches into `dir`. Returns the new origin/main SHA.
 */
function advanceOriginMain(dir: string, bareDir: string, message: string): string {
  const workDir = mkdtempSync(join(tmpdir(), "ainative-bootstrap-origin-work-"));
  try {
    runGit(["clone", bareDir, workDir], workDir);
    runGit(["config", "user.email", "test@example.com"], workDir);
    runGit(["config", "user.name", "Test"], workDir);
    writeFileSync(join(workDir, `${Date.now()}.txt`), message);
    runGit(["add", "-A"], workDir);
    runGit(["commit", "-m", message], workDir);
    runGit(["push", "origin", "main"], workDir);
    runGit(["fetch", "origin", "main"], dir);
    return getGit(["rev-parse", "refs/remotes/origin/main"], dir);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
```

All required imports (`mkdtempSync`, `rmSync`, `tmpdir`, `writeFileSync`, `join`) are already at the top of the file. The local `require("child_process")` inside `getGit` keeps the helper self-contained without adding a top-level import.

- [ ] **Step 2: Verify file still compiles**

Run: `npx tsc --noEmit 2>&1 | grep "bootstrap.test" | head -5`

Expected: no NEW errors from the helpers (pre-existing errors from Task 1's interface change may remain).

- [ ] **Step 3: Commit**

```
git add src/lib/instance/__tests__/bootstrap.test.ts
git commit -m "test(instance): add setupOriginRemote/advanceOriginMain/getGit helpers

Helpers create a bare-clone origin and let tests advance origin/main on
demand. Used by upcoming ensureLocalBranchShim and ensureMainShim test
suites which need a real refs/remotes/origin/main to exercise.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Rewrite `ensureLocalBranch` → `ensureLocalBranchShim`

**Files:**
- Modify: `src/lib/instance/bootstrap.ts:29-48` (existing `ensureLocalBranch` function)
- Modify: `src/lib/instance/__tests__/bootstrap.test.ts:65-112` (existing describe block)

- [ ] **Step 1: Write failing tests**

Replace the entire `describe("ensureLocalBranch (Phase A)", ...)` block (lines 65-112) of [bootstrap.test.ts](../../src/lib/instance/__tests__/bootstrap.test.ts) with:

```ts
describe("ensureLocalBranchShim (Phase A)", () => {
  let bareDir: string;

  beforeEach(() => {
    bareDir = setupOriginRemote(tempDir, tmpdir());
  });

  afterEach(() => {
    rmSync(bareDir, { recursive: true, force: true });
  });

  it("creates local at origin/main when it does not exist (no HEAD swap)", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureLocalBranchShim } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    const upstreamSha = getGit(["rev-parse", "refs/remotes/origin/main"], tempDir);
    const branchBefore = ops.getCurrentBranch();

    const result = ensureLocalBranchShim(ops);

    expect(result.status).toBe("ok");
    expect(result.reason).toBe("created");
    expect(ops.branchExists("local")).toBe(true);
    expect(ops.getCurrentBranch()).toBe(branchBefore); // HEAD did NOT move
    expect(getGit(["rev-parse", "local"], tempDir)).toBe(upstreamSha);
  });

  it("is a no-op when local already aligned with origin/main", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureLocalBranchShim } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    ops.createBranchAt("local", "refs/remotes/origin/main");

    const result = ensureLocalBranchShim(ops);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("shim_aligned");
  });

  it("repoints local when it has drifted from origin/main", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureLocalBranchShim } = await import("../bootstrap");
    const ops = createGitOps(tempDir);

    // Create local at the OLD origin/main, then advance origin so they diverge.
    ops.createBranchAt("local", "refs/remotes/origin/main");
    const newUpstreamSha = advanceOriginMain(tempDir, bareDir, "advance upstream");

    const result = ensureLocalBranchShim(ops);

    expect(result.status).toBe("ok");
    expect(result.reason).toBe("repointed");
    expect(getGit(["rev-parse", "local"], tempDir)).toBe(newUpstreamSha);
  });

  it("skips when origin/main is not yet fetched", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureLocalBranchShim } = await import("../bootstrap");

    runGit(["remote", "remove", "origin"], tempDir);
    rmSync(join(tempDir, ".git", "refs", "remotes", "origin"), { recursive: true, force: true });

    const ops = createGitOps(tempDir);
    const result = ensureLocalBranchShim(ops);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("no_upstream_main");
    expect(ops.branchExists("local")).toBe(false);
  });

  it("skips when local is currently checked out (avoids changing working tree)", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureLocalBranchShim } = await import("../bootstrap");
    const ops = createGitOps(tempDir);

    ops.createBranchAt("local", "refs/remotes/origin/main");
    runGit(["checkout", "local"], tempDir);
    advanceOriginMain(tempDir, bareDir, "advance after local checkout");

    const result = ensureLocalBranchShim(ops);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("shim_is_current_branch");
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts -t ensureLocalBranchShim 2>&1 | tail -25`

Expected: all 5 tests fail (export missing).

- [ ] **Step 3: Replace `ensureLocalBranch` in `bootstrap.ts`**

Replace lines 29-48 of [src/lib/instance/bootstrap.ts](../../src/lib/instance/bootstrap.ts) — the `ensureLocalBranch` function with its docblock — with:

```ts
const SHIM_TRACK_REF = "refs/remotes/origin/main";

/**
 * Phase A step 2: align the `local` tracking shim with origin/main.
 *
 * Behavior matrix:
 * - origin/main not fetched yet → skip with "no_upstream_main"
 *   (heals on next boot after upgrade-poller runs git fetch)
 * - local doesn't exist → create at origin/main
 * - local exists at the same SHA as origin/main → no-op ("shim_aligned")
 * - local exists at a different SHA AND is the currently-checked-out branch
 *   → skip ("shim_is_current_branch") to avoid mutating the working tree
 * - local exists at a different SHA AND is not checked out → repoint
 *
 * NEVER moves HEAD. NEVER throws. Bootstrap failures must not crash startup.
 */
export function ensureLocalBranchShim(git: GitOps): EnsureStepResult {
  const upstream = git.revParse(SHIM_TRACK_REF);
  if (!upstream) {
    return { step: "local-branch", status: "skipped", reason: "no_upstream_main" };
  }
  const existing = git.revParse(`refs/heads/${DEFAULT_BRANCH_NAME}`);
  if (existing === upstream) {
    return { step: "local-branch", status: "skipped", reason: "shim_aligned" };
  }
  if (existing !== null && git.getCurrentBranch() === DEFAULT_BRANCH_NAME) {
    return { step: "local-branch", status: "skipped", reason: "shim_is_current_branch" };
  }
  try {
    git.createBranchAt(DEFAULT_BRANCH_NAME, SHIM_TRACK_REF);
    return {
      step: "local-branch",
      status: "ok",
      reason: existing === null ? "created" : "repointed",
    };
  } catch (err) {
    return {
      step: "local-branch",
      status: "failed",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4: Update orchestrator call site**

In the same file, find line 235 `steps.push(ensureLocalBranch(git));` and replace with `steps.push(ensureLocalBranchShim(git));`.

- [ ] **Step 5: Run tests to verify green**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts -t ensureLocalBranchShim 2>&1 | tail -15`

Expected: all 5 new shim tests pass. (Other tests may still fail due to Task 7's not-yet-fixed fixtures; that's OK for now.)

- [ ] **Step 6: Commit**

```
git add src/lib/instance/bootstrap.ts src/lib/instance/__tests__/bootstrap.test.ts
git commit -m "feat(instance): rewrite ensureLocalBranch as tracking-shim semantics

ensureLocalBranchShim aligns refs/heads/local with refs/remotes/origin/main
on every boot, never moving HEAD. Replaces 'git checkout -b local' (which
swapped HEAD as a side effect — root cause of the PRIVATE-INSTANCES.md
§1.7 dead-shim workaround).

Behavior:
- no upstream fetched → skip (heals on next boot)
- shim exists, aligned → no-op
- shim is currently checked out → skip (don't alter working tree)
- otherwise → repoint or create via 'git branch -f'

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Add `ensureMainShim` for domain clones

**Files:**
- Modify: `src/lib/instance/bootstrap.ts` (insert after `ensureLocalBranchShim`)
- Modify: `src/lib/instance/__tests__/bootstrap.test.ts` (add new describe block after the shim block)

- [ ] **Step 1: Write failing tests**

Append after the `ensureLocalBranchShim` describe block in [bootstrap.test.ts](../../src/lib/instance/__tests__/bootstrap.test.ts):

```ts
describe("ensureMainShim (Phase A — domain clones only)", () => {
  let bareDir: string;

  beforeEach(() => {
    bareDir = setupOriginRemote(tempDir, tmpdir());
  });

  afterEach(() => {
    rmSync(bareDir, { recursive: true, force: true });
  });

  it("repoints local main when it has drifted from origin/main", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureMainShim } = await import("../bootstrap");
    const ops = createGitOps(tempDir);

    // Simulate a domain-clone setup: rename main → wealth-mgr, leave a dead
    // main shim at the old SHA, then advance origin so main is orphaned.
    runGit(["branch", "-m", "main", "wealth-mgr"], tempDir);
    runGit(["branch", "main", "wealth-mgr"], tempDir);
    const newUpstream = advanceOriginMain(tempDir, bareDir, "upstream advances");

    const mainBefore = getGit(["rev-parse", "main"], tempDir);
    expect(mainBefore).not.toBe(newUpstream);

    const result = ensureMainShim(ops);

    expect(result.status).toBe("ok");
    expect(result.reason).toBe("repointed");
    expect(getGit(["rev-parse", "main"], tempDir)).toBe(newUpstream);
  });

  it("is a no-op when main is already aligned with origin/main", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureMainShim } = await import("../bootstrap");
    const ops = createGitOps(tempDir);

    runGit(["checkout", "-b", "wealth-mgr"], tempDir);

    const result = ensureMainShim(ops);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("shim_aligned");
  });

  it("skips when main is the currently checked out branch", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureMainShim } = await import("../bootstrap");
    const ops = createGitOps(tempDir);

    advanceOriginMain(tempDir, bareDir, "upstream advances while user on main");
    expect(ops.getCurrentBranch()).toBe("main");

    const result = ensureMainShim(ops);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("main_is_current_branch");
  });

  it("skips when origin/main is not yet fetched", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureMainShim } = await import("../bootstrap");

    runGit(["checkout", "-b", "wealth-mgr"], tempDir);
    runGit(["remote", "remove", "origin"], tempDir);
    rmSync(join(tempDir, ".git", "refs", "remotes", "origin"), { recursive: true, force: true });

    const ops = createGitOps(tempDir);
    const result = ensureMainShim(ops);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("no_upstream_main");
  });

  it("skips when local main does not exist", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensureMainShim } = await import("../bootstrap");
    const ops = createGitOps(tempDir);

    runGit(["checkout", "-b", "wealth-mgr"], tempDir);
    runGit(["branch", "-D", "main"], tempDir);

    const result = ensureMainShim(ops);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("main_branch_absent");
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts -t ensureMainShim 2>&1 | tail -25`

Expected: all 5 fail (export missing).

- [ ] **Step 3: Implement `ensureMainShim`**

In [bootstrap.ts](../../src/lib/instance/bootstrap.ts) insert after the `ensureLocalBranchShim` function:

```ts
const MAIN_BRANCH_NAME = "main";

/**
 * Phase A step 2b: align refs/heads/main with origin/main on domain clones.
 *
 * On a domain clone (PRIVATE-INSTANCES.md §1.7), the user's working branch
 * is `<domain>-mgr` and `main` is a tracking shim. After an upstream history
 * rewrite (e.g. the 2026-04-17 navam-io → manavsehgal migration) `main` can
 * orphan and accumulate hundreds of commits of phantom divergence — which
 * the upgrade-detection poller renders as a "500+ updates" badge.
 *
 * Behavior matrix is identical to ensureLocalBranchShim, with one extra
 * skip path: if local main does not exist at all, do nothing
 * ("main_branch_absent") — bootstrap does not invent branches the user
 * deleted on purpose.
 */
export function ensureMainShim(git: GitOps): EnsureStepResult {
  const upstream = git.revParse(SHIM_TRACK_REF);
  if (!upstream) {
    return { step: "main-branch", status: "skipped", reason: "no_upstream_main" };
  }
  const existing = git.revParse(`refs/heads/${MAIN_BRANCH_NAME}`);
  if (existing === null) {
    return { step: "main-branch", status: "skipped", reason: "main_branch_absent" };
  }
  if (existing === upstream) {
    return { step: "main-branch", status: "skipped", reason: "shim_aligned" };
  }
  if (git.getCurrentBranch() === MAIN_BRANCH_NAME) {
    return { step: "main-branch", status: "skipped", reason: "main_is_current_branch" };
  }
  try {
    git.createBranchAt(MAIN_BRANCH_NAME, SHIM_TRACK_REF);
    return { step: "main-branch", status: "ok", reason: "repointed" };
  } catch (err) {
    return {
      step: "main-branch",
      status: "failed",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify green**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts -t ensureMainShim 2>&1 | tail -15`

Expected: all 5 pass.

- [ ] **Step 5: Commit**

```
git add src/lib/instance/bootstrap.ts src/lib/instance/__tests__/bootstrap.test.ts
git commit -m "feat(instance): add ensureMainShim for domain-clone main re-alignment

On a domain clone (branchName != 'main'), refs/heads/main is a tracking
shim that bootstrap re-points to origin/main on every boot. Auto-heals the
orphaned-main scenario from the 2026-04-17 navam-io → manavsehgal history
rewrite that surfaced as a 570-update upgrade badge in ainative-wealth.

Same skip-paths as ensureLocalBranchShim plus 'main_branch_absent' (don't
invent a branch the user deleted) and 'main_is_current_branch' (don't
mutate working tree).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire `ensureMainShim` into `ensureInstance`

**Files:**
- Modify: `src/lib/instance/bootstrap.ts:229-236` (orchestrator block)
- Modify: `src/lib/instance/__tests__/bootstrap.test.ts` (add 2 orchestrator tests inside the existing `describe("ensureInstance orchestrator", ...)` block)

- [ ] **Step 1: Write failing integration tests**

Inside the existing `describe("ensureInstance orchestrator", ...)` block in [bootstrap.test.ts](../../src/lib/instance/__tests__/bootstrap.test.ts), insert these two tests just before the closing `});` of that describe block:

```ts
  it("runs ensureMainShim when branchName is not 'main' (domain clone)", async () => {
    const bareDir = setupOriginRemote(tempDir, tmpdir());
    try {
      runGit(["branch", "-m", "main", "wealth-mgr"], tempDir);
      runGit(["branch", "main", "wealth-mgr"], tempDir);
      const newUpstream = advanceOriginMain(tempDir, bareDir, "upstream advances on domain clone");

      const { setInstanceConfig } = await import("../settings");
      await setInstanceConfig({
        instanceId: "test-instance-id",
        branchName: "wealth-mgr",
        isPrivateInstance: true,
        createdAt: Math.floor(Date.now() / 1000),
      });

      const { ensureInstance } = await import("../bootstrap");
      const result = await ensureInstance(tempDir);

      const mainStep = result.steps.find((s) => s.step === "main-branch");
      expect(mainStep?.status).toBe("ok");
      expect(mainStep?.reason).toBe("repointed");
      expect(getGit(["rev-parse", "main"], tempDir)).toBe(newUpstream);
    } finally {
      rmSync(bareDir, { recursive: true, force: true });
    }
  });

  it("does NOT run ensureMainShim when branchName is 'main' (single-clone)", async () => {
    const bareDir = setupOriginRemote(tempDir, tmpdir());
    try {
      const { ensureInstance } = await import("../bootstrap");
      const result = await ensureInstance(tempDir);
      expect(result.steps.map((s) => s.step)).not.toContain("main-branch");
    } finally {
      rmSync(bareDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts -t "ensureMainShim when|does NOT run ensureMainShim" 2>&1 | tail -15`

Expected: the "runs ensureMainShim when" test fails because the orchestrator never calls `ensureMainShim`.

- [ ] **Step 3: Wire `ensureMainShim` into the orchestrator**

In [bootstrap.ts](../../src/lib/instance/bootstrap.ts) find the existing block (around lines 232-236):

```ts
  // Phase A step 2: local branch — skip if rebase in progress
  if (detectRebaseInProgress(cwd)) {
    steps.push({ step: "local-branch", status: "skipped", reason: "rebase_in_progress" });
  } else {
    steps.push(ensureLocalBranchShim(git));
  }
```

Replace with:

```ts
  // Phase A step 2: local branch — skip if rebase in progress
  if (detectRebaseInProgress(cwd)) {
    steps.push({ step: "local-branch", status: "skipped", reason: "rebase_in_progress" });
  } else {
    steps.push(ensureLocalBranchShim(git));
  }

  // Phase A step 2b: main-branch shim (domain clones only).
  // Domain clone = settings.instance.branchName != "main". On those clones,
  // refs/heads/main is a tracking shim that bootstrap re-points to origin/main
  // on every boot. On single-clone setups (branchName == "main"), skip — main
  // IS the user's working branch.
  const config = getInstanceConfig();
  if (config && config.branchName !== "main") {
    if (detectRebaseInProgress(cwd)) {
      steps.push({ step: "main-branch", status: "skipped", reason: "rebase_in_progress" });
    } else {
      steps.push(ensureMainShim(git));
    }
  }
```

- [ ] **Step 4: Run integration tests to verify green**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts -t "ensureMainShim when|does NOT run ensureMainShim" 2>&1 | tail -15`

Expected: both pass.

- [ ] **Step 5: Commit**

```
git add src/lib/instance/bootstrap.ts src/lib/instance/__tests__/bootstrap.test.ts
git commit -m "feat(instance): wire ensureMainShim into ensureInstance for domain clones

Orchestrator runs ensureMainShim after ensureLocalBranchShim, but only when
settings.instance.branchName != 'main' (domain-clone setup). Single-clone
users see no behavior change — main is their working branch and never gets
shim treatment.

Same rebase-in-progress guard as ensureLocalBranchShim.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Fix remaining test fixtures using `createAndCheckoutBranch`

The grep in scope-challenge found two leftover usages in [bootstrap.test.ts:176-177](../../src/lib/instance/__tests__/bootstrap.test.ts:176) (the `ensureBranchPushConfig` "handles multiple blocked branches" test). These are fixture setup, not behavior under test — replace with raw git calls.

**Files:**
- Modify: `src/lib/instance/__tests__/bootstrap.test.ts:172-182`

- [ ] **Step 1: Confirm tests are red**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts -t "handles multiple blocked" 2>&1 | tail -10`

Expected: TypeScript compile failure at the `ops.createAndCheckoutBranch` calls.

- [ ] **Step 2: Replace the two fixture calls**

Find lines 176-177 of [bootstrap.test.ts](../../src/lib/instance/__tests__/bootstrap.test.ts):

```ts
    ops.createAndCheckoutBranch("wealth-mgr");
    ops.createAndCheckoutBranch("investor-mgr");
```

Replace with:

```ts
    runGit(["branch", "wealth-mgr"], tempDir);
    runGit(["branch", "investor-mgr"], tempDir);
```

The test only needs branches to EXIST (so `git config branch.<name>.pushRemote` can apply); HEAD location is irrelevant.

- [ ] **Step 3: Run that test to verify green**

Run: `npx vitest run src/lib/instance/__tests__/bootstrap.test.ts -t "handles multiple blocked" 2>&1 | tail -10`

Expected: pass.

- [ ] **Step 4: Run the full instance test suite**

Run: `npx vitest run src/lib/instance/__tests__/ 2>&1 | tail -20`

Expected: every test passes. If anything still references `ensureLocalBranch` (old name) or `createAndCheckoutBranch`, the TypeScript compile errors will surface here. Fix inline.

- [ ] **Step 5: Commit**

```
git add src/lib/instance/__tests__/bootstrap.test.ts
git commit -m "test(instance): replace remaining createAndCheckoutBranch fixture calls

The ensureBranchPushConfig test only needed branches to exist (for git
config branch.<name>.pushRemote to apply), not HEAD on them. Switch to
'git branch <name>' via the runGit helper. No behavior change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Full-repo verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit 2>&1 | tail -20`

Expected: zero errors. Any cross-module caller of `ensureLocalBranch` (old name) surfaces here. Fix inline.

- [ ] **Step 2: Run the entire vitest suite**

Run: `npx vitest run 2>&1 | tail -10`

Expected: all tests pass. The instance tests are the most affected; other suites should be unaffected.

- [ ] **Step 3: Confirm no lingering references**

Use Grep tool with pattern `createAndCheckoutBranch|ensureLocalBranch[^S]`, path `src/`, output `files_with_matches`.

Expected: empty.

- [ ] **Step 4: Commit (only if Steps 1-3 produced fixes)**

If clean, skip — Task 7 already left the suite green.

---

## Task 9: Real-boot smoke test against `ainative-wealth`

**This is the verification that catches what unit tests cannot.** Bootstrap runs from `src/instrumentation-node.ts` at server boot — a regression crashes startup before any HTTP request lands. Per CLAUDE.md's smoke-test discipline, validate against a real instance running production-mode bootstrap.

- [ ] **Step 1: Copy worktree changes into ainative-wealth**

```
cd /Users/manavsehgal/Developer/ainative/.claude/worktrees/loving-buck-fb4fec
tar czf /tmp/instance-shim-fix.tar.gz \
  src/lib/instance/bootstrap.ts \
  src/lib/instance/git-ops.ts \
  src/lib/instance/types.ts

cd /Users/manavsehgal/Developer/ainative-wealth
git stash push -m "smoke-shim-fix-stash" --include-untracked || echo "nothing to stash"
tar xzf /tmp/instance-shim-fix.tar.gz
```

- [ ] **Step 2: Re-orphan main to reproduce today's bug**

```
cd /Users/manavsehgal/Developer/ainative-wealth
git rev-parse main                                                    # record current SHA
git update-ref refs/heads/main 06764ac28f0f131aadfbc8b218fa47083c3a626b
git rev-list --count main..origin/main                                # expect non-zero
git branch --show-current                                             # expect wealth-mgr
```

- [ ] **Step 3: Boot the dev server on a free port**

Run via Bash tool with `run_in_background: true`:

```
cd /Users/manavsehgal/Developer/ainative-wealth && PORT=3010 npm run dev
```

Wait for the `Ready in Xs` line from Next.js (use Bash tool's output read after the bg task naturally settles — do NOT poll in tight loops).

- [ ] **Step 4: Verify bootstrap re-aligned main**

```
cd /Users/manavsehgal/Developer/ainative-wealth
git rev-parse main          # expect == origin/main SHA
git rev-parse origin/main
git rev-list --count main..origin/main   # expect 0
git branch --show-current   # expect wealth-mgr (HEAD did not move)
```

- [ ] **Step 5: Confirm no startup errors in dev server output**

Inspect captured dev-server output. Confirm no `ReferenceError`, no `Cannot access ... before initialization`, no bootstrap throws. Look for an info log indicating both `local-branch` and `main-branch` steps ran.

- [ ] **Step 6: Optional — verify upgrade badge clears via API**

```
curl -s http://localhost:3010/api/instance/upgrade/status
```

Expected: `commitsBehind: 0`, `upgradeAvailable: false`. (May briefly show stale values from the previous poll; trigger `POST /api/instance/upgrade/check` to refresh.)

- [ ] **Step 7: Stop the dev server and restore ainative-wealth**

Kill the backgrounded dev server (capture PID from the bg Bash result). Then:

```
cd /Users/manavsehgal/Developer/ainative-wealth
git checkout HEAD -- src/lib/instance/bootstrap.ts src/lib/instance/git-ops.ts src/lib/instance/types.ts
git stash pop || echo "nothing to pop"
```

- [ ] **Step 8: Document the verification run**

Append to [features/instance-bootstrap-local-branch-shim.md](../../features/instance-bootstrap-local-branch-shim.md):

```markdown
## Verification run — 2026-04-17

Smoke against ainative-wealth (production-mode bootstrap, no dev-mode gates):

1. Re-orphaned main to SHA 06764ac2 (570 commits behind origin/main).
2. Booted PORT=3010 npm run dev.
3. Bootstrap re-aligned main to a7957e11 (== origin/main). HEAD stayed on wealth-mgr.
4. /api/instance/upgrade/status returned commitsBehind=0, upgradeAvailable=false.
5. No ReferenceError, no module-load cycles, no bootstrap throws in dev-server output.

Fix verified end-to-end. Status flipped from `planned` → `completed`.
```

Also flip the frontmatter `status: planned` to `status: completed`.

- [ ] **Step 9: Commit verification close-out**

```
cd /Users/manavsehgal/Developer/ainative/.claude/worktrees/loving-buck-fb4fec
git add features/instance-bootstrap-local-branch-shim.md
git commit -m "docs(features): close out instance-bootstrap-local-branch-shim — smoke verified

Verification run 2026-04-17 against ainative-wealth confirmed:
- Bootstrap re-aligns orphaned main to origin/main on boot
- HEAD stays on the user's working branch (wealth-mgr)
- Upgrade-detection badge clears (commitsBehind=0)
- No startup errors

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✓ Spec §1 "Replace createAndCheckoutBranch with createBranchAt" → Tasks 1, 2
- ✓ Spec §2 "Reshape ensureLocalBranch into ensureLocalBranchShim" → Task 4
- ✓ Spec §3 "Also re-shim main on domain clones" → Tasks 5, 6
- ✓ Spec §4 "Wire into the existing rebase-in-progress guard" → Task 6 (rebase guard around `ensureMainShim`)
- ✓ Spec acceptance criterion 5 "No git checkout calls remain in bootstrap.ts" → enforced by Task 1 + Task 4
- ✓ Spec test matrix: every bullet maps to a test in Tasks 4, 5, 6
- ✓ Spec verification recipe → Task 9 mirrors it

**Placeholder scan:** none. Every step has exact code, exact commands, exact file paths.

**Type consistency:**
- `EnsureStepResult` `step` strings: `"local-branch"` (Tasks 4, 6) and `"main-branch"` (Tasks 5, 6) — consistent.
- `createBranchAt(name, ref)` signature identical across interface (Task 1), impl (Task 2), and callers (Tasks 4, 5).
- `SHIM_TRACK_REF` defined once in Task 4, reused in Task 5.
- `DEFAULT_BRANCH_NAME` reused from existing code; new `MAIN_BRANCH_NAME` introduced in Task 5.

---

## Execution Handoff

For this implementation: **Inline Execution** is the right fit — 9 small tasks, tight TDD loop, single subsystem, no parallelism win. Subagent dispatch overhead would dominate the 2-5 minute task budgets.
