/**
 * Instance bootstrap shared types.
 * See features/instance-bootstrap.md for full design rationale.
 */

export interface InstanceConfig {
  instanceId: string;
  branchName: string;
  isPrivateInstance: boolean;
  createdAt: number;
}

export type ConsentStatus = "not_yet" | "enabled" | "declined_permanently";

export interface Guardrails {
  prePushHookInstalled: boolean;
  prePushHookVersion: string;
  pushRemoteBlocked: string[];
  consentStatus: ConsentStatus;
  firstBootCompletedAt: number | null;
}

export type EnsureSkipReason =
  | "dev_mode_env"
  | "dev_mode_sentinel"
  | "no_git"
  | "rebase_in_progress";

export type EnsureStepStatus = "ok" | "skipped" | "failed";

export interface EnsureStepResult {
  step: string;
  status: EnsureStepStatus;
  reason?: string;
}

export interface EnsureResult {
  skipped?: EnsureSkipReason;
  steps: EnsureStepResult[];
}

/**
 * Injectable wrapper around git commands.
 * Real implementation in git-ops.ts uses execFileSync.
 * Tests provide a mock implementation.
 */
export interface GitOps {
  /** Returns true if the current working directory is inside a git repo (not a worktree of the main repo). */
  isGitRepo(): boolean;
  /** Returns the absolute path to the .git directory for the current repo. */
  getGitDir(): string;
  /** Returns the currently checked-out branch name, or null if detached HEAD. */
  getCurrentBranch(): string | null;
  /** Returns true if a branch with the given name exists locally. */
  branchExists(name: string): boolean;
  /** Creates a new branch at the current HEAD and checks it out. */
  createAndCheckoutBranch(name: string): void;
  /** Sets a git config value. Throws on failure. */
  setConfig(key: string, value: string): void;
}
