---
title: Marketplace Access Gate
status: planned
priority: P1
milestone: plg-core
source: plans/lucky-fluttering-flute.md
dependencies: [local-license-manager, supabase-cloud-backend]
---

# Marketplace Access Gate

## Description

The marketplace is Stagent's primary network effect engine — not just a download catalog, but an income platform where solo operators monetize their best workflows. The tier structure is designed to maximize marketplace liquidity: Community users browse freely (creating demand visibility), Solo users can buy (creating a buyer pool), Operator users can sell (creating a creator economy), and Scale users get better economics and featured placement.

This inverts the typical "gate at the top" model. Instead of locking marketplace behind the highest tier, buying is unlocked at the lowest paid tier ($19/mo) to maximize the number of potential buyers — which makes selling more attractive at the Operator tier ($49/mo).

## User Story

As a Solo tier user, I want to browse and import community blueprints so I can leverage proven workflows without building from scratch.

As an Operator tier user, I want to publish my best workflows to the marketplace and earn revenue so my subscription pays for itself.

As a Community user, I want to browse the marketplace to see what's available and understand the value of upgrading.

## Technical Approach

### Tier-Based Access Matrix

| Capability | Community | Solo ($19) | Operator ($49) | Scale ($99) |
|------------|-----------|------------|-----------------|-------------|
| Browse catalog | Yes | Yes | Yes | Yes |
| View blueprint detail | Yes | Yes | Yes | Yes |
| Buy/import blueprints | No | **Yes** | Yes | Yes |
| Publish blueprints | No | No | **Yes** | Yes |
| Creator analytics | No | No | **Yes** | Yes |
| Revenue split | — | — | **70/30** | **80/20** |
| Featured listing | No | No | No | **Yes** |

### API Gates

**`POST /api/marketplace/import`** (buying):
- Check `isFeatureAllowed('marketplace_buy')` → minimum tier: `solo`
- If Community: return HTTP 402 with `{ error: 'TIER_REQUIRED', requiredTier: 'solo', message: 'Upgrade to Solo to import marketplace blueprints' }`
- If Solo+: fetch blueprint content from Supabase `blueprints` table, call existing `createBlueprint()`, increment `install_count`

**`POST /api/marketplace/publish`** (selling):
- Check `isFeatureAllowed('marketplace_sell')` → minimum tier: `operator`
- If below Operator: return HTTP 402 with `{ error: 'TIER_REQUIRED', requiredTier: 'operator', message: 'Upgrade to Operator to publish to the marketplace' }`
- If Operator+: validate blueprint content, insert into Supabase `blueprints` table with `status: 'draft'`
- Creator sets price (0 = free, or $1-$25 range)

**`GET /api/marketplace/catalog`**:
- No auth required — proxies to Supabase `marketplace-catalog` Edge Function
- Returns paginated published blueprints with category/search filter
- Caches response in settings table for offline browsing

### Marketplace Client

**`src/lib/marketplace/marketplace-client.ts`**:
- `listBlueprints(opts: { category?, search?, page? })` — public catalog query
- `getBlueprintDetail(id: string)` — full blueprint with steps, author, stats
- `importBlueprint(id: string)` — fetches content + calls `createBlueprint()`
- `publishBlueprint(blueprint: MarketplaceSubmission)` — uploads to Supabase
- `getCreatorStats(userId: string)` — revenue, installs, ratings for creator dashboard
- Uses Supabase anon key for public reads, user JWT for mutations

### Marketplace Page

