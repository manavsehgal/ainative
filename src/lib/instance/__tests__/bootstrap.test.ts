import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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
  tempDir = mkdtempSync(join(tmpdir(), "stagent-bootstrap-repo-"));
  dataDir = mkdtempSync(join(tmpdir(), "stagent-bootstrap-data-"));
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
    const result = await ensureInstanceConfig();
    expect(result.status).toBe("ok");
    const { getInstanceConfig } = await import("../settings");
    const config = getInstanceConfig();
    expect(config).not.toBeNull();
    expect(config!.instanceId).toMatch(/^[a-f0-9-]{36}$/);
    expect(config!.branchName).toBe("local");
    // STAGENT_DATA_DIR is stubbed to a temp dir (non-default), so this clone
    // correctly registers as a private instance in the test environment.
    expect(config!.isPrivateInstance).toBe(true);
    expect(config!.createdAt).toBeGreaterThan(0);
  });

  it("does not regenerate instanceId on subsequent calls", async () => {
    const { ensureInstanceConfig } = await import("../bootstrap");
    await ensureInstanceConfig();
    const { getInstanceConfig } = await import("../settings");
    const firstId = getInstanceConfig()!.instanceId;
    await ensureInstanceConfig();
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
    const localSha = execFileSync("git", ["rev-parse", "local"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(localSha).toBe(mainSha);
    const mainShaAfter = execFileSync("git", ["rev-parse", "main"], { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(mainShaAfter).toBe(mainSha);
  });
});

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
    const mode = statSync(hookPath).mode & 0o777;
    expect(mode & 0o100).toBeTruthy();
  });

  it("is a no-op when a hook with matching version already exists", async () => {
    const { createGitOps } = await import("../git-ops");
    const { ensurePrePushHook } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    ensurePrePushHook(ops); // first install
    const firstMtime = statSync(join(tempDir, ".git", "hooks", "pre-push")).mtimeMs;
    const result = ensurePrePushHook(ops);
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("already_installed");
    const secondMtime = statSync(join(tempDir, ".git", "hooks", "pre-push")).mtimeMs;
    expect(secondMtime).toBe(firstMtime);
  });

  it("backs up a pre-existing non-stagent hook before installing", async () => {
    const customHook = "#!/bin/sh\necho custom hook\n";
    writeFileSync(join(tempDir, ".git", "hooks", "pre-push"), customHook);
    chmodSync(join(tempDir, ".git", "hooks", "pre-push"), 0o755);
    const { createGitOps } = await import("../git-ops");
    const { ensurePrePushHook } = await import("../bootstrap");
    const ops = createGitOps(tempDir);
    const result = ensurePrePushHook(ops);
    expect(result.status).toBe("ok");
    const backupPath = join(tempDir, ".git", "hooks", "pre-push.stagent-backup");
    expect(existsSync(backupPath)).toBe(true);
    expect(readFileSync(backupPath, "utf-8")).toBe(customHook);
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
