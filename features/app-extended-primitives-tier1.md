---
title: App Extended Primitives — Tier 1
status: completed
priority: P1
milestone: post-mvp
source: brainstorm session 2026-04-11
dependencies: [marketplace-install-hardening]
---

# App Extended Primitives — Tier 1

## Description

The current `AppBundle` type supports 7 primitives: `manifest`, `setupChecklist`,
`profiles`, `blueprints`, `tables`, `schedules`, and `ui`. This covers the
structural skeleton of an app but leaves out five capabilities that already
have mature platform code — triggers, documents, notifications, saved views,
and environment variables. Apps that need these today must rely on post-install
manual setup, which defeats the one-click promise of the marketplace.

This feature extends `AppBundle` from 7 to 12 primitives by wiring 5 new
template types into the existing install/bootstrap pipeline. Each primitive
follows the same pattern: a TypeScript interface, a Zod validation schema,
a bootstrap handler in `service.ts`, and at least one example in the
built-in apps (`wealth-manager` and `growth-module`).

All five primitives target platform subsystems that already work — the effort
is purely in the bundle schema, validation, and bootstrap glue, not in
building new platform features from scratch.

## User Story

As an app creator, I want to declare triggers, documents, notifications,
saved views, and required environment variables in my app manifest so that
installing my app provisions all of these automatically — no manual
configuration steps needed after install.

## Technical Approach

### 1. New TypeScript interfaces (`src/lib/apps/types.ts`)

Add five new interfaces and extend `AppBundle`:

```ts
export interface AppTriggerTemplate {
  key: string;
  name: string;
  description?: string;
  tableKey: string;                         // references AppTableTemplate.key
  event: "row_added" | "row_updated" | "row_deleted";
  action: "notify" | "schedule_run" | "webhook";
  actionConfig: Record<string, unknown>;    // payload varies by action type
}

export interface AppDocumentTemplate {
  key: string;
  name: string;
  description?: string;
  globPatterns?: string[];                  // e.g., ["*.pdf", "reports/*.csv"]
  maxSizeMb?: number;
  seedFiles?: { filename: string; content: string }[];
}

export interface AppNotificationTemplate {
  key: string;
  title: string;
  body: string;
  type: "info" | "warning" | "success" | "error";
  lifecycle?: "transient" | "persistent" | "actionable";
  triggerKey?: string;                      // optional link to AppTriggerTemplate
}

export interface AppSavedViewTemplate {
  key: string;
  name: string;
  description?: string;
  tableKey: string;                         // references AppTableTemplate.key
  filters: Record<string, unknown>;         // column-level filter predicates
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  visibleColumns?: string[];
}

export interface AppEnvVarDeclaration {
  key: string;
  name: string;
  description: string;
  required: boolean;
  sensitive: boolean;                       // mask in UI, store encrypted
  defaultValue?: string;
  validationPattern?: string;               // regex for input validation
}
```

Extend the `AppBundle` interface:

```ts
export interface AppBundle {
  manifest: AppBundleManifest;
  setupChecklist: string[];
  profiles: AppProfileLink[];
  blueprints: AppBlueprintLink[];
  tables: AppTableTemplate[];
  schedules: AppScheduleTemplate[];
  ui: AppUiSchema;
  // --- Tier 1 additions ---
  triggers?: AppTriggerTemplate[];
  documents?: AppDocumentTemplate[];
  notifications?: AppNotificationTemplate[];
  savedViews?: AppSavedViewTemplate[];
  envVars?: AppEnvVarDeclaration[];
}
```

All new fields are optional to preserve backward compatibility with existing
bundles.

### 2. New permission types (`src/lib/apps/types.ts`)

Extend `APP_PERMISSIONS`:

```ts
export const APP_PERMISSIONS = [
  "projects:create",
  "tables:create",
  "tables:seed",
  "schedules:create",
  "profiles:link",
  "blueprints:link",
  // --- Tier 1 additions ---
  "triggers:create",
  "documents:create",
  "notifications:create",
  "views:create",
  "env:declare",
] as const;
```

### 3. Zod validation schemas (`src/lib/apps/validation.ts`)

Add five new schemas mirroring the interfaces:

```ts
const triggerTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  tableKey: z.string().regex(/^[a-z0-9-]+$/),
  event: z.enum(["row_added", "row_updated", "row_deleted"]),
  action: z.enum(["notify", "schedule_run", "webhook"]),
  actionConfig: z.record(z.unknown()),
});

const documentTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  globPatterns: z.array(z.string().max(128)).max(10).optional(),
  maxSizeMb: z.number().int().min(1).max(500).optional(),
  seedFiles: z.array(z.object({
    filename: z.string().min(1).max(255),
    content: z.string().max(50000),
  })).max(20).optional(),
});

const notificationTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  type: z.enum(["info", "warning", "success", "error"]),
  lifecycle: z.enum(["transient", "persistent", "actionable"]).optional(),
  triggerKey: z.string().regex(/^[a-z0-9-]+$/).optional(),
});

const savedViewTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  tableKey: z.string().regex(/^[a-z0-9-]+$/),
  filters: z.record(z.unknown()),
  sortColumn: z.string().max(64).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  visibleColumns: z.array(z.string().max(64)).max(30).optional(),
});

const envVarDeclarationSchema = z.object({
  key: z.string().regex(/^[A-Z0-9_]+$/),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  required: z.boolean(),
  sensitive: z.boolean(),
  defaultValue: z.string().max(1000).optional(),
  validationPattern: z.string().max(200).optional(),
});
```

Add all five to `appBundleSchema` as optional arrays.

