/**
 * Low-level GitHub API helpers for repo scanning.
 * Uses unauthenticated requests by default; set GITHUB_TOKEN env for higher rate limits.
 */

const GITHUB_API = "https://api.github.com";
const RAW_BASE = "https://raw.githubusercontent.com";

// ---------------------------------------------------------------------------
// Typed error class
// ---------------------------------------------------------------------------

export class GitHubApiError extends Error {
  readonly status: number;
  readonly isPrivate: boolean;
  readonly isRateLimit: boolean;
  readonly isNotFound: boolean;
  /** Milliseconds until the rate-limit window resets (only set when isRateLimit). */
  readonly retryAfterMs: number | undefined;

  constructor(
    message: string,
    opts: {
      status: number;
      isPrivate?: boolean;
      isRateLimit?: boolean;
      isNotFound?: boolean;
      retryAfterMs?: number;
    }
  ) {
    super(message);
    this.name = "GitHubApiError";
    this.status = opts.status;
    this.isPrivate = opts.isPrivate ?? false;
    this.isRateLimit = opts.isRateLimit ?? false;
    this.isNotFound = opts.isNotFound ?? false;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

// ---------------------------------------------------------------------------
// Response → typed error helper (not exported)
// ---------------------------------------------------------------------------

function toGitHubError(res: Response): GitHubApiError {
  const status = res.status;
  const hasToken = Boolean(process.env.GITHUB_TOKEN);

  // 404 — repo/resource not found
  if (status === 404) {
    return new GitHubApiError(
      "Repository not found. Check the URL and try again.",
      { status, isNotFound: true }
    );
  }

  // 401/403 — could be rate-limit or private repo
  if (status === 401 || status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");

    if (remaining === "0") {
      const resetEpoch = Number(res.headers.get("x-ratelimit-reset") ?? "0");
      const retryAfterMs =
        resetEpoch > 0 ? Math.max(0, resetEpoch * 1000 - Date.now()) : undefined;

      const tokenHint = hasToken
        ? ""
        : " Set a GITHUB_TOKEN environment variable for higher rate limits.";

      return new GitHubApiError(
        `GitHub API rate limit exceeded. Resets in ${retryAfterMs !== undefined ? Math.ceil(retryAfterMs / 1000) : "?"}s.${tokenHint}`,
        { status, isRateLimit: true, retryAfterMs }
      );
    }

    // Private repo / insufficient permissions
    const tokenHint = hasToken
      ? " Your GITHUB_TOKEN may lack access to this repository."
      : " Set a GITHUB_TOKEN environment variable to access private repositories.";

    return new GitHubApiError(
      `Access denied (${status}).${tokenHint}`,
      { status, isPrivate: true }
    );
  }

  // Everything else — generic
  return new GitHubApiError(
    `GitHub API error (${status}). Please try again later.`,
    { status }
  );
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Stagent/1.0",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  return h;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

export interface TreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

/**
 * Parse various GitHub URL formats into owner/repo/branch.
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo/tree/branch/path
 * - https://raw.githubusercontent.com/owner/repo/branch/path
 */
export function parseRepoUrl(url: string): RepoInfo | null {
  try {
    const u = new URL(url);

    if (u.hostname === "raw.githubusercontent.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 3) {
        return { owner: parts[0], repo: parts[1], branch: parts[2] };
      }
      return null;
    }

    if (u.hostname !== "github.com") return null;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1];

    // github.com/owner/repo/tree/branch/...
    if (parts.length >= 4 && (parts[2] === "tree" || parts[2] === "blob")) {
      return { owner, repo, branch: parts[3] };
    }

    // github.com/owner/repo — default branch resolved later
    return { owner, repo, branch: "" };
  } catch {
    return null;
  }
}

/** Get the default branch for a repo. */
export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw toGitHubError(res);
  }
  const data = await res.json();
  return data.default_branch ?? "main";
}

/** Get the latest commit SHA for a branch. */
export async function getLatestCommitSha(
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    { headers: headers() }
  );
  if (!res.ok) {
    throw toGitHubError(res);
  }
  const data = await res.json();
  return data.object.sha;
}

/** Get the full recursive tree for a repo at a given SHA/branch. */
export async function getRepoTree(
  owner: string,
  repo: string,
  sha: string
): Promise<TreeEntry[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    { headers: headers() }
  );
  if (!res.ok) {
    throw toGitHubError(res);
  }
  const data = await res.json();
  return data.tree ?? [];
}

/** Fetch raw file content from GitHub. */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  const url = `${RAW_BASE}/${owner}/${repo}/${ref}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw toGitHubError(res);
  }
  return res.text();
}
