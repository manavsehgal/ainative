import { execFileSync } from "child_process";
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
