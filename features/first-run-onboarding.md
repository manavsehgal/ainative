---
title: First-Run Onboarding
status: completed
priority: P1
milestone: plg-growth
source: features/roadmap.md
dependencies: [local-license-manager, supabase-cloud-backend]
---

# First-Run Onboarding

> **Superseded by `community-edition-simplification` (2026-04-13).** This feature shipped but was later fully reverted when ainative pivoted to a 100% free Community Edition with no tiers, billing, or cloud dependency. Kept as historical record.

## Description

Enhances the first-run experience with two complementary components: an email capture card and an activation checklist. Together they convert anonymous npx users into known leads while guiding them through the product's core value loop.

**Email capture** renders as an inline card above WelcomeLanding on the first visit when the user has 0 tasks. It is non-blocking — "No thanks" sets a `localStorage` flag and the card never reappears. Submission calls Supabase Auth `signUp()` to send a magic link, establishing the user's cloud identity for future sync and billing flows.

**Activation checklist** tracks 6 milestones that map to the product's core value loop. It appears in the Dashboard right panel as a `detailPane` prop, with progress visualized via a DonutRing chart component. All progress is server-computed from existing DB data (no new tables required). The checklist disappears permanently once all 6 milestones are complete.

## User Story

As a first-time user, I want a frictionless way to provide my email so I can receive product updates and unlock cloud features later, without being blocked from using the product immediately.

As a new user, I want a clear checklist of what to try next so I can quickly discover the product's core capabilities and feel a sense of progress.

## Technical Approach

### Email Capture Card

**`src/components/onboarding/email-capture-card.tsx`**:
- Renders above WelcomeLanding when `tasks.length === 0` and `localStorage.getItem('onboarding-email-dismissed')` is falsy
- Single email input + "Get Started" button + "No thanks" dismiss link
- On submit: `POST /api/onboarding/email` with `{ email }`
- API route calls Supabase Auth `signUp({ email })` for magic link flow
- On success: shows confirmation message ("Check your email"), sets `localStorage` flag
- On dismiss: sets `localStorage('onboarding-email-dismissed', 'true')`, card unmounts
- Never reappears after either action

**`POST /api/onboarding/email`**:
- Validates email format (Zod)
- Calls Supabase `auth.signUp({ email, options: { emailRedirectTo } })`
- Returns 200 on success, 400 on validation error, 502 on Supabase error
- Fire-and-forget — does not block any local functionality

### Activation Checklist

**6 Milestones** (server-computed from existing DB tables):

| # | Milestone | Query |
|---|---|---|
| 1 | Create a task | `SELECT COUNT(*) FROM tasks` > 0 |
| 2 | Run a task to completion | `SELECT COUNT(*) FROM tasks WHERE status = 'completed'` > 0 |
| 3 | Create a project | `SELECT COUNT(*) FROM projects` > 0 |
| 4 | Schedule a workflow | `SELECT COUNT(*) FROM schedules` > 0 |
| 5 | Run 3 tasks | `SELECT COUNT(*) FROM tasks WHERE status = 'completed'` >= 3 |
| 6 | Configure a budget | `SELECT COUNT(*) FROM settings WHERE key = 'budget_config'` > 0 |

**`GET /api/onboarding/progress`**:
- Runs all 6 queries in a single transaction
- Returns `{ milestones: { id, label, completed }[], completedCount: number, totalCount: 6 }`
- Called by dashboard on mount

**`src/components/onboarding/activation-checklist.tsx`**:
- Receives milestone data from dashboard page (Server Component query)
- Renders as a card in the Dashboard right panel via `detailPane` prop
- DonutRing SVG component shows `completedCount / 6` as a ring chart
- Each milestone: checkbox icon (filled/empty) + label
- Completed milestones show green check, pending show empty circle
- When all 6 complete: card shows celebration state, then disappears on next visit

**`src/components/onboarding/donut-ring.tsx`**:
- Pure SVG donut ring chart
- Props: `completed: number`, `total: number`, `size?: number`
- Animates on mount with CSS transition on `stroke-dashoffset`
- Uses OKLCH accent color for filled segment

### Integration Points

- `src/app/page.tsx`: conditionally renders email capture card above WelcomeLanding
- `src/app/page.tsx`: passes activation checklist as `detailPane` to PageShell when not all milestones complete
- No new database tables — all progress derived from existing tables

## Acceptance Criteria

- [ ] Email capture card appears on first visit with 0 tasks
- [ ] Email submission calls Supabase Auth signUp() for magic link
- [ ] "No thanks" dismisses card permanently via localStorage
- [ ] Card never reappears after email submission or dismissal
- [ ] Activation checklist shows 6 milestones with completion state
- [ ] Progress computed server-side from existing DB tables (no new tables)
- [ ] DonutRing chart visualizes completion progress
- [ ] Checklist renders in Dashboard right panel as detailPane
- [ ] Checklist disappears permanently when all 6 milestones complete
- [ ] API route validates email and handles Supabase errors gracefully

## Scope Boundaries

**Included:** Email capture card, magic link signup, localStorage dismissal, 6-milestone activation checklist, DonutRing chart, server-computed progress, dashboard integration

**Excluded:**
- Email verification enforcement (magic link is optional, product works without it)
- Onboarding wizard or multi-step flow (single card + checklist is sufficient)
- Custom milestone configuration (fixed set of 6)
- Gamification beyond the checklist (no points, badges, or streaks)

## References

- Depends on: [`local-license-manager`](local-license-manager.md) — edition context for feature gating
- Depends on: [`supabase-cloud-backend`](supabase-cloud-backend.md) — Supabase Auth for signUp()
- Related: [`upgrade-cta-banners`](upgrade-cta-banners.md) — banners appear after onboarding
- Architecture: Dashboard at `src/app/page.tsx`; PageShell detailPane pattern
