---
title: Environment Dashboard
status: completed
priority: P0
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [environment-cache]
---

# Environment Dashboard

## Description

The `/environment` route — a live dashboard that instantly shows all discovered Claude Code and Codex artifacts as interactive cards when you point Stagent at a project folder. This is the "aha moment" of the onboarding experience: the user sees their entire CLI environment laid out visually for the first time.

The dashboard adapts to the detected persona (Claude Code only, Codex only, or both), provides category filtering (skills, hooks, MCP servers, permissions, etc.), and opens detail sheets for any artifact. It follows the Calm Ops design system with the established PageShell, card grid, and Sheet overlay patterns.

## User Story

As a Stagent user who has been using Claude Code and/or Codex from the CLI, I want to see all my CLI configurations — skills, plugins, hooks, MCP servers, permissions, instructions, and memory — displayed as an interactive visual dashboard, so I can understand and manage my environment holistically rather than navigating scattered config files.

## Technical Approach

### Route & Page

- **`src/app/environment/page.tsx`** — Server Component wrapped in PageShell. Queries latest scan for the active project. If no scan exists, shows EmptyState with "Scan Environment" CTA.
- **`src/app/environment/loading.tsx`** — Skeleton with summary card placeholders and grid shimmer

### Core Components (`src/components/environment/`)

- **`environment-dashboard.tsx`** — Main dashboard layout: PageHeader → ScanStatusBar → SummaryCardsRow → CategoryFilterBar → ArtifactGrid. Manages filter/sort state.
- **`scan-status-bar.tsx`** — Shows "Last scanned: 2m ago" with Refresh button. During scan shows progress indicator. Uses relative time formatting.
- **`summary-cards-row.tsx`** — Row of stat cards showing counts per category (Skills: 29, Hooks: 4, MCP: 3, Permissions: 152, Rules: 8, etc.). Cards are clickable to filter the grid.
- **`category-filter-bar.tsx`** — Filter chips for each artifact category. Uses the FilterBar pattern from document browser. Shows active count badge.
- **`artifact-card.tsx`** — Interactive card per artifact: category icon (wrench for skills, plug for MCP, shield for permissions, etc.), artifact name, tool badge (Claude/Codex/Both), scope badge (project/user), content preview snippet. Click opens detail sheet. Focus-visible ring + keyboard handlers following existing card patterns.
- **`artifact-detail-sheet.tsx`** — Sheet overlay showing full artifact content, parsed metadata table, file path, last modified, content hash. For editable artifacts, includes "Edit" button (future sync feature). **Must include `px-6 pb-6` body padding** per project convention.
- **`persona-indicator.tsx`** — Badge component showing detected persona with tool-specific colors (indigo for Claude Code, green for Codex, gradient for Both).
- **`tool-comparison-view.tsx`** — Side-by-side view available when persona is "both". Shows Claude Code artifacts on left, Codex on right, shared artifacts highlighted in center.

### Dashboard Layout

Summary cards row → category filter → responsive artifact grid (3 columns desktop, 2 tablet, 1 mobile). Each card uses `.elevation-1` surface with tool-colored left border accent.

### Sidebar Integration

Add "Environment" to Configure group in `src/components/shared/app-sidebar.tsx`:
```typescript
import { Globe } from "lucide-react";
// Add to configureItems array:
{ title: "Environment", href: "/environment", icon: Globe }
```

### Data Flow

1. Server Component calls `getLatestScan(projectId)` from `src/lib/environment/data.ts`
2. If scan exists, calls `getArtifacts(scanId)` and `getArtifactCounts(scanId)`
3. Passes data as props to client dashboard component
4. Client handles filtering, sorting, and sheet interactions
5. "Refresh" button triggers POST to `/api/environment/scan`, then revalidates the page

## Acceptance Criteria

- [ ] `/environment` route renders with PageShell and Calm Ops design
- [ ] Summary cards show artifact counts per category
- [ ] Category filter chips work (filter grid by skill, hook, MCP, etc.)
- [ ] Artifact cards display name, category icon, tool badge, scope badge, preview
- [ ] Clicking an artifact card opens detail sheet with full content and metadata
- [ ] Detail sheet has proper `px-6 pb-6` body padding (project convention)
- [ ] Persona indicator shows Claude/Codex/Both with appropriate styling
- [ ] "Scan" button triggers re-scan and refreshes dashboard
- [ ] Empty state shown when no scan exists with CTA to scan
- [ ] "Environment" appears in sidebar Configure group
- [ ] Dashboard is responsive (3/2/1 column grid)
- [ ] Tool comparison view works for "both" persona

## Scope Boundaries

**Included:**
- `/environment` page with dashboard layout
- All dashboard components (cards, filters, detail sheet, persona indicator)
- Sidebar navigation integration
- Scan trigger from dashboard

**Excluded:**
- Sync/write-back controls on artifacts (see environment-sync-engine)
- Checkpoint management UI (see git-checkpoint-manager)
- Cross-project comparison (see cross-project-comparison)
- Onboarding prompts on project creation (see project-onboarding-flow)

## References

- Source: environment onboarding plan — Feature 3
- Pattern: `src/components/documents/` — DocumentBrowser with FilterBar + grid + detail sheet
- Pattern: `src/components/shared/page-shell.tsx` — PageShell wrapper
- Pattern: `src/components/shared/empty-state.tsx` — EmptyState component
- Design: Calm Ops — `.elevation-1` cards, OKLCH indigo accent, Inter font
- Related features: environment-cache (data source), environment-sync-engine (adds action buttons)
