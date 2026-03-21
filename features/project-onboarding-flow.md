---
title: Project Onboarding Flow
status: planned
priority: P2
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [environment-dashboard]
---

# Project Onboarding Flow

## Description

The end-to-end onboarding experience that makes Stagent's environment features discoverable and easy to adopt. This includes auto-detection on project creation, "scan this folder" CTAs on existing projects, and progressive adoption prompts that guide users from visibility to sync to orchestration.

Rather than a separate wizard or modal, onboarding is woven into the existing project and dashboard flows — the live dashboard IS the onboarding experience. This feature adds the connective tissue: triggers, prompts, and guidance that make the environment features feel effortless.

## User Story

As a new Stagent user who just pointed it at my existing Claude Code project, I want to immediately see what Stagent found in my environment — without navigating to a separate page or completing a setup wizard — so I can understand Stagent's value within seconds.

## Technical Approach

### Auto-detect on Project Creation

When a user creates a new project with a `workingDirectory` in the project creation form:

1. After project creation succeeds, automatically trigger an environment scan for that directory
2. Show an inline summary card on the project detail page: "Found 20 skills, 3 MCP servers, 152 permissions across Claude Code and Codex"
3. Include a "View Environment →" link to the `/environment` dashboard
4. If no CLI artifacts found, show nothing (don't confuse non-CLI users)

**Implementation:** Add scan trigger to `POST /api/projects` response handler or to the project detail Server Component. Add `environment-summary-card.tsx` component.

### Existing Project CTAs

On the Projects list page (`/projects`):
- Projects with a `workingDirectory` but no environment scan show a subtle badge: "Environment not scanned"
- Clicking the badge triggers a scan and navigates to `/environment`

On the Environment page with no project context:
- Show a project picker or "Select a project to scan its environment"
- List all projects with `workingDirectory` set

### Progressive Adoption Prompts

Integrated with existing adoption tracking (`src/lib/docs/adoption.ts`):

- **Stage 1 — Visibility** (after first scan): "You have 20 skills across Claude Code and Codex. Explore them in the Environment dashboard."
- **Stage 2 — Sync** (after viewing dashboard): "3 skills exist in Claude Code but not Codex. Want to sync them?" (only shown if persona is "both")
- **Stage 3 — Orchestration** (after first sync): "Create a workflow that uses your code-review skill for automated PR reviews."

Prompts appear as dismissible banners on the dashboard and project pages. Dismissed state stored in settings table.

### Components

- **`src/components/environment/environment-summary-card.tsx`** — Compact card showing scan summary (persona badge, top artifact counts, "View Environment" link). Used on project detail page.
- **`src/components/environment/adoption-prompt.tsx`** — Dismissible banner with stage-appropriate message and CTA button
- **`src/components/environment/project-scan-badge.tsx`** — Small badge for project list showing scan status

### Adoption Tracking Integration

Extend `src/lib/docs/adoption.ts` or create `src/lib/environment/adoption.ts`:
- Track environment adoption stages: "none" → "scanned" → "viewed" → "synced" → "orchestrating"
- Stage transitions trigger appropriate prompts
- Adoption state persisted in settings table

## Acceptance Criteria

- [ ] New project with workingDirectory auto-triggers environment scan
- [ ] Environment summary card appears on project detail page after scan
- [ ] Summary card shows persona, artifact counts, and link to environment dashboard
- [ ] No CLI artifacts → no summary card (graceful absence)
- [ ] Projects list shows "not scanned" badge for projects with workingDirectory but no scan
- [ ] Environment page shows project picker when no project context
- [ ] Progressive adoption prompts appear at appropriate stages
- [ ] Prompts are dismissible and dismissal persists
- [ ] Prompt copy adapts to persona (sync prompt only shown for "both")

## Scope Boundaries

**Included:**
- Auto-scan on project creation
- Summary card on project detail
- Progressive adoption prompts (3 stages)
- Project scan status badges
- Adoption stage tracking

**Excluded:**
- Mandatory onboarding wizard or modal
- First-run setup flow for auth/budget (existing settings page handles this)
- Guided tours or tooltips (too heavy for v1)

## References

- Source: environment onboarding plan — Feature 6
- Pattern: `src/lib/docs/adoption.ts` — existing adoption tracking
- Pattern: `src/components/dashboard/welcome-landing.tsx` — existing first-run empty state
- Related features: environment-dashboard (the destination), environment-sync-engine (Stage 2 prompt)
