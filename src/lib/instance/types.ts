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

export interface UpgradeState {
  lastPolledAt: number | null;
  lastUpstreamSha: string | null;
  localMainSha: string | null;
  upgradeAvailable: boolean;
  commitsBehind: number;
  lastSuccessfulUpgradeAt: number | null;
  lastUpgradeTaskId: string | null;
  pollFailureCount: number;
  lastPollError: string | null;
}

export type EnsureSkipReason =
  | "dev_mode_env"
  | "dev_mode_sentinel"
  | "no_git";

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
  /** Fetches from origin. Throws on failure. */
  fetchOrigin(): void;
  /** Returns the SHA for a given ref (branch name or remote ref like "origin/main"). Returns null if the ref is unknown. */
  revParse(ref: string): string | null;
  /** Returns the count of commits reachable from `to` but not from `from`. Returns 0 if either ref is unknown. */
  countCommitsAhead(from: string, to: string): number;
}
