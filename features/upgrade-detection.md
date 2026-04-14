---
title: Upstream Upgrade Detection & Badge
status: in-progress
priority: P1
milestone: post-mvp
source: features/architect-report.md
dependencies: [instance-bootstrap, scheduled-prompt-loops]
---

# Upstream Upgrade Detection & Badge

## Description

Stagent clones diverge from `origin/main` as users customize them via chat. Without visibility into upstream progress, users miss upstream bug fixes and new features. This feature adds background polling that runs `git fetch origin main` every hour, compares `origin/main` HEAD to the local `main` HEAD, and surfaces an "Upgrade Available" badge in the sidebar when commits are pending.

The polling uses the existing scheduler engine (registered as a scheduled task via the same NLP parser behind user-facing schedules) — no new polling infrastructure. It uses `git fetch` locally rather than the GitHub REST API, sidestepping rate limits and authentication entirely. Poll results are cached in `settings.instance.upgrade` (JSON-in-TEXT), and the sidebar badge is a Server Component that reads that state directly per TDR-004.

This is the detection half of the self-upgrade flow. The actual upgrade session — merge execution, conflict resolution, dev-server restart — is delivered by the `upgrade-session` feature. This feature only answers the question "is there an upgrade available?"

## User Story

As a stagent end user with a customized clone, I want to see a subtle but clear indicator in the UI when upstream stagent has new commits I could pull in, so that I can decide when to upgrade without having to manually check the GitHub repo.

## Technical Approach

**Polling handler:** new internal endpoint `POST /api/instance/upgrade/check` that:
1. Acquires an advisory lock (`.git/.stagent-upgrade-check.lock` with 5-minute TTL) to prevent concurrent runs
2. Runs `git fetch origin main` via the `git-ops.ts` wrapper from `instance-bootstrap`
3. Gets `origin/main` SHA via `git rev-parse origin/main` and local `main` SHA via `git rev-parse main`
4. Counts commits behind: `git rev-list --count main..origin/main`
5. Updates `settings.instance.upgrade` with `{lastPolledAt, lastUpstreamSha, localMainSha, upgradeAvailable, commitsBehind, pollFailureCount, lastPollError}`
6. On failure: increments `pollFailureCount`, stores error message, does not clear `upgradeAvailable` (sticky state)
7. Skips entirely if an upgrade task is currently in progress (re-reads settings at end of handler)

**Scheduled registration:** extend `src/lib/instance/bootstrap.ts` with `ensureUpgradePollingSchedule()`:
- Idempotent check: if a schedule named `instance-upgrade-check` exists, no-op
- Otherwise creates one via the existing `schedules` table with `spec="every 1 hour"`, parsed via the existing NLP parser (TDR-027)
- The schedule targets the internal upgrade-check endpoint through the existing scheduler executor
- Skipped in dev mode or when `.git` is absent

**Sidebar badge:** `src/components/instance/upgrade-badge.tsx` — Server Component that reads `settings.instance.upgrade.upgradeAvailable` directly from DB and renders a `StatusChip` (blue "info" variant) with commit count. Placed in the sidebar Configure group, near the Settings link. Uses existing design tokens — no new components.

**Status endpoint:** `GET /api/instance/upgrade/status` — thin read-only JSON endpoint returning the full `UpgradeState` for client components that need to poll (e.g., the upgrade modal pre-flight). This is in addition to Server Component reads, which bypass the API per TDR-004.

**Manual force-check endpoint:** `POST /api/instance/upgrade/check` — same handler as the scheduled job, but exposed for the settings UI "Check now" button. Rate-limited to 1 call per 5 minutes using the same lock file.

**Error recovery:** after 3 consecutive poll failures, surface a persistent notification banner "Upgrade check failing — see Settings → Instance". Banner reuses the existing `notifications` table and inbox UI. Users can click "Retry" which resets the failure count and triggers an immediate force-check.

**UX consideration:** the badge must not be alarming — it's informational, not a call to action. Use the neutral/info StatusChip variant, not the warning or error variants. Tooltip: "X upstream commits ready to merge".

## UX Specification

*Contributed by `/frontend-designer` UX Recommendation mode, 2026-04-07. Full rationale in UX session transcript — key specs below.*

**Persona:** Stagent user who customizes via chat; technical but not a git expert; values not losing their work above all else.

**Emotional arc:** Badge = inviting, not alarming. Copy is load-bearing.

**Badge visual hierarchy:** The badge is deliberately *tertiary* in the sidebar — it's information, not a call to action. Placement: above Settings in the Configure group, never as a notification dot on Settings itself (dot indicators historically get missed in sidebar scans).

**Badge states:**
| State | Visual | Behavior |
|---|---|---|
| Hidden (no upgrade) | Not rendered | Zero visual weight |
| Available | `StatusChip variant="info"` with "N commits" text | Tooltip: "N upstream commits ready to merge" |
| Check failing (3+ polls) | `StatusChip variant="warning"` with dot indicator | Tooltip: "Upgrade check failing — click to retry" |
| Manual check in flight | StatusChip with `animate-pulse` | Tooltip: "Checking for upgrades..." |

