---
title: My Apps Tab & User-Built App Lifecycle
status: planned
priority: P1
milestone: post-mvp
source: (conversation — 2026-04-12)
dependencies: [app-runtime-bundle-foundation, app-uninstall]
---

# My Apps Tab & User-Built App Lifecycle

## Description

User-built apps (created via project export, `sourceType: "file"`) are stored as SAP directories in `~/.stagent/apps/{appId}/` and loaded into the bundle registry at startup by `loadSapBundles()`. Today they only appear in Settings > Installed Apps — there is no marketplace-style browsing, no way to re-install after uninstalling, and no way to permanently delete a SAP directory from disk.

This feature adds a "My Apps" tab to the marketplace that lists all user-built apps regardless of install state. It introduces three card states (Installed, Archived, Failed), a re-install flow for archived apps, and a permanent delete flow that removes the SAP directory from disk. Uninstalling a user-built app archives it by default (preserves SAP dir, removes DB row), enabling re-install later.

## User Story

As a Stagent user who has exported projects into apps, I want to browse all my user-built apps in the marketplace, see which ones are installed vs. archived, re-install archived apps with one click, and permanently delete apps I no longer need — so that I have full lifecycle control over apps I've created.

## Technical Approach

### State Machine

```
  export/synthesize ──► INSTALLED (SAP dir + DB row)
  uninstall          ──► ARCHIVED  (SAP dir only, DB row deleted)
  reinstall          ──► INSTALLED (new project + bootstrap from cached bundle)
  delete(archived)   ──► DELETED   (SAP dir removed, bundle deregistered)
  delete(installed)  ──► DELETED   (uninstall first, then remove SAP dir)
```

### Data Source Reconciliation

"My Apps" cross-references two sources:
- **Registry** (`bundleCache`): all SAP-loaded bundles (loaded at startup by `loadSapBundles()`)
- **Database** (`app_instances` where `sourceType = "file"`): installed instances

State derivation:
- SAP in registry + DB row with `status = ready|disabled` → **Installed**
- SAP in registry + DB row with `status = failed` → **Failed**
- SAP in registry + no DB row → **Archived**

### Registry Changes (`src/lib/apps/registry.ts`)

1. Add `bundleSourceMap: Map<string, "builtin" | "sap">` to track load origin
2. Tag entries during `loadBundles()` (builtin) and `loadSapBundles()` (sap)
3. Track failed SAP loads: `failedSapLoads: Map<string, string>` (appId → error)
4. New exports: `listSapBundleIds()`, `getBundleSource()`, `deregisterBundle()`

### Service Layer (`src/lib/apps/service.ts`)

1. **`listMyApps(): MyAppEntry[]`** — cross-reference SAP bundle IDs with `app_instances` rows, derive state per app
2. **`reinstallArchivedApp(appId)`** — get bundle from cache, call `installApp()` with `sourceType: "file"` override. Creates NEW project (not re-linking to old source project)
3. **`deleteSapApp(appId)`** — verify archived state, `fs.rm()` the SAP dir, call `deregisterBundle()`
4. **Modify `installApp()`** — accept optional `sourceType` parameter (currently hardcoded to `"builtin"` at line 266)
5. **Modify `uninstallApp()`** — accept optional `deleteSap` flag. When true + `sourceType = "file"`, also remove SAP dir
6. **Filter `listAppCatalog()`** — exclude `trustLevel: "private"` entries to prevent duplication with My Apps tab

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/apps/my` | GET | List all user-built apps with state |
| `/api/apps/my/[appId]/reinstall` | POST | Re-install archived app |
| `/api/apps/my/[appId]/delete` | POST | Permanently delete SAP dir (+ optionally project) |

### UI Components

1. **`MyAppsPanel`** (`src/components/marketplace/my-apps-panel.tsx`) — tab content, fetches from `/api/apps/my`, renders grid of `MyAppCard` + filter bar + empty state
2. **`MyAppCard`** (`src/components/marketplace/my-app-card.tsx`) — card with three visual treatments per state
3. **`DeleteAppConfirmationDialog`** (`src/components/apps/delete-app-confirmation-dialog.tsx`) — permanent deletion dialog, distinct from uninstall
4. Add "My Apps" tab to `MarketplaceBrowser` (`src/components/marketplace/marketplace-browser.tsx`)

### Card States & Actions

| State | Badge | Surface | Actions |
|-------|-------|---------|---------|
| Installed | `success` "Installed" | Full opacity | Open, Uninstall |
| Archived | `secondary` "Archived" | `opacity-70` | Re-install (primary), Delete |
| Failed | `destructive` "Failed" | `border-l-4 border-destructive/30` | Retry, Delete |

### Delete Confirmation Dialog

- Title: "Delete {App Name}?"  
- Body: "This will permanently remove the app package from your device. This cannot be undone."
- If app is installed: show "Also uninstall and remove project data" checkbox
- Button: "Delete Permanently" (destructive)

### Types (`src/lib/apps/types.ts`)

```typescript
type MyAppState = "installed" | "archived" | "failed";

