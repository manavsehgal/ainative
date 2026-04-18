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
  tempDir = mkdtempSync(join(tmpdir(), "stagent-git-ops-"));
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
    const nonRepo = mkdtempSync(join(tmpdir(), "stagent-nogit-"));
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

  describe("createBranchAt", () => {
    it("creates a branch at HEAD without checking it out", async () => {
      const { createGitOps } = await import("../git-ops");
      const ops = createGitOps(tempDir);
      const headBefore = ops.revParse("HEAD")!;
      const currentBefore = ops.getCurrentBranch();
      ops.createBranchAt("test-shim", "HEAD");
      expect(ops.branchExists("test-shim")).toBe(true);
      expect(ops.revParse("test-shim")).toBe(headBefore);
      // Critical: HEAD must NOT move.
      expect(ops.getCurrentBranch()).toBe(currentBefore);
    });

    it("repoints an existing branch to a new ref (-f semantics)", async () => {
      const { createGitOps } = await import("../git-ops");
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

    it("throws when the ref is unknown", async () => {
      const { createGitOps } = await import("../git-ops");
      const ops = createGitOps(tempDir);
      expect(() => ops.createBranchAt("test-shim", "refs/heads/nonexistent")).toThrow();
    });
  });

  it("setConfig writes branch.local.pushRemote", async () => {
    const { createGitOps } = await import("../git-ops");
    const ops = createGitOps(tempDir);
    ops.createBranchAt("local", "HEAD");
    ops.setConfig("branch.local.pushRemote", "no_push");
    const value = execFileSync("git", ["config", "--get", "branch.local.pushRemote"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(value).toBe("no_push");
  });

  it("getGitDir returns absolute path to .git directory", async () => {
    const { createGitOps } = await import("../git-ops");
    const ops = createGitOps(tempDir);
    expect(ops.getGitDir()).toBe(join(tempDir, ".git"));
  });

  it("getCurrentBranch returns null when HEAD is detached", async () => {
    // Detach HEAD by checking out the commit SHA directly
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tempDir, encoding: "utf-8" }).trim();
    execFileSync("git", ["checkout", sha], { cwd: tempDir, stdio: "pipe" });
    const { createGitOps } = await import("../git-ops");
    const ops = createGitOps(tempDir);
    expect(ops.getCurrentBranch()).toBeNull();
  });
});
