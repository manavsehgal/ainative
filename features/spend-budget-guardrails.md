---
title: Spend Budget Guardrails
status: completed
priority: P1
milestone: post-mvp
source: features/usage-metering-ledger.md, features/inbox-notifications.md, user request 2026-03-12
dependencies: [usage-metering-ledger, inbox-notifications, provider-runtime-abstraction]
---

# Spend Budget Guardrails

## Description

Once ainative can meter usage reliably, the next operational requirement is governance: users need a way to say how much Claude- and Codex-backed work is allowed to cost before ainative stops launching more paid activity. Without that control, provider expansion increases operator anxiety and makes automation harder to trust.

This feature adds budget guardrails to Settings and enforces them across every provider entry point. Users can define optional daily and monthly overall spend caps, plus runtime-scoped spend caps with optional advanced token ceilings. ainative warns as usage approaches a limit, hard-stops new provider-calling work after a limit is exceeded, and records the reason explicitly rather than silently queueing or retrying blocked activity.

## User Story

As a ainative operator, I want configurable daily and monthly usage budgets so that I can let agents run autonomously up to a defined limit without risking uncontrolled Claude or Codex spend.

## Technical Approach

- Add a `Cost & Usage` section to Settings for budget configuration. Store budget policy in `settings` as structured JSON validated with Zod rather than proliferating untyped ad hoc keys.
- Initial budget model:
  - overall daily spend cap
  - overall monthly spend cap
  - per-runtime/provider daily spend cap
  - per-runtime/provider monthly spend cap
  - optional advanced per-runtime/provider daily token cap
  - optional advanced per-runtime/provider monthly token cap
- Use the usage ledger as the source of truth for current-window totals. Budget windows should be evaluated using ainative's local runtime timezone so reset behavior matches the machine the app is running on.
- Add a budget evaluation service that runs before every provider call starts:
  - task execute
  - task resume
  - workflow child-task launch
  - schedule firing
  - task assist
  - profile test
- Warning behavior:
  - emit an Inbox notification when a configured budget first crosses 80% usage in the active day or month window
  - avoid duplicate warning spam by tracking whether the current window has already notified
- Enforcement behavior:
  - allow already-running work to finish even if it pushes totals over a limit
  - block new provider-calling activity once the relevant limit has been exceeded
  - return an explicit operator-facing error and create an Inbox notification describing which budget was exceeded and when it resets
  - do not silently queue blocked work for later automatic replay
- Record blocked attempts in the usage/governance trail with zero incremental cost so audit views can explain why an activity never started.
- Surface current blocked state in Settings and expose the next reset point for daily and monthly windows.

## Acceptance Criteria

- [x] Settings supports optional daily/monthly overall spend caps plus daily/monthly provider spend and provider token caps
- [x] Budget inputs are validated, persist correctly, and can be cleared back to unlimited state
- [x] Usage totals are computed from the normalized usage ledger rather than provider log parsing
- [x] An Inbox notification is created when a configured budget first crosses 80% usage in the active window
- [x] New Claude- or Codex-backed activity is blocked after a relevant budget limit is exceeded
- [x] In-flight runs are allowed to finish; enforcement only blocks subsequent provider calls
- [x] Task execute, resume, workflow launches, schedule firings, task assist, and profile tests all share the same budget preflight guard
- [x] Blocked actions fail with explicit messaging and do not silently auto-queue until the next budget window
- [x] Operators can see current blocked/unblocked status plus reset timing in Settings

## Implementation Notes

- Added structured budget-policy storage under `settings` with Zod validation for overall daily/monthly spend caps and runtime-scoped spend/token caps
- Added a shared budget-guardrail service that aggregates current daily/monthly usage from the normalized usage ledger using the local ainative runtime timezone
- Warning notifications are deduplicated per budget window, while blocked attempts create explicit Inbox alerts and zero-cost `usage_ledger` rows with `blocked` status
- Task execute/resume routes now preflight budgets for immediate operator feedback, and the shared runtime layer also guards workflows, schedules, task assist, and profile tests
- Settings now includes a dense `Cost & Usage Guardrails` section showing spend-first editable caps, derived token guidance from recent blended pricing, advanced token overrides, live health states, and next reset timestamps for each active window
- **SDK audit (2026-03-15)**: Added per-execution `maxBudgetUsd` passed directly to `query()` options via `DEFAULT_MAX_BUDGET_USD` constant, providing an SDK-level cost brake in addition to pre-execution budget checks (F4). Added default `maxTurns` on task execution with per-profile override to prevent unbounded agent turns (F9). See [sdk-runtime-hardening](sdk-runtime-hardening.md)

## Verification

- Verified with the full Vitest suite (`173` passing tests) on March 12, 2026
- Verified with a successful production build on March 12, 2026

## Scope Boundaries

**Included:**
- Budget policy storage and validation
- Settings UI for budget configuration
- Warning notifications and hard-stop enforcement for new provider activity
- Shared guard service applied to all provider entry points
- Audit visibility for blocked attempts

**Excluded:**
- Mid-run cancellation when a limit is crossed
- Auto-resuming blocked work after the next reset window
- Email, SMS, or external alerting
- Cost optimization recommendations or automatic provider switching
- Overall cross-provider token caps

## References

- Depends on: [usage-metering-ledger](usage-metering-ledger.md)
- Related features: [inbox-notifications](inbox-notifications.md), [provider-runtime-abstraction](provider-runtime-abstraction.md), [scheduled-prompt-loops](scheduled-prompt-loops.md)
- Follow-on feature: [cost-and-usage-dashboard](cost-and-usage-dashboard.md)
