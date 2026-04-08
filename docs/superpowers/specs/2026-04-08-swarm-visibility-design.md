# Spec C — Swarm Visibility

**Status:** Approved
**Created:** 2026-04-08
**Scope mode:** REDUCE
**Related:** [Schedule Orchestration (Spec A)](./2026-04-08-schedule-orchestration-design.md), [Chat SSE Resilience Hotfix (Spec B)](./2026-04-08-chat-sse-resilience-hotfix-design.md)

## Context

Spec A introduces a global concurrency cap on scheduled agents. Power users running many schedules will observe queueing delays that they previously did not. Without a visible signal for "how busy is the swarm right now," they'll experience unexplained schedule lateness and file tickets.

This spec adds minimal, always-visible swarm-load signal to the app chrome, a saturation-only pre-chat banner, and small enhancements to the schedule list. It is deliberately small — REDUCE mode — to avoid overbuilding visibility infrastructure before we know what users actually need.

## Goals

1. Give users a passive, always-visible signal of swarm load state (quiet / working / saturated).
2. Warn users *before* they send a chat message if the swarm is at capacity and their chat will queue behind running agents.
3. Make the new concurrency-driven queueing visible on the schedule list.
4. Rename "turns" to "agent steps" everywhere user-facing, to close the semantic gap between prompt-level "MAX N turns" hints and runtime-counted turns.

## Non-goals (NOT in scope)

- **Activity feed route** (`/swarm/activity`) with event log, filters, pagination — future spec "Swarm Activity Feed"
- **`swarm_snapshots` time-series table** — future spec "Swarm Activity Feed"
- **Proactive push notifications for overload** — the indicator is always visible, no push needed
- **Bulk "pause all schedules" action** — users can pause individual schedules from existing pages
- **Efficiency scoring rings** / turn drift detection alerts — future spec "Schedule Observability"
- **New `busyness` StatusChip family** — rejected by design review; use custom primitive
- **Pre-chat banner in `working` state** — only render in `saturated` state to avoid anxiety copy
- **Traffic-light turn-budget badge** (`lastTurnCount / maxTurns` with color gradient) — leaks policy as warning on normal operation
- **Popover / Sheet for running schedules list** — hover tooltip + deep link to existing route is sufficient

## Design

### C.1 `GET /api/swarm-status` endpoint

New route at `src/app/api/swarm-status/route.ts`. Reads:

- `getAllExecutions()` from `src/lib/agents/execution-manager.ts:60` — filters to `sourceType === 'scheduled'` for running count and schedule metadata
- A count query on `tasks` table for `status='queued' AND source_type='scheduled'` — queued count
- `activeChatStreams.size` from Spec A's `src/lib/chat/active-streams.ts`

**Response shape:**

```json
{
  "runningScheduled": [
    {
      "scheduleId": "abc",
      "name": "Portfolio Coach",
      "startedAt": "2026-04-08T21:00:03Z",
      "elapsedSec": 42,
      "maxTurns": 500,
      "currentTurns": 127
    }
  ],
  "queuedScheduled": [
    { "scheduleId": "def", "name": "News Sentinel", "queuedAt": "2026-04-08T21:00:14Z", "position": 1 }
  ],
  "chatStreamsActive": 0,
  "loadState": "working"
}
```

`loadState` is computed server-side:
- `quiet` — `runningScheduled.length === 0`
- `working` — `runningScheduled.length >= 1 && queuedScheduled.length === 0`
- `saturated` — `queuedScheduled.length > 0` (at-or-above cap)

No new DB state — the endpoint reads from in-memory execution map + one SQL count.

### C.2 `<SwarmLoadIndicator />` component

**Placement:** top of `<SidebarContent>` in `src/components/shared/app-sidebar.tsx`, above the first NavGroup. Not the footer — per design review, the footer is already dense (UpgradeBadge, WorkspaceIndicator, AuthStatusDot, TrustTierBadge, theme toggle) and the sidebar-as-chrome pattern means aggregate system state belongs at the top, where nav groups live.

