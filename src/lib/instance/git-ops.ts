import { execFileSync } from "child_process";
import { join, resolve } from "path";
import type { GitOps } from "./types";

/**
 * Real git operations wrapper. All commands use execFileSync with argv arrays —
 * no shell interpolation, ever. File is the literal "git"; user-provided values
 * flow through the args array which git parses without shell involvement.
 *
 * The cwd parameter is normalized to an absolute path at factory creation time
 * so getGitDir() honors its interface contract of returning an absolute path.
 */
export function createGitOps(cwd: string = process.cwd()): GitOps {
  const absoluteCwd = resolve(cwd);
  function run(args: string[]): string {
    return execFileSync("git", args, {
      cwd: absoluteCwd,
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
      return join(absoluteCwd, ".git");
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

    fetchOrigin(): void {
      run(["fetch", "origin", "main"]);
    },

    revParse(ref: string): string | null {
      try {
        return run(["rev-parse", ref]);
      } catch {
        return null;
      }
    },

    countCommitsAhead(from: string, to: string): number {
      try {
        const out = run(["rev-list", "--count", `${from}..${to}`]);
        const n = parseInt(out, 10);
        return Number.isFinite(n) ? n : 0;
      } catch {
        return 0;
      }
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
