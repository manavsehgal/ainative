---
title: Subscription Management UI
status: completed
priority: P1
layer: PLG Core
dependencies:
  - local-license-manager
  - stripe-billing-integration
---

# Subscription Management UI

> **Superseded by `community-edition-simplification` (2026-04-13).** This feature shipped but was later fully reverted when ainative pivoted to a 100% free Community Edition with no tiers, billing, or cloud dependency. Kept as historical record.

## Description

A dedicated `/settings/subscription` page that serves as the single source of truth for a user's tier status, usage against limits, plan comparison, and billing management. The page follows the existing settings architecture (FormSectionCard sections within PageShell) and integrates with both the local license manager for tier detection and Stripe for billing operations.

The page adapts to four key states: Community (shows upgrade CTAs), paid active (shows manage/cancel), checkout in progress (loading state), and post-purchase success (celebratory toast). It is the primary destination for all upgrade flows across the app — every "Upgrade" link and banner points here.

## User Story

As a ainative user, I want a single page where I can see my current plan, understand how much of my limits I've used, compare available tiers, and manage my subscription — so that I can make informed upgrade decisions and manage billing without leaving the app.

## Technical Approach

### New Route: `/settings/subscription`

File: `src/app/settings/subscription/page.tsx`

Server Component that fetches tier status and usage counts server-side:

```ts
export default async function SubscriptionPage() {
  const license = await getLicenseStatus();
  const usage = await getUsageCounts();

  return (
    <PageShell title="Subscription" description="Manage your plan and billing">
      <SubscriptionSection license={license} usage={usage} />
    </PageShell>
  );
}
```

### SubscriptionSection Component

File: `src/components/settings/subscription-section.tsx`

Client Component (needs interactivity for tabs, buttons). Contains four subsections:

#### 1. Current Plan Header

```tsx
<FormSectionCard title="Current Plan" description="Your active subscription">
  <div className="flex items-center gap-3">
    <StatusChip variant={tierVariant}>{license.tier}</StatusChip>
    {license.tier === 'community' && (
      <span className="text-sm text-muted-foreground">Free forever</span>
    )}
    {license.expiresAt && (
      <span className="text-sm text-muted-foreground">
        Renews {formatDate(license.expiresAt)}
      </span>
    )}
  </div>
</FormSectionCard>
```

StatusChip variant mapping: community = `secondary`, operator = `default`, scale = `success`, enterprise = `outline`.

#### 2. Usage Summary Cards

Four cards in a 2x2 grid (`grid grid-cols-2 gap-4`):

| Card | Label | Value | Max |
|------|-------|-------|-----|
| Memories | Agent memories | count per top profile | 50 / 500 / unlimited |
| Versions | Context versions | count per top profile | 10 / 100 / unlimited |
| Schedules | Active schedules | total active | 5 / 50 / unlimited |
| History | Execution history | oldest log age | 30d / 1yr / unlimited |

Each card shows a progress bar (shadcn Progress component). Color transitions: green (< 70%), amber (70-90%), red (> 90%).

```tsx
<div className="surface-card elevation-1 rounded-xl p-4 space-y-2">
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium">{label}</span>
    <span className="text-sm text-muted-foreground">{current}/{max}</span>
  </div>
  <Progress value={percentage} className={progressColor} />
</div>
```

#### 3. Tier Comparison Grid

Full-width comparison grid with monthly/annual toggle:

```tsx
<FormSectionCard title="Plans" description="Compare features across tiers">
  <Tabs defaultValue="monthly">
    <TabsList>
      <TabsTrigger value="monthly">Monthly</TabsTrigger>
      <TabsTrigger value="annual">Annual (save 20%)</TabsTrigger>
    </TabsList>
    <TabsContent value="monthly">
      <TierComparisonGrid period="monthly" currentTier={license.tier} />
    </TabsContent>
    <TabsContent value="annual">
      <TierComparisonGrid period="annual" currentTier={license.tier} />
    </TabsContent>
  </Tabs>
</FormSectionCard>
```

TierComparisonGrid renders 4 tier columns:

| Feature | Community | Solo | Operator | Scale |
|---------|-----------|------|----------|-------|
| Price | Free | $19/mo | $49/mo | $99/mo |
| Agent Memories | 50/profile | Unlimited | Unlimited | Unlimited |
| Context Versions | 10/profile | Unlimited | Unlimited | Unlimited |
| Active Schedules | 5 | Unlimited | Unlimited | Unlimited |
| History Retention | 30 days | 90 days | 90 days | 90 days |
| Parallel Workflows | 3 | 3 | 10 | Unlimited |
| Cloud Sync | — | — | ✓ | ✓ |
| Analytics | — | — | ✓ | ✓ |
| Marketplace: Buy | — | ✓ | ✓ | ✓ |
| Marketplace: Sell | — | — | ✓ (70/30) | ✓ (80/20) |
| Featured Listings | — | — | — | ✓ |

Current tier column gets `ring-2 ring-primary` highlight. Each tier card uses `surface-card elevation-1 rounded-xl`.

