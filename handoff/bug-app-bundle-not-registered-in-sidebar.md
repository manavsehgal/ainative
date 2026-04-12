---
title: "Bug: Exported App Bundle Not Registered in Sidebar"
audience: stagent-base
status: proposed
source_branch: local
handoff_reason: The export_app_bundle MCP tool saves bundle files to disk but never registers them in the database, so exported apps never appear in the sidebar.
---

# Bug: Exported App Bundle Not Registered in Sidebar

## Summary

When a user creates an app bundle via the `export_app_bundle` MCP tool (e.g., "create an app bundle for My Health Dashboard"), the bundle is saved to `~/.stagent/apps/<app-id>/` on disk but **never inserted into the `app_instances` database table**. Since the sidebar only renders apps that have a DB record with `status: "ready"`, the exported app never appears in the sidebar — even though the bundle files exist on disk.

Built-in apps (Wealth, Growth) work correctly because they go through `installApp()` which inserts the DB record. Exported apps skip this step entirely.

## Reproduction

1. Create a project with tables and schedules (e.g., "My Health Dashboard")
2. Use `export_app_bundle` / `create_app_bundle` MCP tool to bundle it
3. Tool succeeds — files written to `~/.stagent/apps/my-health-dashboard-3lz5/`
4. **Expected:** App appears in sidebar alongside Wealth/Growth
5. **Actual:** App does not appear in sidebar. No DB record exists.

## Root Cause

### Built-in apps (works) — `src/lib/apps/builtins.ts` + `registry.ts`

```
1. builtins.ts defines bundle metadata
2. loadBundles() registers them in the bundle registry
3. installApp() inserts record into app_instances DB table with status: "ready"
4. Sidebar API queries app_instances → finds record → renders sidebar entry ✅
```

### Exported apps (broken) — `src/lib/mcp/tools/app-tools.ts` (~line 315-370)

```
1. export_app_bundle saves bundle to ~/.stagent/apps/<id>/ on disk ✅
2. Bundle is NOT registered in the bundle registry ❌
3. installApp() is NEVER called — no DB record created ❌
4. Sidebar API queries app_instances → finds nothing → no sidebar entry ❌
```

The gap is in `app-tools.ts`: after `saveSapDirectory()` completes, the function returns success without calling `installApp()` or registering the bundle.

## Proposed Fix

Two changes needed:

### 1. `registry.ts` — Load exported bundles from disk

Extend `loadBundles()` (or add a parallel loader) to scan `~/.stagent/apps/` for exported bundle directories in addition to the built-in bundles. Each valid bundle directory should be registered in the in-memory bundle registry so `installApp()` can find it.

### 2. `app-tools.ts` — Register after export

After `saveSapDirectory()` succeeds in the `export_app_bundle` tool handler, call `installApp()` to:
- Insert a record into `app_instances` with `sourceType: "file"` and `status: "ready"`
- Link the bundle to the originating project
- This makes the sidebar API immediately pick it up

### Pseudocode

```typescript
// In app-tools.ts, after saveSapDirectory():
const bundleId = `${slugifiedName}-${shortId}`;
await saveSapDirectory(bundlePath, bundleData);

// NEW: Register bundle in registry so installApp can resolve it
registerExternalBundle(bundleId, bundlePath);

// NEW: Insert DB record so sidebar renders it
await installApp({
  bundleId,
  projectId,
  sourceType: "file",
  sourcePath: bundlePath,
  status: "ready",
});
```

## Impact

- **All exported app bundles** are affected — none appear in the sidebar
- Built-in apps are unaffected (they use a separate install path)
- Workaround: None via the UI. The bundle exists on disk but there's no way to manually register it without code changes.
