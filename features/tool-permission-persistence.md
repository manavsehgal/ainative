---
title: Tool Permission Persistence
status: completed
priority: P2
layer: Platform
dependencies:
  - agent-integration
  - inbox-notifications
---

# Tool Permission Persistence

## Summary

"Always Allow" option for agent tool permissions, eliminating repeated approval prompts for trusted tools. Saved patterns are checked before creating notifications, bypassing the polling loop entirely.

## Problem

Every `canUseTool` call creates a notification and waits for human approval — even for the same tool the user has approved dozens of times. This is safe but creates friction for frequently-used tools like `Read`, `Write`, or `git` commands.

## Solution

Add an "Always Allow" button alongside the existing "Allow" in the Inbox permission UI. When clicked, the permission pattern is saved to the settings table. On subsequent tool invocations, `handleToolPermission()` checks saved patterns before creating a notification — trusted tools are auto-approved instantly.

### Permission Pattern Format

Following Claude Code's convention:
- **Tool-level**: `"Read"`, `"Write"` — blanket allow for any invocation
- **Pattern-level**: `"Bash(command:git *)"` — matches Bash when command starts with `git`
- **MCP tools**: `"mcp__server__tool"` — exact match

### Architecture

- Patterns stored as JSON array under settings key `permissions.allow`
- Pre-check inserted at top of `handleToolPermission()` (3-line guard clause)
- `AskUserQuestion` is never auto-allowed (always requires human input)
- Settings page shows all saved patterns with revoke capability

## Acceptance Criteria

1. [x] Permission action shows "Allow Once" and "Always Allow" buttons
2. [x] "Always Allow" saves a permission pattern to the database
3. [x] Pre-approved tools are auto-allowed without creating a notification
4. [x] `AskUserQuestion` always prompts regardless of saved permissions
5. [x] Settings page shows all saved permission patterns
6. [x] Patterns can be revoked from Settings page
7. [x] Revoking a pattern makes tools prompt again
8. [x] Bash commands get granular patterns by default (e.g., `Bash(command:git *)`)
9. [x] Pattern matching supports tool-level and constraint-level patterns
10. [x] Permissions API supports GET/POST/DELETE operations

## Technical Approach

- **Settings helpers**: Extracted `getSetting`/`setSetting` into shared `src/lib/settings/helpers.ts`
- **Permissions module**: `src/lib/settings/permissions.ts` with CRUD + matching algorithm
- **Guard clause**: 3-line pre-check in `handleToolPermission()` using dynamic import
- **API**: `GET/POST/DELETE /api/permissions` for settings UI
- **UI**: `PermissionsSection` component in Settings page
- **No migration**: Uses existing `settings` table with new key
