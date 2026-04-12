---
title: "Bug: export_app_bundle creates duplicate project on re-export"
audience: stagent-base
status: proposed
source_branch: local
handoff_reason: Re-exporting an app bundle for an existing project creates a brand new empty project instead of reusing the existing one. Combined with the lack of a delete_project tool, this leaves orphan projects that clutter the workspace.
---

# Bug: export_app_bundle creates duplicate project on re-export

## Summary

When `export_app_bundle` is called on an existing project that has already been exported, it creates a **new empty project** instead of updating the existing bundle or reusing the existing project. This is unexpected — users expect re-exporting to update the bundle in-place, not duplicate the project.

## Reproduction

1. Create project "My Health Dashboard" (`32d4fa64`) with 5 tables and 4 schedules
2. Call `export_app_bundle` → bundle saved to `~/.stagent/apps/my-health-dashboard-3lz5/` ✅
3. Sidebar bug means app doesn't appear, so user tries re-exporting
4. Call `export_app_bundle` again → creates a **new** project (`5eb071d2`) with 0 tables, 0 schedules
5. Bundle saved to `~/.stagent/apps/my-health-dashboard-7i9z/` (new ID)
6. **Result:** Two projects with the same name, one empty

## Expected Behavior

Re-exporting should either:
- **Update** the existing bundle on disk (overwrite `my-health-dashboard-3lz5/`)
- **Or** reuse the existing project and re-snapshot its current tables/schedules
- **Not** create a new empty project

## Root Cause

`export_app_bundle` always generates a new app ID (`slugifiedName-shortId`) and creates a fresh project as part of the bundle scaffolding, regardless of whether the source project already has a bundle. There is no deduplication or "update existing bundle" logic.

## Proposed Fix

1. **Check for existing bundles**: Before creating a new bundle, check if the source project already has an associated bundle (either by scanning `~/.stagent/apps/` for matching project IDs or by maintaining a bundle registry)
2. **Update in-place**: If a bundle already exists for this project, update its contents rather than creating a new one
3. **Skip project creation**: When re-exporting, don't create a new project — snapshot the existing project's tables and schedules into the bundle
4. **Add `delete_project` tool**: As a safety net for cleanup (see sibling handoff)

## Impact

- Every re-export attempt creates an orphan empty project
- Users cannot clean up orphans without direct DB access
- Multiple bundle directories on disk for the same logical app
- Confusing project list with duplicate names

## Related

- `bug-app-bundle-not-registered-in-sidebar.md` — the original bug that triggers users to attempt re-export
- `bug-create-app-bundle-orphan-projects-on-failure.md` — same orphan project pattern from `create_app_bundle`
- `bug-create-app-bundle-registry-not-populated.md` — registry gap affecting both tools
