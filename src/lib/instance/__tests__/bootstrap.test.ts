import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
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
    const result = await ensureInstanceConfig(tempDir);
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
    await ensureInstanceConfig(tempDir);
    const { getInstanceConfig } = await import("../settings");
    const firstId = getInstanceConfig()!.instanceId;
    await ensureInstanceConfig(tempDir);
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
