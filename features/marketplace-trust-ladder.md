---
title: Marketplace Trust Ladder
status: completed
priority: P1
milestone: post-mvp
source: brainstorm session 2026-04-11
dependencies: [marketplace-app-publishing, app-extended-primitives-tier1]
---

# Marketplace Trust Ladder

## Description

Not all apps should have the same capabilities. A community-submitted app that
creates a few tables is fundamentally different from an official app that wires
MCP servers and seeds agent memory. The trust ladder establishes a progressive
trust model where an app's trust level determines which primitives it can use
during installation.

Trust levels: **private** → **community** (unverified) → **verified** → **official**.

Each trust level maps to an execution tier that gates which primitive handlers
`bootstrapApp()` is allowed to invoke. This prevents untrusted apps from
performing high-risk operations (MCP wiring, memory seeding, budget policies)
while still allowing the community to build and share useful declarative apps.

## User Story

As a Stagent user, I want to see a clear trust badge on every marketplace app
and understand what permissions it requires before installing, so I can make
informed decisions about which apps to trust with my data and workflows.

As a platform maintainer, I want trust levels to enforce execution boundaries
automatically, so a community app cannot wire an MCP server or seed agent
memory even if its manifest declares those primitives.

## Technical Approach

### 1. Trust Level Definitions

| Trust Level | Badge | Who | How to Reach |
|-------------|-------|-----|-------------|
| `private` | Gray shield | Any user | Default for locally-created apps |
| `community` | Blue shield | Operator+ | Published to marketplace (automatic) |
| `verified` | Green shield + checkmark | Platform-reviewed creators | Apply → review → approved |
| `official` | Gold shield + star | Stagent team | Internal only |

### 2. Execution Tier Mapping

**Tier A — Declarative Only** (private + community):
- `tables` — create SQLite tables from schema definitions
- `schedules` — register scheduled prompts
- `profiles` — install agent profiles
- `blueprints` — add workflow blueprints
- `widgets` — register dashboard widgets
- `views` — create saved table views
- `notifications` — register notification templates
- `envVars` — declare required environment variables
- `savedViews` — pre-configured filtered views

**Tier B — Integration** (verified, includes all of Tier A):
- `mcpServers` — wire MCP server connections
- `chatTools` — register chat tool definitions
- `channels` — declare communication channel needs
- `memory` — seed behavioral priors in agent memory

**Full Access** (official, includes all of Tier A + B):
- `budgetPolicies` — set per-schedule token/dollar caps
- Any future primitives default to Full until explicitly tiered

### 3. Permission Enforcement in bootstrapApp()

Before executing each primitive handler in `bootstrapApp()`, check the app's
trust level against the tier mapping:

```ts
// src/lib/apps/trust.ts — new module
const TIER_A_PRIMITIVES = new Set([
  'tables', 'schedules', 'profiles', 'blueprints', 'widgets',
  'views', 'notifications', 'envVars', 'savedViews'
]);

const TIER_B_PRIMITIVES = new Set([
  'mcpServers', 'chatTools', 'channels', 'memory'
]);

const FULL_PRIMITIVES = new Set([
  'budgetPolicies'
]);

function canExecutePrimitive(
  trustLevel: TrustLevel,
  primitive: string
): boolean {
  if (TIER_A_PRIMITIVES.has(primitive)) return true; // all levels
  if (TIER_B_PRIMITIVES.has(primitive)) {
    return trustLevel === 'verified' || trustLevel === 'official';
  }
  if (FULL_PRIMITIVES.has(primitive)) {
    return trustLevel === 'official';
  }
  return false; // unknown primitives blocked by default
}
```

In `bootstrapApp()`, wrap each handler:

```ts
for (const [primitive, handler] of primitiveHandlers) {
  if (!canExecutePrimitive(app.trustLevel, primitive)) {
    console.warn(
      `[apps] Skipping ${primitive} for ${app.id}: ` +
      `requires higher trust level (current: ${app.trustLevel})`
    );
    skippedPrimitives.push(primitive);
    continue;
  }
  await handler(app, manifest);
}
```

Skipped primitives are reported back to the user in the install result so they
understand what was not provisioned and why.

