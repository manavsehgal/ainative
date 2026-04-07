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
