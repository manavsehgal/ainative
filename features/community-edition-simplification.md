---
title: Community Edition Simplification
status: completed
priority: P0
milestone: mvp
source: conversation
dependencies: []
---

# Community Edition Simplification

## Description

Remove all subscription tiering, licensing, Stripe billing, and feature gating from the stagent app. The product becomes a single free "Community Edition" where every feature is unlocked with no artificial limits. This eliminates the license manager singleton, tier checks in API routes, billing UI, gate overlays, limit enforcement, Stripe integration, and cloud license validation.

The simplification makes the codebase lighter, the UX cleaner, and removes a monetization layer that adds complexity without serving the current product goals. Subscription can be reimagined later if needed.

## User Story

As a stagent user, I want all features to be available without subscription gates or resource limits so that I can use the full product without friction.

## Technical Approach

### Phase 1: Delete billing and license libraries
- Delete `src/lib/billing/` (products.ts, stripe.ts, email.ts)
- Delete `src/lib/license/` (manager.ts, tier-limits.ts, features.ts, limit-check.ts, limit-queries.ts, notifications.ts, cloud-validation.ts, key-format.ts)
- Delete `src/lib/validators/license.ts`

### Phase 2: Delete billing/license API routes
- Delete `src/app/api/license/` (route.ts, checkout/route.ts, portal/route.ts, usage/route.ts)

### Phase 3: Delete gate/billing UI components
- Delete `src/components/settings/subscription-section.tsx`
- Delete `src/components/settings/activation-form.tsx`
- Delete `src/components/shared/upgrade-banner.tsx`
- Delete `src/components/shared/premium-gate-overlay.tsx`
- Delete `src/components/shared/schedule-gate-dialog.tsx`
- Delete `src/components/analytics/analytics-gate-card.tsx`

### Phase 4: Delete Supabase billing edge functions
- Delete `supabase/functions/validate-license/`
- Delete `supabase/functions/create-checkout-session/`
- Delete `supabase/functions/create-portal-session/`
- Delete `supabase/functions/stripe-webhook/`
- Delete `supabase/functions/conversion-ingest/` (billing conversion tracking)

### Phase 5: Surgical edits — remove tier checks from API routes
- `src/app/api/memory/route.ts` — remove checkLimit/buildLimitErrorBody/createTierLimitNotification imports and the limit check block (~lines 81-87)
- `src/app/api/schedules/route.ts` — remove checkLimit/buildLimitErrorBody/createTierLimitNotification imports and the limit check block (~lines 134-140)
- `src/app/api/sync/sessions/route.ts` — remove licenseManager import and cloud-sync feature check (lines 10-14)
- `src/app/api/sync/export/route.ts` — remove licenseManager import and cloud-sync feature check (lines 14-19)
- `src/app/api/sync/restore/route.ts` — remove licenseManager import and cloud-sync feature check (lines 11-15)
- `src/app/api/tasks/[id]/execute/route.ts` — remove licenseManager import and parallel limit check (lines 99-115)

### Phase 6: Surgical edits — remove tier logic from core modules
- `src/lib/agents/execution-manager.ts` — remove licenseManager/createTierLimitNotification imports and ParallelLimitError class + limit check in setExecution()
- `src/lib/agents/learned-context.ts` — remove checkLimit/getContextVersionCount/createTierLimitNotification imports and limit check
- `src/app/auth/callback/route.ts` — remove licenseManager/validateLicenseWithCloud/sendUpgradeConfirmation imports and license activation logic (keep email capture for cloud sync)
- `src/instrumentation-node.ts` — remove licenseManager initialization (lines 19-22), remove startHistoryCleanup function and call (lines 38-70), or replace with a fixed generous retention (e.g., 365 days)

### Phase 7: Surgical edits — simplify pages and settings
- `src/app/analytics/page.tsx` — remove tier check + AnalyticsGateCard import; always render dashboard
- `src/app/settings/page.tsx` — remove SubscriptionSection import + component

### Phase 8: Database cleanup
- Remove `license` table from `src/lib/db/schema.ts`
- Remove `license` table from `src/lib/db/bootstrap.ts`
- Remove `license` from INTENTIONALLY_PRESERVED in `src/lib/data/__tests__/clear.test.ts` (if applicable)
- Create migration `0026_drop_license.sql` with `DROP TABLE IF EXISTS license`

### Phase 9: Clean up text references
- Remove "billing" / "license" / "subscription" / "tier" / "upgrade" text from UI copy where it refers to the subscription system
- Keep `send-email` edge function (used for non-billing emails too)

## UX Improvements (from /frontend-designer)

1. **Settings page**: Remove SubscriptionSection entirely. The page becomes simpler and focuses on what matters: authentication, cloud sync, agent configuration, and data management.

2. **Analytics page**: Remove the gate overlay. Analytics dashboard renders for all users — feels like a first-class feature, not a premium upsell.

3. **Cloud sync**: Remove the Operator+ gate from sync API routes. All users can sync if they have a cloud account.

4. **Schedule creation**: No limit dialogs. Users can create unlimited schedules.

5. **Memory creation**: No limit warnings or 402 errors. Unlimited agent memories.

6. **Parallel workflows**: No execution caps. Run as many concurrent tasks as the machine supports.

7. **History retention**: Use a generous fixed retention (365 days or unlimited) instead of tier-based retention.

## Acceptance Criteria

- [ ] No subscription/tier UI visible anywhere in the app
- [ ] No 402 "Payment Required" responses from any API route
- [ ] Analytics page accessible without any gate or overlay
- [ ] Cloud sync works without tier check (still requires cloud account)
- [ ] Schedules, memories, and workflows have no artificial limits
- [ ] History retention uses fixed generous value (not tier-dependent)
- [ ] `license` table removed from schema, bootstrap, and migrations
- [ ] All `src/lib/license/` and `src/lib/billing/` directories deleted
- [ ] All gate components deleted (upgrade-banner, premium-gate-overlay, schedule-gate-dialog, analytics-gate-card)
- [ ] Build passes with zero errors
- [ ] All tests pass
- [ ] Grep sweep shows no remaining `licenseManager`, `checkLimit`, `isFeatureAllowed`, or tier-related imports in src/

## Scope Boundaries

**Included:**
- Removing all client-side tier checks and gate UI
- Removing all server-side limit enforcement and feature gating
- Removing Stripe/billing integration
- Removing license manager and cloud license validation
- Removing the license DB table
- Simplifying the auth callback (keep email capture, remove license activation)
- Simplifying instrumentation (remove license init, fix history retention)

**Excluded:**
- Cloud sync feature itself (KEEP — just remove the tier gate)
- Cloud account / Supabase auth (KEEP — still needed for sync)
- Trust tier badge (NOT subscription-related — it's permission levels)
- Upgrade badge (NOT subscription-related — it's git version upgrades)
- send-email edge function (KEEP — used for non-billing emails)
- telemetry-ingest edge function (KEEP — not billing-related)
- waitlist-signup edge function (KEEP — not billing-related)
- Usage ledger table (KEEP for now — still useful for analytics/monitoring)
- Conversion events / telemetry (can be cleaned up separately)

## References

- Architect impact analysis: `features/architect-report.md`
- TDR-030 (hybrid instance licensing): will be deprecated
- Previous removals: App Catalog (this session), Marketplace (this session)
