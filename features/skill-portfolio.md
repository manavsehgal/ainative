---
title: Skill Portfolio
status: completed
priority: P2
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [environment-cache]
---

# Skill Portfolio

## Description

Unified skill catalog that aggregates every skill across all projects and tools into a single searchable, filterable portfolio. Skills are the atomic unit of AI capability in Claude Code and Codex — but today they're scattered across `~/.claude/skills/`, `~/.codex/skills/`, project `.claude/skills/`, vendor imports, and plugins. The portfolio brings them all together.

Key capabilities: drift detection (same skill diverged between tools or projects), usage analytics (tied to Stagent's usage_ledger), install/uninstall across projects, and side-by-side skill diffs.

## User Story

As a power user with skills spread across multiple projects and two CLI tools, I want a single catalog showing every skill I have — where it lives, whether versions have drifted, and how often each skill gets used — so I can maintain consistency and make informed decisions about which skills to keep, update, or deprecate.

## Technical Approach

### Skill Aggregation

**`src/lib/environment/skill-portfolio.ts`**:
- **`aggregateSkills(scans[])`** — Queries all environment_artifacts where category="skill" across all scans, groups by name, and identifies: unique skills, skills shared across tools (Claude + Codex), skills shared across projects, and orphan skills (exist in one place only).
- **`detectDrift(skillName)`** — For skills with the same name in multiple locations, compares content hashes. Returns drift status: "synced" (identical), "drifted" (different), "one-sided" (exists only in one tool/project).
- **`getSkillUsage(skillName, dateRange?)`** — Joins with `usage_ledger` to find tasks that used this skill. Correlates via agent profile (profiles reference skills) and task execution logs.
- **`installSkill(skillName, sourceLocation, targetProjectId, targetTool)`** — Copies skill to target via sync engine.
- **`uninstallSkill(skillName, projectId, tool)`** — Removes skill file with checkpoint safety.

### Portfolio Page

**`src/app/environment/skills/page.tsx`** — Dedicated skill portfolio page, separate from the main environment dashboard.

### UI Components

- **`skill-catalog.tsx`** — Searchable grid of all skills. Each card shows: name, description (from SKILL.md frontmatter), locations (badges for each project/tool where it exists), drift indicator, usage count. Sortable by name, usage, last modified.
- **`skill-drift-indicator.tsx`** — Visual indicator: green checkmark (synced), yellow warning (drifted), gray dash (one-sided). Tooltip shows which locations differ.
- **`skill-usage-chart.tsx`** — Small sparkline or bar chart showing skill usage over the last 30 days. Ties to `usage_ledger` data.
- **`skill-diff-view.tsx`** — Side-by-side content comparison of the same skill from two different locations (e.g., Claude Code project vs Codex global). Highlights differences.
- **`skill-install-dialog.tsx`** — "Install to project" dialog: select target project + tool, preview the write, execute via sync engine.

### Integration with Existing Profiles

Skills referenced in agent profiles (`src/lib/agents/profiles/`) get special treatment: the portfolio shows which profiles use each skill, creating a dependency map.

## Acceptance Criteria

- [ ] Portfolio aggregates all skills across all scans into a unified list
- [ ] Skills are grouped by name with location badges showing where each instance lives
- [ ] Drift detection correctly identifies synced, drifted, and one-sided skills
- [ ] Usage analytics show how often each skill is used (via usage_ledger correlation)
- [ ] Search works across skill names and descriptions
- [ ] Skill diff view shows side-by-side content for drifted skills
- [ ] Install dialog allows copying a skill to another project/tool via sync engine
- [ ] Uninstall removes skill with checkpoint safety
- [ ] Portfolio page is accessible from environment navigation

## Scope Boundaries

**Included:**
- Unified skill catalog across all projects and tools
- Drift detection between locations
- Usage analytics via usage_ledger
- Install/uninstall with sync engine
- Side-by-side diff for drifted skills

**Excluded:**
- Skill editing (create/modify skill content — that's a skill-creator concern)
- Skill versioning history (only current state, no time-travel)
- Skill dependency analysis (what a skill depends on internally)
- Automatic drift resolution (user must manually choose which version to keep)

## References

- Source: environment onboarding plan — Feature 9
- Data source: environment_artifacts (category="skill") + usage_ledger tables
- Pattern: `src/lib/agents/profiles/registry.ts` — profile-skill relationship
- Related features: environment-sync-engine (handles install/uninstall), cross-project-comparison (broader view)
