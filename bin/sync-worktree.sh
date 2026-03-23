#!/usr/bin/env bash
set -euo pipefail

# Sync a stagent worktree with the latest main branch.
# Usage: npm run sync-worktree  (or bash bin/sync-worktree.sh)

# Verify we're in a worktree, not the main repo
if ! git rev-parse --git-common-dir >/dev/null 2>&1; then
  echo "Error: not inside a git repository" >&2
  exit 1
fi

COMMON_DIR="$(git rev-parse --git-common-dir)"
GIT_DIR="$(git rev-parse --git-dir)"
if [ "$COMMON_DIR" = "$GIT_DIR" ]; then
  echo "Error: this appears to be the main repo, not a worktree." >&2
  echo "Run this from a worktree directory (e.g. ../stagent-worktrees/<name>)" >&2
  exit 1
fi

BRANCH="$(git branch --show-current)"
echo "==> Syncing worktree branch '$BRANCH' with main..."

# Stash any uncommitted changes
STASHED=false
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "==> Stashing uncommitted changes..."
  git stash push -m "sync-worktree auto-stash"
  STASHED=true
fi

echo "==> Rebasing onto main..."
git rebase main

# Restore stashed changes
if [ "$STASHED" = true ]; then
  echo "==> Restoring stashed changes..."
  git stash pop
fi

# Conditional npm install
if git diff HEAD@{1} -- package-lock.json 2>/dev/null | head -1 | grep -q .; then
  echo "==> Dependencies changed, running npm install..."
  npm install
else
  echo "==> No dependency changes, skipping npm install"
fi

echo "==> Sync complete. Start with: npm run dev"
