# Remove App Catalog System

## Context

The App Catalog feature (built-in runtime app bundles with install/bootstrap lifecycle) is being removed to reimagine later. The **Blueprint Marketplace** (Supabase-backed workflow templates) is being **kept**. The two systems are architecturally separate — the App Catalog has no imports into or from the Blueprint Marketplace code.

The uncommitted changes in `marketplace-browser.tsx` and `marketplace/page.tsx` already remove the Apps tab from the marketplace UI, aligning with this removal.

**Blast radius:** Medium — 2 layers (data + frontend), ~25 files, but all changes are deletions or import removals with zero behavioral side effects on remaining features.

---

## Phase 1: Surgical Edits (sever all imports before deleting source)

All edits in this phase are independent and can be done in parallel.

### 1a. `src/lib/db/schema.ts`
- Remove `appInstances` table definition (lines 809-842, including `AppInstanceRow` type)
- Remove `AppInstanceDbRow` type export (line 1195)

### 1b. `src/lib/db/bootstrap.ts`
- Remove `"app_instances"` from STAGENT_TABLES array (line 34)
- Remove CREATE TABLE + 3 CREATE INDEX statements (lines 293-313)

### 1c. `src/lib/data/clear.ts`
- Remove `appInstances` from import (line 31)
- Remove `const appInstancesDeleted = db.delete(appInstances).run().changes;` (line 79)
- Remove `appInstances: appInstancesDeleted,` from return object (line 192)

### 1d. `src/lib/data/delete-project.ts`
- Remove `appInstances` from import (line 36)
- Remove comment + delete call (lines 132-134)

### 1e. `src/components/shared/app-sidebar.tsx` (most complex — 5 regions)
- Remove imports from `@/lib/apps/` (lines 50-51)
- Remove `InstalledAppGroup` component (lines 203-240)
- Remove `appGroups` state (line 244)
- Remove `useEffect` fetch to `/api/apps/sidebar` (lines 263-282)
- Remove separator + `appGroups.map` rendering (lines 313-316)

### 1f. `src/app/settings/page.tsx`
- Remove `Link` import (line 1) — only used for apps link
- Remove `Button` import (line 20) — only used for apps link
- Remove `actions` prop from PageShell (lines 29-33)

### 1g. `src/app/api/projects/__tests__/delete-project.test.ts`
- Remove `"appInstances"` from TABLES_WITH_PROJECT_FK array (line 26)
- Remove `{ child: "appInstances", parent: "projects" }` order pair (line 113)

---

## Phase 2: Bulk Deletion

Delete entire directories/files (order doesn't matter):

```
rm -rf src/lib/apps/                    # types, service, registry, builtins, icons, validation, tests
rm -rf src/components/apps/             # marketplace-browser, action-buttons, installed-apps-manager
rm -rf src/app/apps/                    # [appId]/[[...slug]]/page.tsx
rm -rf src/app/api/apps/               # 9 API routes (catalog, install, instances, sidebar, [appId]/*)
rm -rf src/app/settings/apps/          # installed apps settings page
rm    src/lib/db/migrations/0009_add_app_instances.sql
```

---

## Phase 3: Drop Table Migration

Create `src/lib/db/migrations/0025_drop_app_instances.sql`:

```sql
-- Remove the deprecated app_instances table.
-- IF EXISTS guards against fresh databases that never had this table.
DROP TABLE IF EXISTS app_instances;
```

---

## Phase 4: Verification

1. **Build**: `npx next build` — zero errors
2. **Tests**: `npm test` — all pass (clear.test.ts auto-adjusts via dynamic schema reflection)
3. **Grep sweep**: confirm zero references to `lib/apps`, `api/apps`, `appInstances`, `app_instances` in src/
4. **Runtime**: `npm run dev` — sidebar loads clean, settings page has no "Installed Apps" button, `/marketplace` still works with blueprints

---

## Files Touched (complete list)

| Action | File |
|--------|------|
| Edit | `src/lib/db/schema.ts` |
| Edit | `src/lib/db/bootstrap.ts` |
| Edit | `src/lib/data/clear.ts` |
| Edit | `src/lib/data/delete-project.ts` |
| Edit | `src/components/shared/app-sidebar.tsx` |
| Edit | `src/app/settings/page.tsx` |
| Edit | `src/app/api/projects/__tests__/delete-project.test.ts` |
| Keep | `src/components/marketplace/marketplace-browser.tsx` (uncommitted changes already correct) |
| Keep | `src/app/marketplace/page.tsx` (uncommitted changes already correct) |
| Delete | `src/lib/apps/` (entire directory) |
| Delete | `src/components/apps/` (entire directory) |
| Delete | `src/app/apps/` (entire directory) |
| Delete | `src/app/api/apps/` (entire directory) |
| Delete | `src/app/settings/apps/` (entire directory) |
| Delete | `src/lib/db/migrations/0009_add_app_instances.sql` |
| Create | `src/lib/db/migrations/0025_drop_app_instances.sql` |

## What Is NOT Touched

- Blueprint Marketplace: `src/lib/marketplace/`, `src/app/api/marketplace/`, `src/components/marketplace/`
- Feature specs in `features/` — historical documentation, not code dependencies
- TDR files — informational references only
- `AGENTS.md`, `MEMORY.md` — can be updated in a follow-up
