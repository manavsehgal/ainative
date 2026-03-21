---
title: Cross-Project Comparison
status: planned
priority: P2
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [environment-cache]
---

# Cross-Project Comparison

## Description

Fleet management view showing a matrix of all onboarded projects and their environment artifacts. Answers questions like "Which of my projects have the code-review skill?", "Show all projects using Playwright MCP", "Which projects are missing AGENTS.md?", and enables side-by-side artifact diffs between projects.

This is the aerial view that no CLI tool can provide — it requires a persistent data layer spanning multiple projects, which is exactly what Stagent's scan cache provides.

## User Story

As a developer managing multiple projects, I want to see a comparison matrix showing which CLI tools, skills, hooks, and MCP servers each project has, so I can identify gaps, enforce consistency, and quickly understand how my projects differ in their AI configurations.

## Technical Approach

### Comparison Data Layer

**`src/lib/environment/comparison.ts`**:
- **`getComparisonMatrix(projectIds[])`** — Queries latest scan for each project, returns a matrix: projects × artifact categories with counts and presence indicators
- **`findProjectsWithArtifact(name, category)`** — "Which projects have the code-review skill?"
- **`findProjectsMissingArtifact(name, category)`** — "Which projects are missing AGENTS.md?"
- **`getArtifactDiff(projectIdA, projectIdB, artifactName)`** — Side-by-side content diff of the same artifact across two projects
- **`getBulkSyncCandidates(artifactId, targetProjectIds[])`** — For bulk operations: "Add this hook to all projects missing it"

All queries hit the `environment_artifacts` table joined with `environment_scans` — no additional tables needed.

### Comparison Matrix Page

**`src/app/environment/compare/page.tsx`** — Server Component that loads scans for all projects with `workingDirectory`.

### UI Components

- **`comparison-matrix.tsx`** — Table/heatmap with projects as rows, artifact categories as columns. Cells show counts with color intensity (0=red, low=yellow, high=green). Row hover highlights. Click cell to filter to that project+category.
- **`artifact-presence-cell.tsx`** — Individual cell showing count, checkmark/warning icon, and tooltip with artifact names.
- **`project-diff-view.tsx`** — Side-by-side diff when comparing a specific artifact across two projects. Highlights additions, deletions, and modifications.
- **`bulk-sync-dialog.tsx`** — "Add [skill] to all selected projects" — selects target projects, shows preview, executes via sync engine.

### Matrix Layout

```
              Skills  Hooks  MCP  Perms  Instructions  Health
stagent         20     4     3    152    ██████████     82
auth-service     5     0     1     12    █████░░░░░     45
frontend         8     2     2     34    ██████░░░░     61
data-pipeline    3     1     0      0    ░░░░░░░░░░     28
```

Rows are sortable by any column. Color coding: green (above median), yellow (below median), red (zero/missing).

## Acceptance Criteria

- [ ] Comparison matrix shows all onboarded projects with artifact counts
- [ ] Matrix cells are color-coded by relative count (green/yellow/red)
- [ ] Clicking a cell navigates to filtered artifact view for that project+category
- [ ] "Which projects have X?" query returns correct project list
- [ ] "Which projects are missing X?" query identifies gaps
- [ ] Side-by-side diff works for same-named artifacts across two projects
- [ ] Bulk sync dialog allows adding an artifact to multiple projects at once
- [ ] Matrix is sortable by any column
- [ ] Projects without scans show "Not scanned" row with scan CTA

## Scope Boundaries

**Included:**
- Comparison matrix view across all onboarded projects
- Per-category artifact counts
- Side-by-side artifact diffs between projects
- "Find projects with/missing artifact" queries
- Bulk sync to multiple projects

**Excluded:**
- Automatic anomaly detection ("this project is an outlier")
- Project grouping or tagging (organize by team, language, etc.)
- Historical comparison (compare project's environment over time)

## References

- Source: environment onboarding plan — Feature 8
- Data source: environment_artifacts + environment_scans tables (no new tables)
- Related features: environment-health-scoring (health column in matrix), environment-templates (alternative to bulk sync)
