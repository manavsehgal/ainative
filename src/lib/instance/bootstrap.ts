import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { join } from "path";
import type { EnsureStepResult, GitOps } from "./types";
import { getInstanceConfig, setInstanceConfig } from "./settings";

const DEFAULT_BRANCH_NAME = "local";

/**
 * Detect whether this git working directory is a dedicated private stagent
 * instance. We check for a `.stagent-private` sentinel file committed to the
 * repo root rather than relying on STAGENT_DATA_DIR (which may be overridden
 * for test isolation and is unrelated to the repo's identity).
 */
function detectPrivateInstance(cwd: string): boolean {
  return existsSync(join(cwd, ".stagent-private"));
}

/**
 * Phase A step 1: ensure the instance config row exists with a stable instanceId.
 * Idempotent — returns early if config already exists.
 */
export async function ensureInstanceConfig(_cwd: string = process.cwd()): Promise<EnsureStepResult> {
  const existing = getInstanceConfig();
  if (existing) {
    return { step: "instance-config", status: "skipped", reason: "already_exists" };
  }
  await setInstanceConfig({
    instanceId: randomUUID(),
    branchName: DEFAULT_BRANCH_NAME,
    isPrivateInstance: detectPrivateInstance(_cwd),
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
