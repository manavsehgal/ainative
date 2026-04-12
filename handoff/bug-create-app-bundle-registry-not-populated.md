---
title: "Bug: create_app_bundle fails — registry never populated with synthesized bundles"
audience: stagent-base
status: proposed
source_branch: local
handoff_reason: create_app_bundle synthesizes a bundle and calls installApp(), but installApp() calls getAppInstance() which looks up the bundle in the registry — and the registry only contains builtins. The synthesized bundle is never registered, so installation always fails with "no longer available".
---

# Bug: create_app_bundle fails — registry never populated with synthesized bundles

## Summary

`create_app_bundle` synthesizes a new app bundle at runtime, then calls `installApp()` to install it. But `installApp()` internally calls `bootstrapApp()` → `getAppInstance()` → `getAppBundle(appId)`, which looks up the bundle in `registry.ts`'s cache. The registry **only loads bundles from `BUILTIN_APP_BUNDLES`** (Wealth, Growth) — it never registers synthesized bundles. So every `create_app_bundle` call fails with:

```
AppRuntimeError: Bundle "<appId>" is no longer available
```

## Reproduction

1. Use `create_app_bundle` MCP tool to create any new app
2. Tool synthesizes bundle successfully (manifest, tables, schedules, pages)
3. Tool calls `installApp(bundle.manifest.id, undefined, bundle)`
4. `installApp()` inserts DB record, then calls `bootstrapApp()`
5. `bootstrapApp()` calls `getAppInstance()` which calls `getAppBundle(appId)`
6. `getAppBundle()` searches registry cache — bundle not found
7. **Error:** `Bundle "<appId>" is no longer available`

## Root Cause

### Registry only loads builtins (`registry.ts`)

```typescript
// registry.ts — loadBundles()
function loadBundles(): Map<string, AppBundle> {
  const bundles = new Map<string, AppBundle>();
  for (const bundle of BUILTIN_APP_BUNDLES) {  // <-- ONLY BUILTINS
    const parsed = appBundleSchema.safeParse(bundle);
    bundles.set(parsed.data.manifest.id, parsed.data);
  }
  return bundles;
}
```

The `bundleCache` is lazily initialized from `BUILTIN_APP_BUNDLES` only. There is no API to register a bundle at runtime.

### The call chain that fails (`service.ts`)

```
installApp(appId)           // line ~240 — inserts DB record ✅
  → bootstrapApp(appId)     // line ~262
    → getAppInstance(appId)  // line ~267
      → getAppBundle(appId)  // line ~106 — registry lookup ❌ NOT FOUND
        → throw AppRuntimeError("Bundle is no longer available")
```

### Why builtins work

Wealth Manager and Growth Module are hardcoded in `builtins.ts` → `BUILTIN_APP_BUNDLES`. They're loaded into the registry cache on first access, so `getAppBundle()` always finds them.

## Proposed Fix

Add a `registerBundle()` function to `registry.ts` that inserts a bundle into the runtime cache:

```typescript
// registry.ts
export function registerBundle(bundle: AppBundle): void {
  const cache = getBundleCache(); // ensures lazy init
  cache.set(bundle.manifest.id, bundle);
}
```

Then call it in `create_app_bundle` (app-tools.ts) **before** calling `installApp()`:

```typescript
// app-tools.ts — create_app_bundle handler
const bundle = await synthesizeBundle(spec);
registerBundle(bundle);          // NEW: register in runtime cache
await saveSapDirectory(bundle);  // persist to disk
await installApp(bundle.manifest.id, undefined, bundle);  // now succeeds
```

Also update `loadBundles()` to scan `~/.stagent/apps/` on startup so previously-created bundles survive server restarts.

## Key Files

| File | Role |
|------|------|
| `src/lib/apps/registry.ts` | Bundle cache — only loads builtins, needs `registerBundle()` |
| `src/lib/apps/service.ts` | `installApp()` / `bootstrapApp()` / `getAppInstance()` — the failing call chain |
| `src/lib/apps/builtins.ts` | Hardcoded Wealth/Growth bundles |
| `src/lib/chat/tools/app-tools.ts` | `create_app_bundle` tool — needs to call `registerBundle()` before install |
| `src/lib/apps/synthesizer.ts` | `synthesizeBundle()` — creates bundle at runtime (works fine) |

## Impact

- **All `create_app_bundle` calls fail** — no custom apps can be installed via chat
- `export_app_bundle` is unaffected (it skips `installApp()` entirely — but has its own bug, see sibling handoff)
- Built-in apps unaffected
- No workaround via UI

## Related

- `bug-app-bundle-not-registered-in-sidebar.md` — `export_app_bundle` never calls `installApp()` at all
- Both bugs stem from the same root issue: the registry has no mechanism for runtime bundle registration
