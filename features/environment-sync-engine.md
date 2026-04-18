---
title: Environment Sync Engine
status: completed
priority: P1
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [git-checkpoint-manager]
---

# Environment Sync Engine

## Description

Bidirectional write-back engine that can create, update, delete, and sync artifacts between Claude Code and Codex environments. Every write operation is preceded by a checkpoint (via git-checkpoint-manager) and shows a preview diff before execution.

The sync engine handles format translation between tools — SKILL.md (Claude) ↔ plain skill files (Codex), `.mcp.json` (JSON) ↔ `config.toml` (TOML) for MCP servers, and settings format differences. It detects conflicts when target files already exist and differ from the source.

## User Story

As a ainative user with both Claude Code and Codex, I want to sync a skill that exists only in Claude Code over to Codex — and vice versa — with a preview of what will change and the ability to rollback, so I can maintain consistent configurations across my tools without manual file copying and format translation.

## Technical Approach

### Sync Operations

Each sync operation has: source artifact, target tool, target path, and operation type (create/update/delete/sync-cross-tool).

**`src/lib/environment/sync-engine.ts`** — Orchestrator:
- **`previewSync(operations[])`** — Dry-run that returns diffs for each operation. Shows file path, unified diff, whether it's a new file, and any conflicts detected. Does NOT modify any files.
- **`executeSync(operations[], checkpointLabel?)`** — Calls checkpoint manager first, then applies all operations. Records each op in `environment_sync_ops`. Returns results array with status per operation.
- **`detectConflicts(operation)`** — Checks if target file exists and differs from what would be written. Returns conflict description if detected.

### Format Translation Modules

- **`src/lib/environment/sync/skill-sync.ts`** — Translates between Claude Code SKILL.md format (YAML frontmatter + markdown body) and Codex skill format (plain markdown, possibly different directory structure). Preserves metadata where possible.
- **`src/lib/environment/sync/mcp-sync.ts`** — Translates MCP server definitions between `.mcp.json` (JSON with command/args/env) and `config.toml` [mcp_servers.name] section (TOML). Handles nested args arrays, env var mappings.
- **`src/lib/environment/sync/instruction-sync.ts`** — Handles CLAUDE.md ↔ AGENTS.md content merging. Appends tool-specific sections, preserves existing content, marks ainative-managed blocks with comment markers.
- **`src/lib/environment/sync/permission-sync.ts`** — Maps Claude Code permission allow rules to Codex trust level concepts. This is informational/advisory since the permission models differ fundamentally.
- **`src/lib/environment/sync/hook-sync.ts`** — Exports hook definitions. Translates between Claude Code settings.json hook format and Codex rules format where possible.

### Diff Generation

**`src/lib/environment/diff.ts`** — Generates unified diffs for the preview:
- For new files: shows entire content as additions
- For updates: shows line-by-line diff between current and proposed content
- For deletes: shows entire content as removals
- Uses simple line-diff algorithm (no external dependency needed)

### API Routes

- **`POST /api/environment/sync/preview`** — Accepts operations array, returns diffs and conflict info
- **`POST /api/environment/sync`** — Accepts operations array + optional checkpoint label, executes with auto-checkpoint
- **`GET /api/environment/sync/history?projectId=xxx`** — Past sync operations with status

### UI Components (`src/components/environment/`)

- **`sync-action-buttons.tsx`** — Per-artifact buttons: "Sync to Claude Code", "Sync to Codex", "Edit", "Delete". Shown in artifact cards and detail sheet. Disabled if target already has the artifact.
- **`sync-preview-dialog.tsx`** — Modal showing all pending changes with unified diffs. Each change has a toggle to include/exclude. "Apply" and "Cancel" buttons. Shows checkpoint info.
- **`conflict-resolution-panel.tsx`** — When conflicts detected: shows source vs target side-by-side, options to overwrite, skip, or merge manually.

### Sync Workflow

1. User clicks "Sync to Codex" on a Claude Code skill
2. Frontend calls `POST /api/environment/sync/preview` with the operation
3. Preview dialog shows the diff — what file will be created/modified
4. User reviews and clicks "Apply"
5. Frontend calls `POST /api/environment/sync` — backend creates checkpoint, writes file, logs op
6. Dashboard refreshes with re-scan showing the newly synced artifact
7. If anything went wrong, user clicks "Rollback" from checkpoint list

## Acceptance Criteria

- [ ] Sync preview shows accurate unified diffs before any file modification
- [ ] Skill sync translates SKILL.md format to Codex skill format and vice versa
- [ ] MCP sync translates .mcp.json to config.toml and vice versa
- [ ] Instruction sync merges content preserving existing text
- [ ] Every sync operation is preceded by an automatic checkpoint
- [ ] Conflict detection identifies when target file already exists and differs
- [ ] Sync operations are logged in environment_sync_ops table
- [ ] Sync history API returns past operations with status
- [ ] Sync action buttons appear on artifact cards in the dashboard
- [ ] Preview dialog shows toggleable diffs for batch operations
- [ ] Conflict resolution panel offers overwrite/skip/merge options
- [ ] Failed sync operations show error messages and don't corrupt target files

## Scope Boundaries

**Included:**
- Bidirectional sync for skills, MCP servers, instructions, hooks
- Format translation between Claude Code and Codex formats
- Preview diffs before execution
- Auto-checkpoint before every sync
- Conflict detection and resolution UI
- Sync operation history

**Excluded:**
- Plugin sync (plugins are tool-specific, can't be cross-installed)
- Credential sync (security risk too high)
- Auto-sync on file change (manual trigger only in v1)
- Real-time conflict resolution during concurrent edits

## References

- Source: environment onboarding plan — Feature 5
- Dependency: git-checkpoint-manager (checkpoint before every sync)
- Related features: environment-dashboard (hosts sync controls), environment-templates (uses sync engine for template application)
