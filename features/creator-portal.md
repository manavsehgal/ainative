---
title: Creator Portal
status: planned
priority: P2
milestone: post-mvp
source: brainstorm session 2026-04-11
dependencies: [marketplace-app-publishing, telemetry-foundation]
---

# Creator Portal

## Description

App creators need a dedicated space to manage their published listings, track
installs and usage, and eventually monitor revenue. The creator portal is a
single page at `/marketplace/creator` with tab navigation covering four
sections: My Apps, Analytics, Revenue, and Settings.

The portal is gated to Operator+ tier — the same tier required for publishing.
It pulls data from the Supabase `app_packages` table and optionally from an
anonymized telemetry pipeline that provides aggregated usage signals without
exposing individual user data.

## User Story

As an app creator, I want a dashboard showing my published apps, install counts,
active usage metrics, and revenue, so I can understand how my apps are
performing and make data-driven improvements.

## Technical Approach

### 1. Page Structure

Single page at `/marketplace/creator` with four tabs:

**My Apps tab (default):**
- List of creator's published apps
- Each row: app name, version, status (published/draft/unpublished), trust level
  badge, install count, last updated date
- Actions per app: Edit Listing, View in Marketplace, Unpublish, New Version
- Empty state: "You haven't published any apps yet. Package your first app
  and share it with the community."

**Analytics tab:**
- Summary cards at top:
  - Total installs (all apps)
  - Active installs (apps currently enabled)
  - Total schedule runs (across all installed instances)
  - Average rating
- Per-app breakdown table:
  - App name, install count, active installs, schedule run rate (runs/day),
    average rating, remix count
- Time range selector: 7d | 30d | 90d | All time
- Simple bar chart for install trend (daily installs over selected period)

**Revenue tab:**
- Placeholder for V1: "Revenue tracking coming soon. Your paid apps will
  show earnings here once Stripe Connect integration is live."
- Future: earnings per app, payout history, Stripe Connect onboarding

**Settings tab:**
- Creator profile: display name, bio, website URL, avatar
- Notification preferences: email on new install, email on new review,
  email on contribution submission
- API key management for CI/CD publishing

### 2. API Route

`GET /api/marketplace/creator-stats`

Response:

```ts
interface CreatorStats {
  apps: {
    appId: string;
    title: string;
    version: string;
    status: 'published' | 'draft' | 'unpublished';
    trustLevel: TrustLevel;
    installCount: number;
    activeInstalls: number;
    scheduleRunRate: number; // runs per day
    averageRating: number | null;
    remixCount: number;
    lastUpdated: string;
  }[];
  totals: {
    totalInstalls: number;
    activeInstalls: number;
    totalScheduleRuns: number;
    averageRating: number | null;
  };
  installTrend: {
    date: string; // YYYY-MM-DD
    count: number;
  }[];
}
```

Data sources:
- `app_packages` table — app metadata, install counts
- `app_install_events` table (new) — timestamped install/uninstall events
  for trend calculation
- `app_telemetry` table (from `telemetry-foundation`) — schedule run counts
- `app_reviews` table (from `marketplace-reviews`) — ratings

The route filters by the authenticated user's creator ID.

### 3. Opt-In Anonymized Telemetry

Creators can receive aggregated, anonymized usage insights about their apps:

- "80% of users have your daily schedule paused — consider changing the
  default to weekly"
- "Users who keep the app installed longest also use the watchlist table
  most frequently"
- "3 users uninstalled within 24 hours — the most common last action was
  viewing the setup page"

Implementation:
- Telemetry events are aggregated server-side into anonymized summaries
- No individual user data is exposed to creators
- Users opt-in to telemetry sharing at install time
- Aggregation requires minimum 10 installs to prevent de-anonymization

This depends on `telemetry-foundation` which provides the event pipeline.
V1 may launch with install count + rating only, adding telemetry insights
as the pipeline matures.

### 4. Listing Management

From the "My Apps" tab, creators can:

**Edit Listing:**
- Opens the publish sheet (from `marketplace-app-publishing`) pre-filled
  with current metadata
- Can update: title, description, category, tags, screenshots, pricing, README
- Cannot change: app ID, manifest structure (requires new version)

**New Version:**
- Upload a new `.sap` archive
- Version number must be semver-greater than current
- Previous version kept in storage for rollback
- Existing installs see "Update available" indicator

**Unpublish:**
- Removes from marketplace listing
- Existing installs continue to work
- Can re-publish later

**Version History:**
- List of all published versions with dates
- Download link for each version's `.sap`

### 5. Tier Gate

The creator portal page checks tier on load:

```tsx
const tier = await getUserTier();
if (tier !== 'operator' && tier !== 'scale') {
  return <UpgradeGateDialog
    feature="Creator Portal"
    requiredTier="operator"
  />;
}
```

Uses the same gate dialog pattern as `marketplace-access-gate`.

## Acceptance Criteria

- [ ] `/marketplace/creator` page renders with four tabs: Apps, Analytics,
      Revenue, Settings.
- [ ] My Apps tab lists all apps published by the current user with status,
      trust level, and install count.
- [ ] Edit Listing action opens pre-filled publish sheet.
- [ ] Analytics tab shows summary cards and per-app breakdown table.
- [ ] Time range selector filters analytics data (7d/30d/90d/all).
- [ ] Revenue tab shows placeholder message for V1.
- [ ] Settings tab allows editing creator profile and notification preferences.
- [ ] `GET /api/marketplace/creator-stats` returns aggregated data for the
      authenticated creator.
- [ ] Non-Operator users see upgrade gate dialog.
- [ ] Empty state shown when creator has no published apps.
- [ ] Page is responsive and follows Calm Ops design system.

## Scope Boundaries

**Included:**
- Creator dashboard page with four tabs
- API route for creator statistics
- Listing management (edit, unpublish, version history)
- Tier gate (Operator+)
- Creator profile settings

**Excluded:**
- Stripe Connect integration (Revenue tab is placeholder in V1)
- Telemetry insights beyond install count and ratings (depends on
  `telemetry-foundation` maturity)
- Automated app promotion / featured placement
- Creator verification flow (see `marketplace-trust-ladder`)
- Contribution review UI (future enhancement for `app-forking-remix`)

## References

- Source: brainstorm session 2026-04-11, plan §6b
- Related: `marketplace-app-publishing` (publish sheet reuse),
  `marketplace-reviews` (rating data), `telemetry-foundation` (usage metrics),
  `marketplace-trust-ladder` (verification requests)
- Files to create:
  - `src/app/marketplace/creator/page.tsx`
  - `src/components/marketplace/creator-dashboard.tsx`
  - `src/components/marketplace/creator-apps-list.tsx`
  - `src/components/marketplace/creator-analytics.tsx`
  - `src/app/api/marketplace/creator-stats/route.ts`
- Files to modify:
  - `src/components/shared/app-sidebar.tsx` — add Creator Portal link
    under Manage group (visible for Operator+)
