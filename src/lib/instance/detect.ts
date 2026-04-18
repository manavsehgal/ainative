import { existsSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

/**
 * Returns true if the current environment is the canonical ainative dev repo
 * and should skip all instance bootstrap operations.
 *
 * Layered gates:
 * 1. AINATIVE_DEV_MODE=true env var (primary, per-developer)
 * 2. .git/ainative-dev-mode sentinel file (secondary, git-dir-scoped)
 *
 * Override: AINATIVE_INSTANCE_MODE=true forces bootstrap to run even in dev
 * mode, so contributors can test the feature in the main repo.
 */
export function isDevMode(cwd: string = process.cwd()): boolean {
  if (process.env.AINATIVE_INSTANCE_MODE === "true") return false;
  if (process.env.AINATIVE_DEV_MODE === "true") return true;
  if (existsSync(join(cwd, ".git", "ainative-dev-mode"))) return true;
  return false;
}

/** Returns true if a .git directory exists at the given path. */
export function hasGitDir(cwd: string = process.cwd()): boolean {
  return existsSync(join(cwd, ".git"));
}

/**
 * Returns true if AINATIVE_DATA_DIR is set to a non-default path,
 * indicating this clone is running as an isolated private instance.
 */
export function isPrivateInstance(): boolean {
  const override = process.env.AINATIVE_DATA_DIR;
  if (!override) return false;
  const defaultDir = join(homedir(), ".ainative");
  return resolve(override) !== resolve(defaultDir);
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
