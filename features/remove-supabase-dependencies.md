---
title: Remove Supabase Dependencies
status: planned
priority: P0
milestone: mvp
source: conversation
dependencies: [community-edition-simplification]
---

# Remove Supabase Dependencies

## Description

Remove all Supabase integration from the stagent app: cloud sync (encrypted backup/restore via Supabase Storage), cloud account sign-in (magic link auth), telemetry ingestion to Supabase edge functions, conversion tracking, email sending, and the `@supabase/supabase-js` npm package.

The app already has local DatabaseSnapshotsSection for backups, making cloud sync redundant for the community edition. Telemetry becomes local-only (the usage ledger in SQLite remains — just the cloud flush is removed).

The only Supabase artifact that stays is `supabase/functions/waitlist-signup/` — it serves the stagent marketing website and is outside the app's scope.

## User Story

As a stagent user, I want the app to run fully offline without any cloud service dependencies so that I have complete control over my data and no external service is required.

## Technical Approach

### Phase 1: Delete cloud client libraries
- Delete `src/lib/cloud/supabase-client.ts` (server-side Supabase client)
- Delete `src/lib/cloud/supabase-browser.ts` (browser-side Supabase client)
- Delete `src/lib/sync/cloud-sync.ts` (encrypted backup/restore)
- Delete `src/hooks/use-supabase-auth.ts` (auth hook)

### Phase 2: Delete cloud API routes and auth
- Delete `src/app/api/sync/` (export, restore, sessions routes)
- Delete `src/app/auth/callback/route.ts` (magic link callback)
- Delete `src/app/api/onboarding/email/route.ts` (magic link sign-in trigger)

### Phase 3: Delete cloud UI components
- Delete `src/components/settings/cloud-account-section.tsx` (sign-in UI)
- Delete `src/components/settings/cloud-sync-section.tsx` (backup/restore UI)
- Delete `src/components/onboarding/email-capture-card.tsx` (first-run email capture)

### Phase 4: Simplify telemetry (remove Supabase flush, keep local ledger)
- Delete `src/lib/telemetry/conversion-events.ts` (dead — calls deleted edge function)
- Edit `src/lib/telemetry/queue.ts` — remove Supabase imports and the cloud flush; make `queueTelemetryEvent()` a no-op or remove entirely
- Edit `src/lib/usage/ledger.ts` — remove the `queueTelemetryEvent()` call (usage ledger stays, telemetry cloud flush goes)
- Edit `src/instrumentation-node.ts` — remove `startTelemetryFlush()` call

### Phase 5: Delete Supabase edge functions (except waitlist-signup)
- Delete `supabase/functions/telemetry-ingest/`
- Delete `supabase/functions/send-email/`
- Delete `supabase/migrations/` (cloud-side schema, not local SQLite)
- Delete `supabase/.temp/` (CLI artifacts)
- Keep `supabase/functions/waitlist-signup/` (website feature)

### Phase 6: Surgical edits — settings page and references
- Edit `src/app/settings/page.tsx` — remove CloudAccountSection + CloudSyncSection imports and components
- Edit `src/app/page.tsx` — remove EmailCaptureCard import and component
- Edit `src/lib/constants/settings.ts` — remove cloud/sync/supabase settings keys
- Edit `src/app/api/workspace/fix-data-dir/route.ts` — remove STAGENT_CLOUD_DISABLED logic (no longer meaningful)
- Clean up `.env.local` references to NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

### Phase 7: Remove npm dependency
- Remove `@supabase/supabase-js` from package.json
- Run `npm install` to update lockfile

### Phase 8: Keep TelemetrySection UI (toggle still useful)
- The TelemetrySection component in settings only calls `/api/settings/telemetry` (a local setting). It does NOT import Supabase. Keep it — the toggle can control future local telemetry features.

## Acceptance Criteria

- [ ] No `@supabase/supabase-js` in package.json
- [ ] No imports from `@/lib/cloud`, `@/lib/sync`, or `@supabase` in src/
- [ ] No cloud account or cloud sync UI in settings page
- [ ] No email capture card on homepage
- [ ] No magic link auth flow (auth callback route deleted)
- [ ] Telemetry flush to Supabase removed; usage ledger continues recording locally
- [ ] TelemetrySection UI component preserved (local setting toggle)
- [ ] DatabaseSnapshotsSection still works for local backups
- [ ] `supabase/functions/waitlist-signup/` preserved
- [ ] Build passes, all tests pass
- [ ] Grep sweep: zero references to supabase, cloud-sync, or getSupabase in src/

## Scope Boundaries

**Included:**
- All Supabase client code (server + browser)
- Cloud sync feature (backup/restore/sessions)
- Cloud account sign-in (magic link auth, auth callback)
- Onboarding email capture
- Telemetry cloud flush
- Conversion tracking
- send-email and telemetry-ingest edge functions
- Supabase cloud migrations
- `@supabase/supabase-js` npm package

**Excluded:**
- `supabase/functions/waitlist-signup/` (website feature — KEEP)
- TelemetrySection UI component (local toggle — KEEP)
- Usage ledger (`src/lib/usage/ledger.ts`) — continues recording locally in SQLite
- DatabaseSnapshotsSection — local backup feature, unrelated to Supabase
- `STAGENT_CLOUD_DISABLED` env var in clone `.env.local` files — harmless dead config, will be ignored

## References

- Architect impact analysis: `features/architect-report.md`
- Predecessor: `features/community-edition-simplification.md`