### 4. Bootstrap handlers (`src/lib/apps/service.ts`)

Add five new handler functions called from `bootstrapApp()`, after the
existing table/schedule provisioning:

- **`bootstrapTriggers(appId, triggers, resourceMap)`** — For each trigger
  template, resolve `tableKey` to a real table ID via `resourceMap.tables`,
  then register the trigger using the platform trigger API (analogous to
  the pattern in `src/lib/tables/triggers/`). Store created trigger IDs in
  `resourceMap.triggers`.

- **`bootstrapDocuments(appId, documents, projectId)`** — For each document
  template, create a document pool entry via `src/lib/data/documents.ts`.
  If `seedFiles` are present, write them to `~/.stagent/uploads/{appId}/`.
  Store created document IDs in `resourceMap.documents`.

- **`bootstrapNotifications(appId, notifications)`** — Register notification
  templates via `src/lib/data/notifications.ts`. Templates with a
  `triggerKey` are linked to the corresponding trigger ID from
  `resourceMap.triggers`.

- **`bootstrapSavedViews(appId, views, resourceMap)`** — For each saved view,
  resolve `tableKey` and create a saved view record in the platform's saved
  views system.

- **`bootstrapEnvVars(appId, envVars)`** — For each required env var, check
  if the value exists in `src/lib/data/settings.ts`. If missing and
  `required: true`, mark the app as needing setup (status remains
  `bootstrapping` until all required vars are provided). Store declarations
  in `resourceMap.envVars` for the install wizard to prompt.

Extend `AppResourceMap`:

```ts
export interface AppResourceMap {
  tables: Record<string, string>;
  schedules: Record<string, string>;
  triggers?: Record<string, string>;
  documents?: Record<string, string>;
  notifications?: Record<string, string>;
  savedViews?: Record<string, string>;
  envVars?: Record<string, string>;
}
```

### 5. Built-in app examples (`src/lib/apps/builtins.ts`)

Add examples to the `wealth-manager` bundle:

- A trigger on `positions` table: notify on `row_updated` (price change alert)
- A document template for portfolio reports (PDF glob pattern)
- A notification template for daily review reminders
- A saved view for "High Conviction Positions" (filtered by conviction column)
- An env var declaration for `MARKET_DATA_API_KEY` (optional, sensitive)

Add examples to the `growth-module` bundle:

- A trigger on `experiments` table: notify on `row_added`
- A document template for experiment reports
- A notification for experiment completion
- A saved view for "Active Experiments"

### 6. Validation cross-references

Add cross-reference validation in `validation.ts`:

- `triggerTemplate.tableKey` must reference a declared `tables[].key`
- `savedViewTemplate.tableKey` must reference a declared `tables[].key`
- `notificationTemplate.triggerKey` (if set) must reference a declared
  `triggers[].key`
- `savedViewTemplate.visibleColumns` (if set) must be a subset of the
  referenced table's column names

## Acceptance Criteria

- [ ] Five new interfaces added to `src/lib/apps/types.ts` with JSDoc.
- [ ] Five new Zod schemas added to `src/lib/apps/validation.ts`.
- [ ] `AppBundle` extended with 5 optional fields; existing bundles still
      validate without changes.
- [ ] `APP_PERMISSIONS` extended with 5 new permission strings.
- [ ] `AppResourceMap` extended to track IDs for all 5 new resource types.
- [ ] `bootstrapApp()` calls 5 new handlers after table/schedule provisioning.
- [ ] Each handler is idempotent — re-running bootstrap does not create
      duplicate resources.
- [ ] `wealth-manager` and `growth-module` builtins include examples of all
      5 new primitives.
- [ ] Cross-reference validation catches invalid `tableKey`, `triggerKey`,
      and column references at install time.
- [ ] `npm test` passes; `npx tsc --noEmit` clean.
- [ ] Unit tests cover each new bootstrap handler with fixture data.

## Scope Boundaries

**Included:**
- TypeScript interfaces for 5 new primitives
- Zod validation schemas with cross-reference checks
- Bootstrap handlers wiring to existing platform code
- AppResourceMap extensions for new resource tracking
- Permission type extensions
- Built-in app examples for wealth-manager and growth-module

**Excluded:**
- New platform subsystems (triggers, documents, etc. already exist)
- UI for managing app-provisioned triggers/views/notifications (use existing
  platform UIs)
- Tier 2 primitives (channels, memory, chatTools, workflows — separate spec)
- Trust-level enforcement per primitive (covered by `marketplace-trust-ladder`)
- Migration of existing apps — only new installs use the new primitives

## References

- Source: brainstorm session 2026-04-11, plan `flickering-petting-hammock.md`
  section 3a
- Related: `marketplace-install-hardening`, `app-extended-primitives-tier2`
- Files to modify:
  - `src/lib/apps/types.ts` — 5 new interfaces, extend AppBundle,
    extend AppResourceMap, extend APP_PERMISSIONS
  - `src/lib/apps/validation.ts` — 5 new Zod schemas, cross-reference checks
  - `src/lib/apps/service.ts` — 5 new bootstrap handlers
  - `src/lib/apps/builtins.ts` — examples in wealth-manager and growth-module
- Platform code already in place:
  - `src/lib/tables/triggers/` — row-level trigger system
  - `src/lib/documents/` — document processing pipeline
  - `src/lib/data/notifications.ts` — notification data layer
  - `src/lib/data/settings.ts` — settings/env var storage
- Files to create:
  - `src/lib/apps/__tests__/tier1-primitives.test.ts` — unit tests for all
    5 bootstrap handlers
