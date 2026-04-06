---
title: Edition README Update
status: planned
priority: P1
milestone: plg-growth
source: features/roadmap.md
dependencies: []
---

# Edition README Update

## Description

Updates the project README.md with Community vs Premium positioning, establishing the product's edition narrative before any code-level gating ships. This is a content-only change with no code dependencies — it can start immediately in Week 1.

The update adds: a feature comparison table, soft limits table, Premium features list, pricing summary with "Get Premium" link, and framing text for the `npx stagent` first-run message.

## User Story

As a potential user reading the README, I want to understand what Stagent offers for free versus what requires a paid plan, so I can evaluate the product with clear expectations.

As an existing Community user, I want to see what Premium unlocks so I can decide whether the upgrade is worth it.

## Technical Approach

### README Sections to Add

**1. Editions Section** (after existing "Getting Started"):

Header: "Community & Premium Editions"

Framing paragraph: Stagent is free and fully functional as a local-first tool. Premium tiers add cloud sync, expanded limits, and marketplace access for power users and teams.

**2. Feature Comparison Table**:

| Capability | Community | Premium |
|---|---|---|
| Local tasks & workflows | Unlimited | Unlimited |
| Agent profiles | 4 built-in | 13+ (all domains) |
| Human-in-the-loop approval | Full | Full |
| Learned context slots | 50 | 500 - Unlimited |
| Active schedules | 5 | 25 - Unlimited |
| History retention | 30 days | 1 year - Unlimited |
| Cloud sync & backup | - | All tiers |
| Marketplace blueprints | Browse only | Import & publish |
| Priority support | - | Operator & Scale |

**3. Soft Limits Table**:

| Resource | Community Limit | Behavior at Limit |
|---|---|---|
| Learned context memories | 50 | Oldest auto-archived, warning at 37 (75%) |
| Context windows per task | 10 | Graceful stop with summary |
| Active schedules | 5 | New schedule creation disabled |
| Task history | 30 days | Older entries archived, still queryable |

**4. Premium Features Highlight**:
- Cloud sync across machines
- Expanded memory and schedule limits
- Marketplace blueprint import
- Priority support channels
- Team collaboration (Scale tier)

**5. Pricing Summary**:

| Tier | Price | Best For |
|---|---|---|
| Community | Free | Individual developers, evaluation |
| Solo | $19/mo | Power users, expanded limits |
| Operator | $49/mo | Professionals, priority support |
| Scale | $99/mo | Teams, marketplace, unlimited |

"Get Premium" link to pricing page.

**6. First-Run Message Framing**:

Update the `npx stagent` welcome output text to include:
- "Running Stagent Community Edition"
- "Upgrade to Premium for cloud sync, expanded limits, and marketplace access"
- Link to pricing page
- This is a text constant change in the CLI entry point, not a runtime check

### Files Modified

- `README.md` — add Editions, comparison, limits, pricing sections
- `bin/cli.ts` — update first-run welcome message text

## Acceptance Criteria

- [ ] README contains "Community & Premium Editions" section
- [ ] Feature comparison table shows Community vs Premium capabilities
- [ ] Soft limits table documents all 4 resource limits and behavior at limit
- [ ] Premium features highlighted in a concise list
- [ ] Pricing summary table with all 4 tiers and "Get Premium" link
- [ ] First-run CLI message mentions Community Edition and upgrade path
- [ ] All content is accurate and consistent with other feature specs
- [ ] No code dependencies — purely content and text constant changes

## Scope Boundaries

**Included:** README edition sections, feature comparison table, soft limits table, pricing summary, first-run CLI message update

**Excluded:**
- Runtime edition detection (see `local-license-manager`)
- Actual soft limit enforcement (see `community-edition-soft-limits`)
- Full marketing site pricing page (see `marketing-site-pricing-page`)
- Badge or shield images (text-only for V1)

## References

- Consumed by: [`marketing-site-pricing-page`](marketing-site-pricing-page.md) — pricing page expands on README content
- Related: [`community-edition-soft-limits`](community-edition-soft-limits.md) — implements the limits documented here
- Related: [`local-license-manager`](local-license-manager.md) — implements edition detection
- Architecture: CLI entry at `bin/cli.ts`; README at project root
