---
title: Environment Health Scoring
status: planned
priority: P3
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [environment-cache]
---

# Environment Health Scoring

## Description

Score each project's CLI environment against best practices derived from the Claude Agent SDK documentation and Anthropic's effective-agents reference. The health score gamifies environment quality — instead of reading docs about "you should have hooks," Stagent tells you specifically what's missing and offers one-click fixes.

Scores are computed from 4 dimensions (Instructions, Safety, Capability, Maintenance), each weighted 25%. Per-project scores enable cross-project health comparison and workspace-wide health averages. Trend tracking uses scan history to show improvement over time.

## User Story

As a developer managing multiple projects, I want each project to have a health score showing how well-configured its AI environment is, with actionable recommendations for what to improve, so I can proactively strengthen my setup rather than discovering gaps during agent failures.

## Technical Approach

### Scoring Engine

**`src/lib/environment/health-scorer.ts`**:

Score computed from latest scan artifacts. Each dimension checks for artifact presence, quality, and completeness:

**Instructions (25%):**
- Has CLAUDE.md or AGENTS.md? (+30 points)
- Has both? (+20 points)
- Instructions length > 100 chars? (+15 points)
- Has rules/*.md files? (+15 points)
- Has MEMORY.md? (+10 points)
- Has CLAUDE.local.md? (+10 points)

**Safety (25%):**
- Has hooks defined? (+30 points)
- Has permission rules in settings.local.json? (+25 points)
- Number of permission rules > 10? (+15 points)
- Has budget configured (from settings table)? (+15 points)
- Has output-styles configured? (+15 points)

**Capability (25%):**
- Has skills? (+20 points)
- Number of skills > 5? (+15 points)
- Has MCP servers configured? (+25 points)
- Has agent profiles? (+15 points)
- Has plugins enabled? (+15 points)
- Has reference documentation? (+10 points)

**Maintenance (25%):**
- Memory updated in last 30 days? (+25 points)
- Skills modified in last 60 days? (+25 points)
- No orphan artifacts (referenced but missing)? (+25 points)
- Scan within last 7 days? (+25 points)

Each dimension scores 0-100, final score is weighted average. Letter grades: A (90+), B (75-89), C (60-74), D (40-59), F (<40).

### Recommendations

**`src/lib/environment/health-recommendations.ts`**:
- Maps each failed check to an actionable recommendation
- Recommendations are prioritized by impact (safety > instructions > capability > maintenance)
- Each recommendation has: title, description, priority, and optional quick-fix action (e.g., "Create CLAUDE.md" → opens a template editor)
- Limit to top 5 recommendations to avoid overwhelm

### Health Page

**`src/app/environment/health/page.tsx`** — Dedicated health overview showing:
- Workspace average score across all projects
- Per-project score cards (sortable, filterable)
- Trend chart (if multiple scans exist over time)
- Top recommendations across all projects

### UI Components

- **`health-score-card.tsx`** — Circular progress display with score, letter grade, and dimension breakdown bars. Colored by grade (green A/B, yellow C, red D/F).
- **`health-recommendations-list.tsx`** — Prioritized list of actionable items with fix buttons. Each recommendation has an icon, description, and one-click action.
- **`health-trend-chart.tsx`** — Line chart showing score over time (from scan history). Simple, sparkline-style.
- **`workspace-health-summary.tsx`** — Top-of-page card showing workspace average, number of projects needing attention, and overall trend.

## Acceptance Criteria

- [ ] Health score computed from 4 dimensions with correct weighting
- [ ] Each dimension checks map to specific artifact presence/quality criteria
- [ ] Score is 0-100 with letter grades (A/B/C/D/F)
- [ ] Recommendations are generated for each failed check
- [ ] Recommendations are prioritized by impact
- [ ] Top 5 recommendations shown per project
- [ ] Health page shows workspace-wide average and per-project breakdown
- [ ] Score cards use appropriate color coding (green/yellow/red)
- [ ] Trend tracking works when multiple scans exist over time
- [ ] Quick-fix actions work for basic recommendations (create CLAUDE.md, etc.)

## Scope Boundaries

**Included:**
- 4-dimension health scoring engine
- Actionable recommendations with quick fixes
- Per-project and workspace-wide scores
- Trend tracking via scan history
- Health page with visualizations

**Excluded:**
- Custom scoring rules (user-defined checks)
- Compliance reporting or audit trails
- Automated fixes without user confirmation
- External benchmark comparison ("compared to other teams")

## References

- Source: environment onboarding plan — Feature 10
- Reference: `.claude/reference/platform-claude-com-agent-sdk/` — best practices source
- Reference: `.claude/reference/anthropic-engineering-building-effective-agents/` — agent patterns
- Related features: cross-project-comparison (health column in matrix), project-onboarding-flow (health shown in adoption prompts)