#### 4. Action Buttons

Contextual based on tier state and auth state:

- **Community, not signed in**: "Sign in to check for existing subscription" link (Supabase Auth). This handles marketing site purchasers who paid before installing — signing in auto-discovers their license.
- **Community, signed in, no license**: "Upgrade to Operator" primary button + "Upgrade to Scale" secondary button. Both initiate Stripe Checkout via `POST /api/billing/checkout`. Also shows fallback "Have a license key?" expandable form.
- **Paid active**: "Manage Subscription" button opens Stripe Customer Portal via `POST /api/billing/portal`.
- **Checkout in progress**: Button shows loading spinner (`Loader2` icon rotating).

```tsx
async function handleUpgrade(targetTier: string) {
  setLoading(true);
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ tier: targetTier, period }),
  });
  const { checkoutUrl } = await res.json();
  window.location.href = checkoutUrl;
}
```

### API Endpoint

`GET /api/license/status` — returns combined tier + usage data:

```json
{
  "tier": "community",
  "expiresAt": null,
  "usage": {
    "memoriesPerProfile": { "current": 42, "max": 50, "profileId": "researcher" },
    "contextVersionsPerProfile": { "current": 7, "max": 10, "profileId": "researcher" },
    "activeSchedules": { "current": 3, "max": 5 },
    "historyRetentionDays": { "current": 30, "max": 30 }
  }
}
```

Server-side query helper in `src/lib/license/usage-queries.ts`:

```ts
export async function getUsageCounts(): Promise<UsageCounts> {
  // Memory count: max across all profiles
  // Context versions: max across all profiles
  // Active schedules: global count
  // History: age of oldest agent_log entry
}
```

### Sidebar Navigation

Add "Subscription" item to the Configure group in `src/components/shared/app-sidebar.tsx`:

```ts
{ title: 'Subscription', url: '/settings/subscription', icon: CreditCard }
```

Position: after "Settings", before any future Configure items.

### Post-Purchase Success Flow

When Stripe redirects back to `/settings/subscription?success=true`:

1. Page detects `?success=true` search param
2. Calls `POST /api/license/refresh` to re-validate the license from Supabase
3. Shows a `sonner` toast: "Welcome to {tier}! Your new limits are now active."
4. Removes `?success=true` from URL via `router.replace()` to prevent re-triggering on refresh

### Responsive Layout

- Desktop: 2x2 usage grid, 4-column tier comparison
- Tablet: 2x2 usage grid, 2-column tier comparison (scroll)
- Mobile: 1-column stacked for both usage and tiers

## Acceptance Criteria

- [ ] `/settings/subscription` route renders with PageShell + FormSectionCard pattern
- [ ] Current tier displayed as StatusChip with correct variant per tier
- [ ] Four usage summary cards show current/max with color-coded progress bars
- [ ] Progress bar colors transition: green (< 70%), amber (70-90%), red (> 90%)
- [ ] Tier comparison grid shows 4 tiers with monthly/annual toggle via shadcn Tabs
- [ ] Current tier column highlighted with `ring-2 ring-primary`
- [ ] Upgrade buttons redirect to Stripe Checkout for the selected tier and period
- [ ] Manage button opens Stripe Customer Portal for paid users
- [ ] `GET /api/license/status` returns tier + usage counts
- [ ] Sidebar has "Subscription" entry under Configure group with CreditCard icon
- [ ] Post-purchase `?success=true` triggers license refresh + toast notification
- [ ] Loading state shown during checkout redirect
- [ ] Page is responsive across desktop, tablet, and mobile breakpoints

## Scope Boundaries

**Included:**
- `/settings/subscription` page with all four subsections
- Tier comparison grid with monthly/annual pricing toggle
- Usage summary cards with progress indicators
- Stripe Checkout redirect for upgrades
- Stripe Customer Portal redirect for billing management
- `GET /api/license/status` API endpoint
- Sidebar navigation entry
- Post-purchase success toast flow

**Excluded:**
- Stripe webhook handling — see `stripe-billing-integration` feature
- License key input form — see `license-activation-flow` feature
- Upgrade CTA banners on other pages — see `upgrade-cta-banners` feature
- Invoice history / payment method display — handled by Stripe Portal
- Coupon/promo code input — future enhancement
- Team/seat management — Enterprise tier, future feature

## References

- Depends on: `features/local-license-manager.md` — `getLicenseStatus()`, `isFeatureAllowed()`
- Depends on: `features/stripe-billing-integration.md` — Checkout + Portal API routes
- Related: `features/community-edition-soft-limits.md` — defines the limits shown in usage cards
- Related: `features/upgrade-cta-banners.md` — all banners link to this page
- Related: `features/license-activation-flow.md` — activation form lives on this page
- Settings pattern: `src/app/settings/page.tsx` — existing settings page structure
- Shared components: `src/components/shared/` — PageShell, StatusChip, FormSectionCard
- Sidebar: `src/components/shared/app-sidebar.tsx` — Configure group
- Design system: `design-system/MASTER.md` — surface-card, elevation-1, OKLCH tokens
