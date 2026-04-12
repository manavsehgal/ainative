---
title: "Bug: App install bootstrap failure loses both SAP files and in-memory cache, causing permanent 'no longer available' error"
audience: stagent-base
status: proposed
source_branch: local
handoff_reason: When create_app_bundle's bootstrap step fails, saveSapDirectory() is never reached (it runs after installApp()). The bundle exists only in the module-level bundleCache. On HMR reload or navigation, the cache resets and the bundle is permanently lost — sidebar entry disappears, clicking it shows "Try Again", and the app vanishes from Marketplace My Apps.
---

# Bug: App install bootstrap failure loses both SAP files and in-memory cache

## Summary

When `create_app_bundle` fails during the bootstrap phase of `installApp()`, two things go wrong simultaneously:

1. **SAP directory is never written to disk** — `saveSapDirectory()` runs AFTER `installApp()` in the call chain, so if `installApp()` throws, the `.sap` files are never persisted.
2. **In-memory bundle cache is wiped by HMR** — The `bundleCache` in `registry.ts` is a module-level `Map` that resets on every Turbopack HMR reload. `loadSapBundles()` only runs once at startup via `instrumentation-node.ts`, not on HMR.

The result: the sidebar briefly shows the app (from the in-memory cache set during the current request), but after any HMR cycle or page navigation that triggers a module reload, the cache is empty, the SAP files don't exist, and the DB rows were rolled back. The app is permanently lost.

## Observed Behavior

1. User creates an app via `create_app_bundle` (e.g., "Personal Wellness Tracker")
2. Sidebar briefly shows the app menu entry
3. Clicking the sidebar entry navigates to `/apps/<appId>`
4. **Error:** "Try Again" button displayed
5. Sidebar menu entry disappears after page reload
6. App not listed in Marketplace "My Apps"
7. Console error:
   ```
   AppRuntimeError: Bundle "personal-wellness-tracker-cjjl" is no longer available
       at getAppInstance (src/lib/apps/service.ts:130:11)
       at AppRuntimePage (src/app/apps/[appId]/[[...slug]]/page.tsx:41:34)
   ```

## Reproduction

1. Call `create_app_bundle` to create any new app
2. If bootstrap succeeds — no issue (SAP is written, cache is populated)
3. If bootstrap fails (e.g., table creation error, schedule creation error, registry miss) — the bug manifests
4. Click the sidebar entry → "Try Again" / "no longer available" error
5. Refresh the page → sidebar entry gone, app not in Marketplace

## Root Cause (Two-Bug Interaction)

### Bug 1: SAP write ordering in `app-tools.ts`

```
create_app_bundle flow:
1. synthesizeBundle() → bundle object created ✅
2. registerBundle(bundle) → in-memory cache populated ✅
3. installApp() → bootstrapApp() → ❌ FAILS (throws error)
4. saveSapDirectory(bundle) ← NEVER REACHED (after the throw)
```

`saveSapDirectory()` is called AFTER `installApp()`. When `installApp()` fails during bootstrap (which includes DB rollback), the error propagates up and `saveSapDirectory()` is skipped. The bundle only exists in the in-memory `bundleCache`.

### Bug 2: HMR wipes module-level bundleCache in `registry.ts`

```typescript
// registry.ts
let bundleCache: Map<string, AppBundle> | null = null; // Module-level state

function getBundleCache() {
  if (!bundleCache) {
    bundleCache = loadBundles(); // Only loads BUILTIN_APP_BUNDLES
  }
  return bundleCache;
}
```

In Next.js dev mode (Turbopack), when any file in the dependency tree changes, all module-level state is reset. `bundleCache` goes back to `null`. On next access, `loadBundles()` only loads builtins. `loadSapBundles()` (which scans `~/.stagent/apps/`) only runs at startup via `instrumentation-node.ts`, not on HMR reload.

Since SAP files were never written (Bug 1), there's nothing on disk to reload even if `loadSapBundles` did run.

### Combined effect

```
Request time:  bundleCache has the bundle (in-memory) → sidebar renders ✅
HMR reload:    bundleCache reset → loadBundles() → only builtins → bundle gone ❌
SAP fallback:  loadSapBundles() → no .sap files on disk (never written) → no recovery ❌
DB fallback:   DB rows rolled back by installApp() error handler → no recovery ❌
Result:        Bundle permanently lost from all three sources
```

## Proposed Fix

### Fix 1: Write SAP files BEFORE installApp() (app-tools.ts)

Move `saveSapDirectory()` before `installApp()` so the bundle is persisted to disk regardless of whether bootstrap succeeds:

```typescript
// app-tools.ts — create_app_bundle handler
const bundle = await synthesizeBundle(spec);
registerBundle(bundle);           // 1. register in-memory cache
await saveSapDirectory(bundle);   // 2. persist to disk FIRST
await installApp(bundle.manifest.id, undefined, bundle);  // 3. install (may fail)
```

If `installApp()` fails, the SAP files on disk serve as a recovery source. The user can retry installation, or `loadSapBundles()` will pick it up on next server restart.

### Fix 2: Just-in-time SAP loading on cache miss (registry.ts)

Add a fallback in `getAppBundle()` that checks the SAP directory when a bundle isn't found in the cache:

```typescript
// registry.ts
export function getAppBundle(appId: string): AppBundle | undefined {
  const cache = getBundleCache();
  let bundle = cache.get(appId);
  if (!bundle) {
    bundle = tryLoadSapBundle(appId); // Check ~/.stagent/apps/<appId>/
    if (bundle) cache.set(appId, bundle);
  }
  return bundle;
}
```

This makes the registry resilient to HMR cache wipes — if the bundle was ever written to disk, it can be recovered on demand.

### Fix 3 (Defense in depth): Re-run loadSapBundles on HMR in dev mode

In `instrumentation-node.ts` or via a Next.js `register()` hook, ensure SAP bundles are reloaded after HMR invalidation, not just at cold start.

### Recommended: Fix 1 + Fix 2

Fix 1 prevents data loss. Fix 2 provides resilience against HMR cache invalidation. Together they ensure synthesized bundles survive both bootstrap failures and dev-mode reloads.

## Key Files

| File | Role |
|------|------|
| `src/lib/chat/tools/app-tools.ts` | `create_app_bundle` tool — `saveSapDirectory()` ordering issue |
| `src/lib/apps/registry.ts` | `bundleCache` — module-level state lost on HMR, no fallback to SAP |
| `src/lib/apps/service.ts` | `installApp()` / `bootstrapApp()` — the failing call chain + DB rollback |
| `src/lib/apps/sap-converter.ts` | `saveSapDirectory()` / `sapToBundle()` — SAP persistence |
| `src/instrumentation-node.ts` | `loadSapBundles()` — only runs at cold start |
| `src/app/apps/[appId]/[[...slug]]/page.tsx` | App runtime page — throws `AppRuntimeError` on line 41 |

## Impact

- **All apps created via `create_app_bundle` are lost** if bootstrap fails for any reason
- Sidebar shows a ghost entry that leads to "Try Again" error
- App disappears completely after HMR reload or page refresh
- No recovery path — bundle not on disk, not in cache, not in DB
- User must recreate the app from scratch (which may fail again for the same reason)

## Related

- `bug-create-app-bundle-registry-not-populated.md` — the registry miss that often triggers the bootstrap failure in the first place
- `bug-create-app-bundle-orphan-projects-on-failure.md` — failed installs also leave orphan empty projects
- `bug-app-bundle-not-registered-in-sidebar.md` — related sidebar registration issues
