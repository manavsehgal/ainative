---
title: Telemetry Foundation
status: planned
priority: P2
milestone: plg-growth
source: features/roadmap.md
dependencies: [supabase-cloud-backend, local-license-manager]
---

# Telemetry Foundation

## Description

Opt-in anonymized telemetry system (default OFF) that collects aggregate usage patterns to power the quarterly State of AI Agents report and personalized benchmarks for opted-in users. Privacy-first design: no task content, no user identifiers, no project names — only structural metadata about how agents are used.

Telemetry events are batched locally in the settings table and flushed every 5 minutes to a Supabase Edge Function. Failures are silently swallowed — telemetry never degrades the core product experience.

## User Story

As a user, I want to opt in to anonymized telemetry so I can contribute to the State of AI Agents report and receive personalized benchmarks comparing my usage patterns to the community.

As the product team, we want aggregate usage data to understand which agent profiles, workflow patterns, and runtime configurations are most successful, so we can prioritize improvements.

## Technical Approach

### Settings Toggle

**`src/components/settings/telemetry-section.tsx`**:
- Toggle switch: "Share anonymous usage data"
- Value framing text: "Help improve Stagent and get personalized benchmarks in the quarterly State of AI Agents report"
- Persists to settings table: `key = 'telemetry_opt_in'`, `value = 'true' | 'false'`
- Default: OFF (opt-in, not opt-out)

### TelemetryEvent Type

```typescript
interface TelemetryEvent {
  // What was used
  profileDomain: string;        // e.g. "work", "personal"
  workflowPattern: string;      // e.g. "sequential", "parallel", "single-task"
  runtimeId: string;            // e.g. "claude-agent-sdk", "codex-app-server"
  providerId: string;           // e.g. "anthropic", "openai"
  modelId: string;              // e.g. "claude-sonnet-4-20250514"

  // What happened
  activityType: string;         // "task" | "workflow" | "schedule"
  outcomeStatus: string;        // "completed" | "failed" | "cancelled"
  tokenCount: number;
  costMicros: number;           // cost in microdollars
  durationMs: number;
  stepCount: number;
}
```

**EXPLICITLY ABSENT** (never collected):
- `taskId`, `projectId` — no entity identifiers
- `taskTitle`, `description` — no user content
- `result` — no agent output
- `userId`, `email` — no personal identifiers

### Telemetry Queue

**`src/lib/telemetry/queue.ts`**:

- `queueTelemetryEvent(event: TelemetryEvent)`: checks opt-in setting, appends event to JSON batch stored in settings table (`key = 'telemetry_batch'`, value is JSON array)
- `flushTelemetryBatch()`: reads batch from settings, POSTs to `telemetry-ingest` Edge Function, clears batch on success
- Batch capped at 200 events — oldest events dropped if cap exceeded before flush
- All operations wrapped in try/catch — errors logged at debug level, never thrown

### Flush Scheduling

**`src/instrumentation.ts`** (existing Next.js register hook):
- Adds `setInterval(flushTelemetryBatch, 5 * 60 * 1000)` — flush every 5 minutes
- Flush also triggered on graceful shutdown

### Hook into Usage Ledger

**`src/lib/data/usage.ts`** (`recordUsageLedgerEntry()`):
- After `db.insert(usageLedger)`, calls `queueTelemetryEvent()` with mapped fields
- Mapping extracts only structural metadata from the ledger entry
- Fire-and-forget — does not await or check result

### Edge Function: `telemetry-ingest`

**`supabase/functions/telemetry-ingest/index.ts`**:
- Accepts: `{ events: TelemetryEvent[], runtimeId: string }`
- Validates event schema (Zod)
- Inserts into Supabase `telemetry_events` table (append-only)
- `runtimeId` is a random UUID generated on first opt-in (stored in settings, not tied to user identity)
- Returns 200 on success, 400 on validation error

### Incentive: Personalized Benchmarks

Opted-in users with a `runtimeId` can query:
- `GET /api/telemetry/benchmarks` — returns anonymized comparisons (e.g., "Your task completion rate is above 80% of users", "Most popular profile in your domain: code-reviewer")
- Benchmarks computed server-side from Supabase aggregates, returned as simple stats

## Acceptance Criteria

- [ ] Telemetry is OFF by default (opt-in)
- [ ] TelemetrySection component in settings with toggle and value framing
- [ ] `queueTelemetryEvent()` checks opt-in before appending to batch
- [ ] Batch stored in settings table as JSON, capped at 200 events
- [ ] `flushTelemetryBatch()` POSTs to telemetry-ingest Edge Function every 5 minutes
- [ ] Flush failures silently swallowed (logged at debug level)
- [ ] TelemetryEvent contains ONLY structural metadata (no IDs, titles, content, or PII)
- [ ] Hook into `recordUsageLedgerEntry()` fires telemetry event after db.insert
- [ ] Edge Function validates and stores events in Supabase telemetry_events table
- [ ] Runtime ID is a random UUID not tied to user identity

## Scope Boundaries

**Included:** Opt-in toggle, TelemetryEvent type, local batch queue, 5-minute flush, telemetry-ingest Edge Function, usage ledger hook, personalized benchmarks endpoint

**Excluded:**
- Telemetry dashboard UI (use Supabase Studio for V1)
- A/B testing framework (future iteration on top of telemetry)
- Real-time streaming (batch only)
- Telemetry for UI interactions (product analytics — use PostHog or similar if needed)
- Retroactive telemetry for historical data

## References

- Depends on: [`supabase-cloud-backend`](supabase-cloud-backend.md) — Edge Functions, Supabase tables
- Depends on: [`local-license-manager`](local-license-manager.md) — edition context for opt-in eligibility
- Related: [`transactional-email-flows`](transactional-email-flows.md) — quarterly report uses telemetry aggregates
- Related: [`upgrade-conversion-instrumentation`](upgrade-conversion-instrumentation.md) — separate funnel tracking system
- Architecture: Usage ledger at `src/lib/data/usage.ts`; instrumentation at `src/instrumentation.ts`
