---
title: Remove Anonymous Telemetry
status: completed
priority: P0
milestone: mvp
source: conversation
dependencies: [remove-supabase-dependencies]
---

# Remove Anonymous Telemetry

## Description

Remove the vestigial anonymous telemetry feature — the opt-in toggle in settings, the telemetry settings API route, and the associated settings keys. This enforces the 100% data privacy promise: no user usage data is collected or transmitted.

The cloud flush was already removed in the Supabase removal. What remains is the UI toggle and settings storage — dormant code that serves no purpose and creates a false impression that data might be shared.

The Analytics dashboard (agent performance and ROI insights) and the usage ledger (local cost tracking for budget guardrails) are completely independent and unaffected.

## User Story

As a ainative user, I want confidence that no usage data is collected or shared so that I can trust the 100% data privacy promise.

## Technical Approach

- Delete `src/components/settings/telemetry-section.tsx`
- Delete `src/app/api/settings/telemetry/route.ts`
- Edit `src/app/settings/page.tsx` — remove TelemetrySection import and component
- Edit `src/lib/constants/settings.ts` — remove TELEMETRY_ENABLED and TELEMETRY_RUNTIME_ID keys

## Acceptance Criteria

- [ ] No telemetry toggle visible in settings
- [ ] No telemetry API route exists
- [ ] No TELEMETRY settings keys in constants
- [ ] Analytics dashboard still works (/analytics page renders with data)
- [ ] Usage ledger still records locally (budget guardrails work)
- [ ] Chat stream-telemetry (dev diagnostics) still works
- [ ] Build passes, all tests pass

## Scope Boundaries

**Included:**
- TelemetrySection settings component
- /api/settings/telemetry route
- TELEMETRY_ENABLED and TELEMETRY_RUNTIME_ID settings keys

**Excluded:**
- Analytics dashboard (KEEP — queries tasks + usage_ledger)
- Usage ledger (KEEP — required for budget guardrails)
- Chat stream-telemetry (KEEP — dev diagnostics, different system)
