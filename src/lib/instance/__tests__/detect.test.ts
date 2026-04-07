import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir, homedir } from "os";

let tempDir: string;
let gitDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "stagent-detect-"));
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

  it("returns true when .git/stagent-dev-mode sentinel file exists", async () => {
    writeFileSync(join(gitDir, "stagent-dev-mode"), "");
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
    writeFileSync(join(gitDir, "stagent-dev-mode"), "");
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
    vi.stubEnv("STAGENT_DATA_DIR", "");
    const { isPrivateInstance } = await loadDetect();
    expect(isPrivateInstance()).toBe(false);
  });

  it("returns false when STAGENT_DATA_DIR equals default ~/.stagent", async () => {
    vi.stubEnv("STAGENT_DATA_DIR", join(homedir(), ".stagent"));
    const { isPrivateInstance } = await loadDetect();
    expect(isPrivateInstance()).toBe(false);
  });

  it("returns true when STAGENT_DATA_DIR is a custom path", async () => {
    vi.stubEnv("STAGENT_DATA_DIR", "/Users/manavsehgal/.stagent-wealth");
    const { isPrivateInstance } = await loadDetect();
    expect(isPrivateInstance()).toBe(true);
  });

  it("returns false when STAGENT_DATA_DIR equals default with trailing slash", async () => {
    vi.stubEnv("STAGENT_DATA_DIR", join(homedir(), ".stagent") + "/");
    const { isPrivateInstance } = await loadDetect();
    expect(isPrivateInstance()).toBe(false);
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