interface MyAppEntry {
  appId: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  trustLevel: AppTrustLevel;
  state: MyAppState;
  status: AppInstanceStatus | null;
  projectId: string | null;
  bootstrapError: string | null;
  tableCount: number;
  scheduleCount: number;
  installedAt: string | null;
}
```

## Acceptance Criteria

- [ ] "My Apps" tab visible in marketplace alongside Apps, Blueprints, Profiles, Templates
- [ ] Tab shows count badge: "My Apps (N)" when N > 0
- [ ] All SAP directories under `~/.stagent/apps/` with valid manifests appear as cards
- [ ] Cards show correct state badge: Installed (green), Archived (muted), Failed (red)
- [ ] Installed apps: "Open" navigates to `/apps/{appId}`, "Uninstall" opens confirmation dialog
- [ ] Uninstalling a user-built app preserves the SAP directory (archives it)
- [ ] Archived apps: "Re-install" creates new project + bootstraps from SAP bundle
- [ ] Re-installed apps have `sourceType: "file"` in `app_instances` row
- [ ] "Delete" opens permanent deletion dialog, removes SAP dir from disk on confirm
- [ ] Delete of installed app offers "Also delete project" checkbox
- [ ] Failed apps: "Retry" re-bootstraps, "Delete" permanently removes
- [ ] Corrupt SAP dirs (missing/invalid manifest.yaml) show with "Corrupt" badge + Delete-only action
- [ ] User-built apps (`trustLevel: "private"`) excluded from main "Apps" tab to prevent duplication
- [ ] Empty state shown when no SAP directories exist: "No custom apps yet" + link to projects
- [ ] Search filter works across app name and description
- [ ] State filter bar: All / Installed / Archived / Failed

## Scope Boundaries

**Included:**
- My Apps tab UI with card states and actions
- Re-install from archived SAP
- Permanent delete of SAP directory
- Delete confirmation dialog
- Registry source tracking and deregistration
- Filtering private apps from main Apps tab
- Corrupt SAP directory handling

**Excluded (NOT in scope):**
- Editing/updating an existing SAP bundle after export
- Version management, diffing, or rollback between SAP versions
- Import from external SAP files (drag-and-drop, file picker)
- Bulk operations (delete all archived, re-install all)
- SAP directory backup/archival to external storage
- App sharing between instances or users
- Marketplace publishing flow (separate feature)

## Error & Rescue Registry

| # | Error | Trigger | Impact | Rescue |
|---|-------|---------|--------|--------|
| E1 | Corrupt SAP manifest | `manifest.yaml` missing or invalid YAML | App won't load into registry | Track in `failedSapLoads` map; show card with "Corrupt" badge + Delete action |
| E2 | Re-install bootstrap failure | Table creation or schedule provisioning fails | App stuck in "failed" state | Existing rollback in `installApp()` cleans up. Card shows "Failed" with Retry |
| E3 | SAP directory delete fails | Permission denied, locked file | SAP dir persists unexpectedly | Return 500, do NOT deregister from cache. Toast: "Could not delete: {error}" |
| E4 | Delete called on missing SAP dir | Dir already removed externally | No-op | Treat as success (idempotent). Deregister from cache if present |
| E5 | Bundle not in cache for reinstall | Registry not loaded, or SAP dir deleted between page load and click | Re-install fails with 404 | Attempt reload via `sapToBundle()` on the dir. If dir gone, return 404 |
| E6 | Race: concurrent reinstall | Two requests hit `installApp()` simultaneously | UNIQUE constraint on `appId` | Existing race handling returns the winner's instance |
| E7 | `listMyApps()` scan fails | Data directory missing or permission denied | Empty list returned | Log error, return `[]`. Toast: "Could not scan apps directory" |
| E8 | Source project deleted before reinstall | User deleted the original project, then reinstalls | N/A — reinstall creates NEW project | Expected behavior. Documented in UI tooltip |

## What Already Exists

- **`loadSapBundles()`** in `src/lib/apps/registry.ts:68-104` — scans `~/.stagent/apps/`, registers SAP bundles. All SAP dirs are already in memory at runtime
- **`installApp()`** in `src/lib/apps/service.ts:221-294` — full install+bootstrap with rollback and race handling. Accepts `providedBundle` param
- **`uninstallApp()`** in `src/lib/apps/service.ts` — full resource cleanup (triggers, views, tables, schedules) + optional project cascade delete. Already preserves SAP dir
- **`UninstallConfirmationDialog`** in `src/components/apps/uninstall-confirmation-dialog.tsx` — reusable for My Apps uninstall
- **`AppUninstallButton`** in `src/components/apps/app-uninstall-button.tsx` — reusable wrapper
- **`MarketplaceBrowser`** in `src/components/marketplace/marketplace-browser.tsx` — tabbed interface to add My Apps tab to
- **`AppCard`** in `src/components/apps/app-marketplace-browser.tsx:80-184` — card layout pattern to follow
- **`EmptyState`** in `src/components/shared/empty-state.tsx` — reusable empty state with action slot
- **`bundleToCatalogEntry()`** in `src/lib/apps/service.ts:142-167` — reference for building `MyAppEntry`
- **`sapToBundle()`** in `src/lib/apps/sap-converter.ts` — can reload a single SAP dir if needed

## References

- Depends on: `app-runtime-bundle-foundation` (completed), `app-uninstall` (just implemented)
- Related: `marketplace-app-listing` (planned — covers cloud marketplace, this covers local)
- Architecture: registry source tracking pattern is new — consider TDR if reused elsewhere
