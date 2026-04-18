---
title: Supabase Cloud Backend
status: completed
priority: P0
milestone: post-mvp
source: plans/lucky-fluttering-flute.md
dependencies: []
---

# Supabase Cloud Backend

## Description

Provisions all Supabase-side infrastructure for the monetization system. Creates licenses, telemetry, blueprints, sync_sessions tables with Row Level Security, deploys Stripe webhook and license validation Edge Functions, and wires Supabase Auth (email + GitHub OAuth). Entirely cloud-side work — no Next.js code changes except a thin Supabase client module.

## User Story

As a ainative developer, I want a Supabase backend configured with all tables, RLS, and Edge Functions so that the license, sync, telemetry, and marketplace systems have a cloud foundation.

## Technical Approach

- Create Supabase project `ainative-cloud`, configure Auth (email/password + GitHub OAuth)
- SQL migrations for 4 tables: licenses (user_id, tier, stripe_customer_id, stripe_subscription_id, status, current_period_start/end, cancel_at_period_end), telemetry (anonymized append-only: profile_domain, workflow_pattern, runtime_id, provider_id, model_id, outcome_status, token_count, cost_micros, duration_ms, step_count, week_bucket), blueprints (creator_id, title, description, category, content YAML, price_cents, success_rate, install_count, status, tags), sync_sessions (user_id, device_name, device_fingerprint, blob_path, blob_size_bytes, encryption_iv, content_hash, sync_type, status)
- RLS policies: users read own license; telemetry insert-only via service role; blueprints public-read when published, creator-write; sync_sessions user-scoped
- Storage bucket: `ainative-sync` with per-user path RLS
- Edge Function: `stripe-webhook` — receives Stripe events, upserts licenses table, sends Resend email
- Edge Function: `validate-license` — JWT auth, returns tier/status/expiresAt
- Edge Function: `telemetry-ingest` — validates no PII, inserts to telemetry table, rate-limited 100/user/min
- Edge Function: `marketplace-catalog` — paginated published blueprints with filtering
- Create `src/lib/license/supabase-client.ts` — lazy singleton @supabase/supabase-js client
- Environment: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local

## Acceptance Criteria

- [ ] Supabase project created with Auth configured (email + GitHub OAuth)
- [ ] All 4 tables created with correct column types and constraints
- [ ] RLS policies enforce user isolation on licenses, sync_sessions
- [ ] Telemetry table is append-only (no SELECT for users, only aggregates via Edge Function)
- [ ] Blueprints are publicly readable when status='published'
- [ ] Storage bucket `ainative-sync` has per-user path policy
- [ ] stripe-webhook Edge Function receives and processes subscription events correctly
- [ ] validate-license Edge Function returns tier for authenticated user
- [ ] telemetry-ingest Edge Function rejects events with PII fields (taskId, projectId, taskTitle)
- [ ] marketplace-catalog Edge Function returns paginated results with category filter
- [ ] Supabase client module exports singleton with correct env vars

## Scope Boundaries

**Included:**
- Supabase project setup, 4 tables, RLS, 4 Edge Functions, Supabase client module

**Excluded:**
- Stripe product/price setup (stripe-billing-integration), local schema changes (local-license-manager), sync upload logic (cloud-sync), telemetry emission logic (telemetry-foundation)

## References

- Follow-on features: [stripe-billing-integration](stripe-billing-integration.md), [local-license-manager](local-license-manager.md), [cloud-sync](cloud-sync.md)
