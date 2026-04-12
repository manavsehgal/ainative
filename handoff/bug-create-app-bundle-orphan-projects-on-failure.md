---
title: "Bug: create_app_bundle leaves orphan empty projects on failure"
audience: stagent-base
status: proposed
source_branch: local
handoff_reason: Each failed create_app_bundle call creates a new empty project as a side effect before hitting the registry error, leaving behind orphan projects that cannot be cleaned up via MCP tools.
---

# Bug: create_app_bundle leaves orphan empty projects on failure

## Summary

When `create_app_bundle` fails (due to the registry bug documented in `bug-create-app-bundle-registry-not-populated.md`), it **creates a new empty project as a side effect** before the failure occurs. Each retry compounds the problem — in one session, 3 failed attempts created 3 orphan empty projects alongside the original.

There is no `delete_project` MCP tool, so these orphan projects cannot be cleaned up via chat. They clutter the projects list and confuse users.

## Reproduction

1. Create a project with tables and schedules (e.g., "My Health Dashboard" — `32d4fa64`)
2. Call `create_app_bundle` to bundle it → fails with `Bundle "<appId>" is no longer available`
3. A new empty project is created (e.g., `c84abec0`) with no tables or schedules
4. Retry `create_app_bundle` → same failure, another empty project (`b870e2c2`)
5. **Result:** 3 orphan empty projects alongside the original

### Observed state after 3 attempts:

| Project | ID (prefix) | Tables | Schedules | Status |
|---------|-------------|--------|-----------|--------|
| My Health Dashboard (original) | `32d4fa64` | 5 | 4 | ✅ Working |
| My Health Dashboard (orphan 1) | `5eb071d2` | 0 | 0 | ❌ Empty — from `export_app_bundle` |
| Health (orphan 2) | `c84abec0` | 0 | 0 | ❌ Empty — from `create_app_bundle` |
| My Health Dashboard (orphan 3) | `b870e2c2` | 0 | 0 | ❌ Empty — from `create_app_bundle` |

## Root Cause

In the `create_app_bundle` call chain:

```
1. synthesizeBundle() → creates bundle manifest ✅
2. Creates a new project for the app ← SIDE EFFECT (committed to DB)
3. installApp() → bootstrapApp() → getAppBundle() → ❌ FAILS (registry miss)
4. Error thrown — but project from step 2 is already persisted
```

The project creation in step 2 is **not wrapped in a transaction** with the install step, so the side effect persists even when the overall operation fails.

## Proposed Fix

### Option A: Transaction rollback
Wrap the entire `create_app_bundle` flow (project creation + bundle registration + installApp) in a database transaction. If any step fails, roll back all changes including the project.

### Option B: Pre-validate before side effects
Call `getAppBundle()` or validate registry availability **before** creating the project. Only create the project after confirming the bundle can be registered.

### Option C: Add `delete_project` MCP tool
As a complementary fix, expose a `delete_project` tool so users/agents can clean up orphaned projects. This doesn't fix the root cause but provides a recovery path.

### Recommended: Option B + Option C
Pre-validate to prevent orphans, and add `delete_project` as a general-purpose cleanup tool.

## Impact

- Every failed `create_app_bundle` call leaves an orphan empty project
- No MCP tool exists to delete projects — cleanup requires direct DB access or GUI
- Users see duplicate project names in their project list with no way to distinguish or remove them
- Compounds the confusion from the registry bug

## Related

- `bug-create-app-bundle-registry-not-populated.md` — the underlying registry failure that triggers this
- `bug-app-bundle-not-registered-in-sidebar.md` — `export_app_bundle` also creates duplicate projects
