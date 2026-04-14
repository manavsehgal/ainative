---
title: Upgrade Conversion Instrumentation
status: completed
priority: P3
milestone: plg-growth
source: features/roadmap.md
dependencies: [supabase-cloud-backend, upgrade-cta-banners, community-edition-soft-limits]
---

# Upgrade Conversion Instrumentation

> **Superseded by `community-edition-simplification` (2026-04-13).** This feature shipped but was later fully reverted when Stagent pivoted to a 100% free Community Edition with no tiers, billing, or cloud dependency. Kept as historical record.

## Description

Lightweight funnel tracking that records banner impressions, clicks, and checkout completions to understand the Community-to-Premium conversion pipeline. Events are stored in a Supabase `conversion_events` table with no PII — only an anonymous session UUID and event type. Enables data-driven iteration on upgrade prompts and future A/B testing of thresholds (e.g., memory cap at 50 vs 75).

No product UI in V1 — conversion data is analyzed via Supabase Studio dashboards.

## User Story

As the product team, we want to track how users move through the upgrade funnel — from seeing a banner to completing checkout — so we can measure conversion rates and optimize the upgrade experience.

As the product team, we want to know which soft limit triggers the most upgrades so we can prioritize which limits to adjust.

## Technical Approach

### Conversion Events Client

**`src/lib/conversion/conversion-events.ts`**:

```typescript
type ConversionEventType =
  | 'banner_impression'
  | 'banner_click'
  | 'checkout_started'
  | 'checkout_completed'
  | 'limit_hit';

interface ConversionEvent {
  eventType: ConversionEventType;
  sessionId: string;          // anonymous UUID from settings table
  source?: string;            // e.g., "memory-warning-banner", "schedule-limit-toast"
  metadata?: Record<string, string>; // e.g., { limit: "memory", current: "50", max: "50" }
  timestamp: string;          // ISO 8601
}
```

- `trackEvent(eventType, source?, metadata?)`: fire-and-forget POST to Supabase Edge Function
- Reads `sessionId` from settings table (`key = 'anonymous_session_id'`); generates UUID on first call if missing
- Wrapped in try/catch — failures silently swallowed, never blocks UI
- No-op if no Supabase connection configured (pure Community installs)

### Anonymous Session ID

- Stored in settings table: `key = 'anonymous_session_id'`, `value = crypto.randomUUID()`
- Generated on first `trackEvent()` call, persisted for session continuity
- Not tied to any user identity — purely for grouping events in a single install's funnel

### Supabase Edge Function: `conversion-ingest`

**`supabase/functions/conversion-ingest/index.ts`**:
- Accepts: `{ event: ConversionEvent }`
- Validates schema (Zod)
- Inserts into `conversion_events` table
- Returns 200 on success

### Supabase Table: `conversion_events`

```sql
CREATE TABLE conversion_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  session_id text NOT NULL,
  source text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_conversion_events_type ON conversion_events(event_type);
CREATE INDEX idx_conversion_events_session ON conversion_events(session_id);
```

No PII columns — no email, no user ID, no IP address.

### Integration Points

**Upgrade CTA Banners** (`src/components/shared/upgrade-banner.tsx`):
- `banner_impression`: tracked on mount (via `useEffect`, debounced to once per session per banner)
- `banner_click`: tracked on CTA button click

**Soft Limit Enforcement** (`src/lib/limits/`):
- `limit_hit`: tracked when a soft limit is reached, with `source` identifying which limit (e.g., "memory", "schedules", "history")
- `metadata` includes `{ limit: "memory", current: "50", max: "50" }`

**Activation / Checkout Flow**:
- `checkout_started`: tracked when user clicks through to Stripe Checkout
- `checkout_completed`: tracked on return from Stripe success URL

### V1 Dashboard (Supabase Studio)

No product UI — raw analysis via Supabase Studio:
- Funnel: `banner_impression` → `banner_click` → `checkout_started` → `checkout_completed`
- Drop-off rates between each stage
- Which `source` (banner/limit) drives the most conversions
- Session-level journey reconstruction via `session_id`

## Acceptance Criteria

- [ ] `trackEvent()` sends conversion events to Supabase Edge Function
- [ ] Anonymous session UUID stored in settings table, generated on first use
- [ ] 5 event types tracked: banner_impression, banner_click, checkout_started, checkout_completed, limit_hit
- [ ] Events include source identifier (which banner or limit triggered it)
- [ ] All tracking is fire-and-forget (failures silently swallowed)
- [ ] No PII stored in conversion_events table
- [ ] `conversion-ingest` Edge Function validates and stores events
- [ ] Upgrade banners track impression on mount and click on CTA
- [ ] Soft limit enforcement tracks limit_hit with limit type metadata
- [ ] No-op when Supabase connection is not configured

## Scope Boundaries

**Included:** conversion-events.ts client, anonymous session ID, conversion-ingest Edge Function, conversion_events Supabase table, banner/limit integration hooks, Supabase Studio analysis

**Excluded:**
- Product UI dashboard for conversion metrics (Supabase Studio for V1)
- A/B testing framework (future iteration — this provides the data foundation)
- User-level attribution (anonymous session only)
- Revenue tracking (Stripe dashboard handles this)
- Retroactive event backfill

## References

- Depends on: [`supabase-cloud-backend`](supabase-cloud-backend.md) — Edge Functions, Supabase tables
- Depends on: [`upgrade-cta-banners`](upgrade-cta-banners.md) — banner impression/click tracking integration
- Depends on: [`community-edition-soft-limits`](community-edition-soft-limits.md) — limit_hit tracking integration
- Related: [`telemetry-foundation`](telemetry-foundation.md) — separate system for product usage telemetry
- Related: [`marketing-site-pricing-page`](marketing-site-pricing-page.md) — checkout flow originates from pricing page
