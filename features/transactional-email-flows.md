---
title: Transactional Email Flows
status: planned
priority: P2
milestone: plg-growth
source: features/roadmap.md
dependencies: [supabase-cloud-backend, stripe-billing-integration, community-edition-soft-limits]
---

# Transactional Email Flows

## Description

Five Resend-powered transactional email types delivered via a generic Supabase Edge Function dispatcher. Emails cover the full user lifecycle from signup through ongoing engagement, triggered by product events rather than manual campaigns.

The 5 email types:

1. **Welcome** — sent on signup (Supabase Auth trigger)
2. **Upgrade confirmation** — sent on `subscription.created` Stripe webhook
3. **Memory warning** — sent at 75% threshold (37/50 learned contexts) triggered from the daily maintenance job
4. **Weekly digest** — opt-in, for Premium users with sync enabled, summarizing task activity
5. **Quarterly State of AI Agents report** — manual trigger, sent to all opted-in users

All emails route through a single `send-email` Edge Function that accepts a template ID and dynamic data, then dispatches via the Resend API.

## User Story

As a user, I want to receive timely, relevant emails about my account status — welcome messages, upgrade confirmations, and usage warnings — so I stay informed without needing to check the app.

As a Premium user, I want an optional weekly digest of my task activity so I can track my usage patterns at a glance.

## Technical Approach

### Edge Function: `send-email`

**`supabase/functions/send-email/index.ts`**:
- Generic Resend dispatcher
- Accepts: `{ to: string, templateId: string, data: Record<string, unknown> }`
- Looks up Resend template by ID, merges dynamic data, sends via Resend API
- Returns 200 on success, 400 on validation error, 502 on Resend error
- RESEND_API_KEY stored in Supabase Edge Function secrets

### Email Types

| # | Template | Trigger | Data |
|---|---|---|---|
| 1 | `welcome` | Supabase Auth `user.created` hook | `{ email }` |
| 2 | `upgrade-confirmation` | Stripe webhook `subscription.created` | `{ email, plan, billingCycle }` |
| 3 | `memory-warning` | Daily maintenance job | `{ email, currentCount, limit, percentUsed }` |
| 4 | `weekly-digest` | Cron (weekly, opt-in) | `{ email, tasksCompleted, tokensUsed, topProfiles }` |
| 5 | `quarterly-report` | Manual trigger | `{ email, reportUrl }` |

### Trigger Integration

**Welcome email**: Supabase Auth webhook on `user.created` event calls `send-email` Edge Function directly.

**Upgrade confirmation**: Stripe webhook handler (`supabase/functions/stripe-webhook/`) calls `send-email` after processing `subscription.created`.

**Memory warning**: `src/lib/maintenance/daily-job.ts` (existing daily maintenance) adds a check:
```typescript
const count = db.select({ count: sql`count(*)` }).from(learnedContext).get();
if (count >= 37) {
  await reportMemoryWarning(userEmail, count, 50);
}
```

**`src/lib/email.ts`** helper:
- `reportMemoryWarning(email, current, limit)` — POSTs to send-email Edge Function with `memory-warning` template
- Fire-and-forget, errors logged but not thrown

**Weekly digest**: Supabase scheduled function (pg_cron) queries usage data for Premium users with sync enabled, calls `send-email` per user.

**Quarterly report**: Manual invocation via Supabase dashboard or CLI, sends to all opted-in users.

### Resend Templates

Each email uses a Resend template with consistent branding:
- Stagent logo header
- Clean, text-focused layout
- Unsubscribe link in footer
- Templates managed in Resend dashboard (not in codebase)

## Acceptance Criteria

- [ ] `send-email` Edge Function dispatches emails via Resend API
- [ ] Welcome email sent automatically on user signup
- [ ] Upgrade confirmation sent on Stripe `subscription.created` webhook
- [ ] Memory warning sent when learned_context count reaches 75% (37/50)
- [ ] Weekly digest sent to opted-in Premium users with sync enabled
- [ ] Quarterly report can be manually triggered for all opted-in users
- [ ] `email.ts` exports `reportMemoryWarning()` helper
- [ ] All email sends are fire-and-forget (failures logged, not thrown)
- [ ] Each email type uses a distinct Resend template

## Scope Boundaries

**Included:** 5 email types, generic send-email Edge Function, Resend integration, email.ts helpers, daily maintenance hook for memory warning

**Excluded:**
- In-app email preference management UI (uses Resend unsubscribe for V1)
- Email analytics dashboard (use Resend dashboard)
- Custom email template editor
- SMS or push notification channels

## References

- Depends on: [`supabase-cloud-backend`](supabase-cloud-backend.md) — Edge Functions, Auth hooks
- Depends on: [`stripe-billing-integration`](stripe-billing-integration.md) — subscription.created webhook
- Depends on: [`community-edition-soft-limits`](community-edition-soft-limits.md) — memory limit thresholds
- Related: [`telemetry-foundation`](telemetry-foundation.md) — quarterly report uses aggregated telemetry
