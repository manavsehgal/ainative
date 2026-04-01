---
title: Workspace Context Awareness
status: completed
priority: P1
milestone: post-mvp
source: dogfooding discovery (worktree usage, 2026-03-23)
dependencies: [chat-engine, environment-scanner]
---

# Workspace Context Awareness

## Description

When Stagent runs from a git worktree, agents create files in the main repository folder instead of the active worktree directory. The underlying plumbing works correctly — `STAGENT_LAUNCH_CWD` captures the launch directory and the SDK `cwd` parameter is set — but agents don't receive enough context to understand they're in a worktree or that they should create files relative to their working directory.

This feature surfaces existing workspace context (working directory, git branch, worktree status) to agents through the system prompt and the `get_settings` tool, and adds explicit file-creation guidance to prevent path-inference errors.

## User Story

As a developer running Stagent from a git worktree, I want agents to create files in the worktree directory so that my work stays isolated from the main repository.

## Technical Approach

- Extend `buildTier0` in `context-builder.ts` to accept a `WorkspaceContext` object and emit git branch + worktree guidance note when `isWorktree: true`
- Pass `getWorkspaceContext()` from `engine.ts` through to the context builder (override cwd with project's `workingDirectory` when set)
- Add `workspace_cwd`, `workspace_git_branch`, `workspace_is_worktree`, `workspace_folder_name` fields to `get_settings` tool response
- Add a universal file-creation guideline to `system-prompt.ts` Guidelines section
- Apply the same worktree guidance note to task execution system instructions in `claude-agent.ts`
- Reuse existing `getWorkspaceContext()` from `workspace-context.ts` — no new detection logic needed

## Acceptance Criteria

- [ ] System prompt Tier 0 includes `Git branch:` and `Worktree: yes` when running from a worktree
- [ ] System prompt includes worktree guidance note (file creation relative to cwd) when `isWorktree: true`
- [ ] `get_settings` tool returns `workspace_*` fields (cwd, git_branch, is_worktree, folder_name)
- [ ] Task execution system instructions include worktree guidance when `isWorktree: true`
- [ ] System prompt includes universal file-creation guideline regardless of worktree status
- [ ] No worktree guidance appears when running from a non-worktree directory (regression check)

## Scope Boundaries

**Included:**
- Surfacing existing workspace context to agents via system prompt and tools
- Worktree-conditional guidance in chat and task execution
- Universal file-creation guideline in system prompt

**Excluded:**
- Auto-setting `project.workingDirectory` from worktree on project creation (separate concern)
- New environment variables (STAGENT_LAUNCH_CWD already covers the use case)
- Changes to `workspace-context.ts` detection logic (already correct)

## References

- Source: dogfooding discovery — file created in main repo instead of worktree during chat session
- Existing code: `src/lib/environment/workspace-context.ts` — `getWorkspaceContext()` returns `{ cwd, folderName, parentPath, gitBranch, isWorktree }`
- Related features: `chat-engine`, `environment-scanner`