**`src/app/marketplace/page.tsx`** — Server Component:
- PageShell with title "Marketplace" and description "Browse and publish community workflows"
- Tabs: "Browse" (default) | "My Listings" (Operator+ only, shows creator's published items)

**`src/components/marketplace/blueprint-card.tsx`**:
- Card: title, category badge, description (2-line clamp), author name
- Stats row: success rate badge (StatusChip), install count, price
- Action button adapts to tier:
  - Community: "Upgrade to import" with lock icon → gate dialog
  - Solo+: "Import" with download icon → import sheet
  - Creator's own listing: "Edit" with pencil icon

**`src/components/marketplace/category-filter.tsx`**:
- Horizontal tab bar: All / Marketing / Sales / Content / Finance / Operations / Development
- Client-side filter from pre-fetched data

**`src/components/marketplace/import-sheet.tsx`**:
- DetailPane sliding from right (per feedback-prefer-sliding-sheets memory)
- Full blueprint detail: description, step list, author, stats
- "Import" button at bottom (gated by Solo+ tier)
- Success: `toast.success("Blueprint imported — find it in Workflows")`

**`src/components/marketplace/publish-sheet.tsx`** (Operator+ only):
- DetailPane for creating a marketplace listing
- Fields: title, description, category (select), price ($0-$25), tags
- Blueprint selector: dropdown of user's existing workflow blueprints
- Preview of how the listing will appear
- "Publish" button → `POST /api/marketplace/publish`

**`src/components/marketplace/gate-dialog.tsx`**:
- For Community users clicking Import: "Import requires Solo ($19/mo)"
- For Solo users clicking Publish: "Publishing requires Operator ($49/mo)"
- Both link to `/settings/subscription?highlight={tier}`

### Revenue Split

Revenue is processed via Stripe Connect (Operator+ creators connect their Stripe account):
- Operator creators: 70% of sale price (Stagent takes 30%)
- Scale creators: 80% of sale price (Stagent takes 20%)
- Stripe Connect handles payouts — no manual payment processing
- Minimum payout threshold: $10

### Creator Analytics

Visible in the existing analytics dashboard (`/analytics`) as a new "Creator" tab (Operator+ only):
- Total revenue earned (all time + this month)
- Install count per listing
- Success rate per listing (from aggregated telemetry)
- Revenue per listing
- "Your top blueprint: {name} — {installs} installs, ${revenue} earned"

### Sidebar Integration

Add "Marketplace" to the Work group in `src/components/shared/app-sidebar.tsx`:
- Icon: `Store` from Lucide
- Route: `/marketplace`
- Position: after "Workflows"

### Key States

| State | Treatment |
|-------|-----------|
| Loading | CardSkeleton grid (6 placeholders) |
| Empty category | EmptyState: "No blueprints in this category yet" |
| Community browsing | Cards visible, import buttons show lock icon + "Upgrade to import" |
| Solo browsing | Cards visible, import buttons enabled, publish button shows "Upgrade to publish" |
| Operator browsing | Full access — import and publish both enabled |
| Import in progress | Button shows Loader2 spinner |
| Import success | Toast + option to navigate to Workflows |
| Publish success | Toast + listing appears in "My Listings" tab |

### The Flywheel This Creates

```
Solo operator builds great workflow for own use
  → Sees "Publish to marketplace" CTA
  → Needs Operator ($49/mo) to publish
  → Upgrades, lists blueprints at $5 each
  → 20 Solo users buy each → $70 revenue (70% of $100)
  → Subscription pays for itself
  → Builds more blueprints (motivated by income)
  → More blueprints attract more Solo users
  → More buyers = more creator revenue
  → More creators upgrade to Operator
```

## Acceptance Criteria

- [ ] Community users can browse full marketplace catalog without auth
- [ ] Community users see lock icon + gate dialog when clicking Import
- [ ] Solo users can import blueprints (HTTP 200 from /api/marketplace/import)
- [ ] Solo users see gate dialog when clicking Publish ("Requires Operator")
- [ ] Operator users can publish blueprints with title, description, category, price
- [ ] Operator creators get 70% revenue split
- [ ] Scale creators get 80% revenue split and "Featured" badge on listings
- [ ] `/marketplace` page renders catalog grid from Supabase public data
- [ ] BlueprintCard shows title, category, success rate, install count, price
- [ ] CategoryFilter tabs filter by category
- [ ] ImportSheet (DetailPane) shows full blueprint detail with import button
- [ ] PublishSheet (DetailPane) allows listing creation with preview
- [ ] "My Listings" tab shows creator's published blueprints with stats
- [ ] Creator analytics visible in /analytics dashboard (Operator+ only)
- [ ] "Marketplace" appears in sidebar Work group
- [ ] Stripe Connect onboarding flow for creator payouts
- [ ] Minimum payout threshold of $10 enforced

## Scope Boundaries

**Included:**
- Tiered access (Community browse, Solo buy, Operator sell, Scale featured)
- Marketplace page with catalog grid, category filter, import/publish sheets
- Revenue split (70/30 Operator, 80/20 Scale)
- Creator analytics tab in /analytics dashboard
- Stripe Connect for creator payouts
- Blueprint publishing flow
- Gate dialogs per tier

**Excluded:**
- Ratings and reviews system (V2)
- Blueprint versioning or update notifications (V2)
- Automated content moderation (manual review for V1)
- Profile marketplace (blueprints only for V1; profiles added later)
- Dispute resolution for paid blueprints (handle via support for V1)
- Subscription bundling (all marketplace items individually priced)

## References

- Depends on: [`local-license-manager`](local-license-manager.md) — tier checks for buy/sell gates
- Depends on: [`supabase-cloud-backend`](supabase-cloud-backend.md) — blueprints table, RLS
- Related: [`outcome-analytics-dashboard`](outcome-analytics-dashboard.md) — creator analytics tab
- Related: [`stripe-billing-integration`](stripe-billing-integration.md) — Stripe Connect extends billing
- Related: [`telemetry-foundation`](telemetry-foundation.md) — success rate badges from aggregated data
- Existing: `src/app/api/blueprints/import/route.ts` — blueprint import infrastructure to reuse
- Pattern: `feedback-prefer-sliding-sheets.md` — DetailPane for import/publish sheets