### 4. UI — Trust Badge Component

A reusable `TrustBadge` component displayed on:
- Marketplace app cards
- App detail page hero
- Installed apps manager
- Install confirmation dialog

```tsx
// src/components/marketplace/trust-badge.tsx
function TrustBadge({ level }: { level: TrustLevel }) {
  const config = {
    private:   { icon: Shield, color: 'text-muted-foreground', label: 'Private' },
    community: { icon: Shield, color: 'text-blue-600', label: 'Community' },
    verified:  { icon: ShieldCheck, color: 'text-green-600', label: 'Verified' },
    official:  { icon: ShieldStar, color: 'text-amber-500', label: 'Official' },
  }[level];
  // render icon + label with appropriate color
}
```

### 5. Install Dialog — Permission Summary

The install confirmation dialog (from `marketplace-app-listing`) groups
requested primitives by tier:

```
This app will create:
  ✓ 3 tables (positions, transactions, watchlist)
  ✓ 1 schedule (daily-portfolio-review)
  ✓ 1 profile (wealth-advisor)

Requires Verified trust:
  ⚠ 1 MCP server (finance-data-mcp) — SKIPPED (app is Community)
```

Primitives that exceed the app's trust level are shown with a warning icon
and "SKIPPED" label. The user can still install — they just won't get the
higher-tier primitives.

### 6. Verification Request Flow

Creators can apply for `verified` status from the creator portal:

1. **Apply** — creator fills a short form: app description, why verification
   is needed, links to source code / documentation
2. **Queue** — request stored in Supabase `verification_requests` table with
   status `pending`
3. **Review** — platform admin reviews via an admin page (or directly in
   Supabase dashboard for V1)
4. **Decision** — approved (trust level updated to `verified`) or rejected
   (with reason text sent back to creator)

V1 scope: the admin review happens in Supabase directly. A dedicated admin
UI is a future enhancement.

### 7. Supabase Schema

Add `trust_level` column to `app_packages` table:

```sql
ALTER TABLE app_packages
  ADD COLUMN trust_level TEXT NOT NULL DEFAULT 'community'
  CHECK (trust_level IN ('private', 'community', 'verified', 'official'));
```

New `verification_requests` table:

```sql
CREATE TABLE verification_requests (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES app_packages(app_id),
  creator_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
```

## Acceptance Criteria

- [ ] `canExecutePrimitive()` correctly gates primitives by trust level.
- [ ] `bootstrapApp()` skips primitives that exceed the app's trust level
      and reports skipped items in the install result.
- [ ] Trust badge renders on marketplace cards with correct color/icon per level.
- [ ] Install confirmation dialog groups primitives by tier and marks
      skipped items.
- [ ] Published apps default to `community` trust level.
- [ ] Locally-created apps default to `private` trust level.
- [ ] Verification request can be submitted from creator portal.
- [ ] `trust_level` column exists on `app_packages` with CHECK constraint.
- [ ] Unknown primitives are blocked by default (safe-by-default).
- [ ] Unit tests cover all trust level × primitive combinations.

## Scope Boundaries

**Included:**
- Trust level definitions and tier mapping
- Permission enforcement in `bootstrapApp()`
- Trust badge UI component
- Install dialog permission summary
- Verification request flow (creator submit, admin review in Supabase)
- Supabase schema changes

**Excluded:**
- Admin UI for verification review (V1 uses Supabase dashboard)
- Trust level revocation / demotion flow
- Automated trust scoring based on usage metrics
- MCP server sandboxing (separate security concern)
- Budget policy enforcement runtime (see `app-budget-policies`)

## References

- Source: brainstorm session 2026-04-11, plan §5d
- Related: `marketplace-app-publishing` (sets initial trust level),
  `app-extended-primitives-tier1` (Tier A primitives),
  `app-mcp-server-wiring` (Tier B primitive)
- Files to modify:
  - `src/lib/apps/service.ts` — add trust check in `bootstrapApp()`
  - `src/lib/apps/types.ts` — add `TrustLevel` type
- Files to create:
  - `src/lib/apps/trust.ts` — trust level logic and tier mapping
  - `src/components/marketplace/trust-badge.tsx`