**Visual:** custom primitive (NOT a StatusChip family — semantic mismatch; StatusChip is "one entity, one state", swarm load is "aggregate cardinality"). Reuses badge tokens and the pulse animation pattern but renders as a thin one-line row.

**Three states** (not four — red is reserved for actual failures, not backpressure):

| State | Condition | Token | Label |
|---|---|---|---|
| Quiet | `loadState === 'quiet'` | `text-muted-foreground` | `Swarm quiet` |
| Working | `loadState === 'working'` | `text-status-running` (indigo, pulse) | `● 2 running` |
| Saturated | `loadState === 'saturated'` | `text-status-warning` (amber, pulse) | `● 3 running · 1 queued` |

**Hover tooltip:** lists up to 3 running schedules inline with elapsed time. Delivers ~80% of the "activity feed" value with zero new overlay state:

```
Swarm · 2 running
─────────────────
• portfolio-coach    2m
• launch-copy-chief  41s
```

If there are more than 3 running, append `• +N more`.

**Click behavior:** the indicator is a `<Link>` to `/schedules?status=running` — deep-link to the existing schedules page with a filter. No popover, no sheet, no new overlay pattern.

**Polling:** every 8s via new `usePolling(url, intervalMs)` hook (C.5). Shared state is used by both the indicator and the pre-chat banner so there is no double-fetch.

**Accessibility:** `aria-live="polite"`, tooltip keyboard-focusable, text contrast meets Calm Ops baseline.

### C.3 `<ChatOverloadBanner />` component

**Placement:** above `<ChatInput />` in `src/components/chat/chat-shell.tsx`.

**Render condition:** ONLY when `loadState === 'saturated'` (queue depth > 0). Not `working`. Anxiety copy on normal operation violates Calm Ops tone — "responses may be slower" with zero agency tells users a bad thing might happen and gives them no action.

**Visual:** surface-2 bordered banner, `rounded-lg`, amber accent matching the indicator's saturated state.

**Copy:** `"Swarm at capacity — your chat will queue behind {N} running agents."` where N is `runningScheduled.length`. One action: `[View Activity]` links to `/schedules?status=running`.

**Dismissal:** per conversation, stored in `sessionStorage` keyed by conversation ID. Re-appears if load state flips back to `saturated` after being `working`.

### C.4 Schedule list row enhancements

Modify `src/components/schedules/schedule-list.tsx` (or equivalent):

1. **Queue-depth badge (PR2a):** if a schedule has queued firings waiting for a slot, render `+{N} queued` as an `outline` Badge next to the schedule name. Almost free — reuses existing badge component. Addresses the power-user scenario where 10 schedules fire in a 5-min window and #4-10 queue silently.

2. **"Near turn cap" outline badge:** rendered ONLY when `lastTurnCount / maxTurns >= 0.9`. No traffic-light gradient. Progressive disclosure — normal operation shows nothing. At ≥90%, shows a subtle outline badge: `Near step cap`.

### C.5 `usePolling(url, intervalMs)` shared hook

New file `src/hooks/use-polling.ts`. Extracted from the pattern at `src/components/notifications/inbox-list.tsx:40-43`. Signature:

```typescript
export function usePolling<T>(url: string, intervalMs: number): {
  data: T | null;
  error: Error | null;
  loading: boolean;
};
```

Fetches on mount, re-fetches every `intervalMs`. Handles unmount cleanup. Stable query key (URL) so multiple consumers of the same URL share state via module-level cache.

Used by: `<SwarmLoadIndicator />`, `<ChatOverloadBanner />`. Can be adopted by other components (inbox list, schedule detail sheet) in future cleanups.

### C.6 UI rename: "turns" → "agent steps"

User-facing strings only. Keep `maxTurns` as the code/API identifier.