**Copy direction (load-bearing):**
- Tooltip: "N upstream commits ready to merge" (NOT "Update available" — avoids SaaS patch-release connotation)
- Button label for retry after failure: "Check now" (NOT "Retry" — more actionable)
- Banner after 3 failed polls: "Upgrade check failing — see Settings → Instance" (directs to remediation)

**Accessibility:**
- Badge must be keyboard-reachable via Tab through sidebar; Enter opens pre-flight modal (defined in `upgrade-session`)
- Tooltip exposed via `aria-label` on the StatusChip parent
- Badge state changes must NOT steal focus; parent region uses `aria-live="polite"` for screen reader announcements
- Color contrast passes WCAG AA via existing StatusChip tokens — no new validation needed

**Design metric calibration** (for `/taste`):
- `DESIGN_VARIANCE = 3` (reuses Calm Ops primitives, no new visual language)
- `MOTION_INTENSITY = 3` (subtle `animate-pulse` on in-flight; transition-colors on state changes)
- `VISUAL_DENSITY = 6` (consistent with existing sidebar density)

**No new tokens, no new components.** Uses existing StatusChip variants and sidebar layout.

## Acceptance Criteria

- [ ] `POST /api/instance/upgrade/check` runs `git fetch origin main`, compares SHAs, updates `settings.instance.upgrade` with commits-behind count
- [ ] Handler acquires advisory lock and skips if another check is in progress or if an upgrade task is running
- [ ] Scheduled task `instance-upgrade-check` is created by `ensureUpgradePollingSchedule()` during first boot, idempotently
- [ ] Scheduled task is NOT registered in dev mode or when `.git` is absent
- [ ] Poll failures increment `pollFailureCount` without clearing `upgradeAvailable` (sticky state across transient failures)
- [ ] After 3 consecutive poll failures, a notification banner appears in the inbox with "Retry" action
- [ ] `GET /api/instance/upgrade/status` returns the current `UpgradeState` as JSON
- [ ] Force-check endpoint is rate-limited to 1 call per 5 minutes via lock file TTL
- [ ] `src/components/instance/upgrade-badge.tsx` is a Server Component that reads `settings.instance.upgrade` directly from DB
- [ ] Badge shows only when `upgradeAvailable === true`, displays commits-behind count, uses neutral StatusChip variant
- [ ] Badge is placed in the sidebar Configure group without disrupting existing navigation order
- [ ] Tooltip on badge hover: "X upstream commits ready to merge"
- [ ] Poll handler uses `git-ops.ts` wrapper from `instance-bootstrap` feature, not direct shell invocation
- [ ] Unit tests cover happy path, stale SHA, transient failure, consecutive failure, concurrent lock contention
- [ ] Integration test: end-to-end from scheduled trigger → settings write → badge visibility
- [ ] Badge states visually verified: hidden, available, failing, checking — all match UX Specification table
- [ ] Badge keyboard accessible: Tab reaches it, Enter opens upgrade modal, tooltip announced via aria-label
- [ ] Badge state changes do not steal focus; parent region has `aria-live="polite"`
- [ ] Copy matches UX Specification exactly ("N upstream commits ready to merge", "Check now", etc.)
- [ ] Design metrics verified via `/taste`: DV=3, MI=3, VD=6
- [ ] **Single-clone user test:** verified to work on a clone with `STAGENT_DATA_DIR` unset (default `~/.stagent`) — badge appears, poller runs, no behavioral difference from private-instance case
- [ ] **Dev-mode skip test:** scheduled polling task is NOT registered when `STAGENT_DEV_MODE=true` or `.git/stagent-dev-mode` sentinel is present — verified by checking the `schedules` table after first boot in dev mode
- [ ] Badge component renders correctly when `settings.instance` is missing entirely (dev mode case) — returns null, logs no errors

## Scope Boundaries

**Included:**
- Polling handler endpoint (`/api/instance/upgrade/check` POST)
- Status read endpoint (`/api/instance/upgrade/status` GET)
- Scheduled task registration via existing NLP scheduler
- Sidebar upgrade badge Server Component
- Persistent failure notification after 3 failed polls
- Rate limiting via advisory lock file
- Unit + integration tests

**Excluded:**
- The actual upgrade execution (merge, conflict resolution, restart) — deferred to `upgrade-session`
- Upgrade-assistant agent profile (deferred to `upgrade-session`)
- Settings page "Instance" section UI (deferred to `upgrade-session`)
- Automatic upgrade scheduling (never auto-apply; user must always confirm)
- GitHub REST API integration (explicitly rejected in favor of `git fetch`)
- Push-notification or email alerts about upgrades (out of scope)
- Release notes fetching or display (deferred to a future feature)

## References

- Source: `features/architect-report.md` — Integration Design section, specifically "Polling & License Metering"
- Related features: depends on `instance-bootstrap` (needs `git-ops.ts`, `settings.instance` schema, instance detection); depends on `scheduled-prompt-loops` (needs scheduler engine); unblocks `upgrade-session`
- Design pattern: TDR-004 (Server Components for reads), TDR-027 (natural language scheduling)
- Design system: reuses `StatusChip` from Calm Ops — no new tokens or components
