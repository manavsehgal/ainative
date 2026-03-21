---
title: Git Checkpoint Manager
status: planned
priority: P1
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [environment-cache]
---

# Git Checkpoint Manager

## Description

Git-based checkpoint and rollback system that provides safety for all environment write-back operations. Before any sync operation modifies files, the checkpoint manager creates a snapshot — using git commits/tags for project-level files (inside a git repo) and file backups for global-level files (`~/.claude/`, `~/.codex/` which are not git repos).

Additionally, this feature provides git worktree management for onboarded projects — viewing active worktrees, creating worktrees for feature branches, and cleaning up stale ones. Each worktree can have its own environment scan.

## User Story

As a Stagent user about to sync configuration between Claude Code and Codex, I want Stagent to automatically create a checkpoint before making any changes, so I can safely rollback to the previous state if something goes wrong.

As a developer working on an onboarded project, I want to manage git worktrees from Stagent's UI, so I can work on feature branches in isolation and see each worktree's environment configuration separately.

## Technical Approach

### Checkpoint System

**`src/lib/environment/git-manager.ts`** — Core git operations:

- **`createCheckpoint(projectPath, label, affectedPaths[])`** — For paths inside a git repo: stages affected files, commits with `[stagent-checkpoint] pre-sync: {label}`, tags with `stagent/checkpoint/{id}`. For paths outside git (~/.claude/, ~/.codex/): copies affected files to `~/.stagent/backups/{timestamp}/{relative-path}`. Records checkpoint in `environment_checkpoints` table with git_tag/git_commit_sha or backup_path.
- **`rollbackCheckpoint(checkpointId)`** — For git checkpoints: `git checkout {sha} -- {affected paths}` to restore files. For backup checkpoints: copies from backup dir back to original locations. Updates checkpoint status to "rolled_back" and all associated sync_ops.
- **`listCheckpoints(projectId)`** — Returns checkpoint history with labels, timestamps, file counts, and status.
- **`isGitRepo(path)`** — Checks if a path is inside a git repository.
- **`getCheckpointDiff(checkpointId)`** — Shows what changed since the checkpoint using `git diff` for git checkpoints or file comparison for backups.

### Hybrid Strategy

The checkpoint mechanism automatically selects the right approach:
- **Project-level paths** (inside `workingDirectory`): Uses git commits + tags. These are already in a git repo.
- **Global paths** (`~/.claude/`, `~/.codex/`): Uses file backup to `~/.stagent/backups/`. These directories are NOT git repos.
- **Mixed operations** (e.g., sync a skill from project to `~/.codex/`): Creates both a git checkpoint for project files AND a file backup for global files, linked to the same checkpoint record.

### Git Tag Naming

Tags follow `stagent/checkpoint/{nanoid}` format. If tag already exists (collision), append timestamp suffix. Tags are local only — never pushed.

### Worktree Management

**`src/lib/environment/git-worktree.ts`**:

- **`listWorktrees(projectPath)`** — Runs `git worktree list --porcelain`, parses output into structured data (path, branch, HEAD SHA, prunable status).
- **`createWorktree(projectPath, branchName, targetDir?)`** — Creates a new worktree. Default target: `{projectPath}/../{repo-name}-{branch}`.
- **`removeWorktree(worktreePath)`** — Removes worktree after confirming it's safe (no uncommitted changes). Uses `git worktree remove`.
- **`pruneWorktrees(projectPath)`** — Runs `git worktree prune` to clean up stale entries.
- **`getWorktreeStatus(worktreePath)`** — Returns branch, ahead/behind, dirty status.

Each worktree can be scanned independently via the environment scanner by passing the worktree path instead of the main project path.

### API Routes

- **`GET /api/environment/checkpoints?projectId=xxx`** — List checkpoints for a project
- **`POST /api/environment/checkpoints`** — Create manual checkpoint (label + paths)
- **`POST /api/environment/checkpoints/[id]/rollback`** — Execute rollback
- **`GET /api/environment/checkpoints/[id]/diff`** — Show what changed since checkpoint
- **`GET /api/environment/worktrees?projectId=xxx`** — List worktrees
- **`POST /api/environment/worktrees`** — Create worktree (branch name)
- **`DELETE /api/environment/worktrees/[path]`** — Remove worktree

### UI Components (`src/components/environment/`)

- **`checkpoint-list.tsx`** — Table/list of checkpoints: label, timestamp, file count, git SHA (truncated), status badge, "Rollback" button, "View Diff" button
- **`rollback-confirm-dialog.tsx`** — Confirmation modal showing files that will be restored, warns about potential conflicts
- **`worktree-panel.tsx`** — Panel showing active worktrees with branch name, status, path, "Scan" button (scan that worktree), "Remove" button
- **`worktree-create-dialog.tsx`** — Dialog to create a new worktree: branch name input, target directory

## Acceptance Criteria

- [ ] Checkpoint creation works for project-level files (git commit + tag)
- [ ] Checkpoint creation works for global files (~/.stagent/backups/)
- [ ] Mixed checkpoints handle both git and backup paths
- [ ] Rollback restores files to pre-checkpoint state (git checkout for git, copy for backups)
- [ ] Rollback updates checkpoint and sync_op statuses in DB
- [ ] Checkpoint diff shows what changed since the snapshot
- [ ] Git tag naming handles collisions gracefully
- [ ] Worktree list shows all active worktrees with branch and status
- [ ] Worktree creation succeeds with valid branch name
- [ ] Worktree removal checks for uncommitted changes before removing
- [ ] Worktree pruning cleans up stale entries
- [ ] Each worktree can be scanned independently
- [ ] Checkpoint list UI shows history with rollback controls
- [ ] Rollback confirmation dialog shows affected files

## Scope Boundaries

**Included:**
- Git-based checkpoints for project files
- File-backup checkpoints for global directories
- Rollback to any checkpoint
- Checkpoint history and diff viewing
- Git worktree CRUD (list, create, remove, prune)
- Per-worktree environment scanning

**Excluded:**
- Sync operation logic (see environment-sync-engine — uses checkpoint manager as a dependency)
- Branch management beyond worktrees (push, merge, rebase)
- Remote operations (no git push/pull)
- File watching for automatic checkpoint triggers

## References

- Source: environment onboarding plan — Feature 4
- Pattern: `.claude/worktrees/` — existing worktree usage in project
- Pattern: `superpowers:finishing-a-development-branch` — existing worktree workflow skill
- Related features: environment-sync-engine (calls checkpoint before every write-back)