- `schedule-form.tsx` field label: "Max turns per firing" → "Max agent steps per run"
- Tooltip on field: "One step = one agent action (message, tool call, or sub-response). Most schedules use 50–500 steps; heavy research runs 2,000+."
- Tooltip on prompt field: "Note: writing 'MAX N turns' in your prompt is a hint to the model, not a runtime limit. Use Max agent steps below to enforce a budget."
- Inline calibration hint after prompt entry: "Schedules like this average ~{N} steps" (derived from `avgTurnsPerFiring` on similar schedules).
- Schedule list "Near step cap" badge (C.4)
- Notifications: "Schedule X used 812 / 800 agent steps" (formerly "turns")

## Calm Ops compliance checklist

- [x] No backdrop-filter, rgba, glass, gradient
- [x] Running state uses `status-running` (indigo), NOT green (green is `status-completed`)
- [x] Saturated state uses `status-warning` (amber), NOT red (red is `status-failed`)
- [x] No new StatusChip family added (use custom `SwarmLoadIndicator`)
- [x] No popover/sheet overlay — tooltip + deep link only
- [x] Banner only renders when actionable (saturated state), not `working`
- [x] All radii ≤ `rounded-xl`
- [x] Polling pattern reuses existing template (`inbox-list.tsx`)
- [x] Any Sheet usage (N/A here) would need `px-6 pb-6` body padding

## Tests

### Unit / component
1. `<SwarmLoadIndicator />` renders correct state (Quiet / Working / Saturated) for each input
2. Tooltip shows running schedules; click navigates to `/schedules?status=running`
3. `<ChatOverloadBanner />` renders ONLY in `saturated` state
4. Dismissal persists in sessionStorage across re-mounts
5. Queue-depth badge renders when schedule has queued firings
6. "Near step cap" badge renders only at ≥90% ratio
7. `usePolling` hook fetches on mount, re-fetches on interval, cleans up on unmount
8. Multiple consumers of same URL share state (no duplicate fetches)

### API
9. `GET /api/swarm-status` returns correct shape with running/queued/chat counts
10. `loadState` computed correctly at boundary conditions (0 running, cap-1 running, cap running, queue>0)

### Accessibility
11. Indicator has `aria-live="polite"`
12. Tooltip is keyboard-focusable
13. Contrast meets Calm Ops baseline (manual check)

### Visual regression
14. Screenshot sidebar in all 3 states; compare to Calm Ops tokens

## Files touched

### New
- `src/app/api/swarm-status/route.ts`
- `src/hooks/use-polling.ts`
- `src/components/shared/swarm-load-indicator.tsx`
- `src/components/chat/chat-overload-banner.tsx`

### Modify
- `src/components/shared/app-sidebar.tsx` — mount `<SwarmLoadIndicator />` at top of SidebarContent
- `src/components/chat/chat-shell.tsx` — mount `<ChatOverloadBanner />` above ChatInput
- `src/components/schedules/schedule-list.tsx` (or equivalent) — queue-depth badge + near-cap badge
- `src/components/schedules/schedule-form.tsx` — rename + tooltips + calibration hint

### Not modified (avoiding pollution)
- `src/lib/constants/status-families.ts` — NO new `busyness` family per design review

## Dependencies on Spec A

- `<SwarmLoadIndicator />` reads `chatStreamsActive` from the in-memory `activeChatStreams` set created by Spec A (`src/lib/chat/active-streams.ts`). C can scaffold mid-A after A's interface is pinned.
- Queue-depth badge reads `tasks.status='queued' AND source_type='scheduled'` which exists today but is populated meaningfully only after Spec A's concurrency limiter lands.
- "Near step cap" badge reads `schedules.max_turns` column added by Spec A.

## Ship plan

- No feature flag — UI is additive and safe.
- Scaffolding (API endpoint, hook, indicator component) can begin mid-A.
- Full ship after Spec A stabilizes and A's data-model migrations have landed.
