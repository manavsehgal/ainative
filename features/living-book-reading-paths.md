---
title: Living Book Reading Paths
status: completed
priority: P2
milestone: post-mvp
source: conversation/2026-03-24-living-book-synthesis
dependencies:
  - living-book-content-merge
  - playbook-documentation
---

# Living Book Reading Paths

## Description

Transform the Playbook's 4 persona-based journeys (personal, work, power-user, developer) into curated reading paths through the Book. Instead of a single linear chapter sequence, readers choose (or are recommended) a path that surfaces the most relevant chapters, Playbook docs, and exercises for their adoption stage and goals.

The system uses the Playbook's existing stage-aware CTA logic (`new → early → active → power`) to recommend the appropriate reading path. Reading paths are overlaid on the existing Book structure — they don't duplicate content, they filter and sequence it.

## User Story

As a new ainative user, I want a guided reading path that starts with the basics and skips advanced content, so I don't feel overwhelmed by the full 9-chapter book.

As a developer evaluating ainative, I want a path that surfaces code examples, agent configurations, and architecture deep-dives, so I can assess the technical depth quickly.

As a returning user, I want the Book to adapt its recommendations based on what I've already used, so I see fresh, relevant content each time.

## Technical Approach

### Reading Path Definitions

| Path | Target Persona | Chapters | Focus |
|------|---------------|----------|-------|
| **Getting Started** | New users (`new` stage) | Ch 1–3 | Concepts + getting-started Playbook docs |
| **Team Lead** | Work users (`early` stage) | Ch 1, 4–5 | Planning + workflows + scheduling |
| **Power User** | Active users (`active` stage) | Ch 4–8 | Workflows, swarms, permissions, automation |
| **Developer** | Developer users (`power` stage) | All 9 | Full book + code deep-dives + developer journey |

### Implementation Files

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/book/reading-paths.ts` | Create | Path definitions, chapter filtering, and stage-aware recommendation logic |
| `src/lib/book/types.ts` | Modify | Add `ReadingPath` type with `id`, `name`, `description`, `persona`, `chapters`, `usageStage` |
| `src/components/book/path-selector.tsx` | Create | Path selection UI shown on Book landing page and as a persistent toggle |
| `src/components/book/path-progress.tsx` | Create | Progress indicator scoped to the active reading path |
| `src/app/book/page.tsx` | Modify | Show path selector on landing page; filter chapter list by active path |
| `src/components/book/book-reader.tsx` | Modify | "Next chapter" navigation respects active path order |
| `src/app/api/book/progress/route.ts` | Modify | Store active path preference alongside reading progress |

### Stage-Aware Recommendation

Leverage `src/lib/docs/usage-stage.ts` to detect the user's current stage:

```typescript
function recommendPath(stage: UsageStage): ReadingPathId {
  switch (stage) {
    case "new": return "getting-started";
    case "early": return "team-lead";
    case "active": return "power-user";
    case "power": return "developer";
  }
}
```

### UX Specification

**Information Architecture:**
- Book landing page shows a path selector above the chapter grid
- Active path highlights its chapters, dims others (not hidden — users can still access any chapter)
- Path progress bar replaces the overall progress bar when a path is active

**Interaction Patterns:**
- Path selector: horizontal segmented control (4 options) with icon + label
- Chapter grid: cards for path-included chapters are full opacity; others are 40% opacity with "Not in this path" label
- "Next Chapter" button at end of each chapter jumps to the next chapter in the active path (skipping non-path chapters)
- "Switch Path" action accessible from reader settings

**Visual Hierarchy:**
1. Path selector (primary — first thing on landing page)
2. Path progress indicator (secondary — persistent in reader)
3. Chapter grid filtered by path (content area)

**Key States:**
- **No path selected**: Show all chapters equally with path recommendation badge
- **Path active**: Filtered view with progress tracking
- **Path complete**: Celebration state with "Try another path" CTA

**Design Metrics (per frontend-designer coordination table):**
- DV: 3 (minimal variance — documentation/knowledge base)
- MI: 3 (subtle transitions on path switch)
- VD: 4 (comfortable reading density)

## Acceptance Criteria

- [ ] 4 reading paths defined with chapter mappings and persona descriptions
- [ ] Path selector renders on Book landing page as a segmented control
- [ ] Selecting a path filters the chapter grid (dims non-path chapters, doesn't hide them)
- [ ] Stage-aware recommendation logic suggests a path based on `usage-stage.ts`
- [ ] "Next Chapter" navigation in the reader respects active path order
- [ ] Path-scoped progress bar tracks completion within the active path
- [ ] Path preference persists across sessions (stored alongside reading progress)
- [ ] User can switch paths or clear path selection at any time
- [ ] All chapters remain accessible regardless of active path

## Scope Boundaries

**Included:**
- 4 reading path definitions with chapter mappings
- Path selector UI and filtered chapter view
- Stage-aware path recommendation
- Path-scoped progress tracking
- Persistent path preference

**Excluded:**
- Custom user-created paths
- AI-generated path recommendations based on task history
- Path-specific quizzes or exercises (future enhancement)
- Gamification (badges, streaks)

## References

- Source: `conversation/2026-03-24-living-book-synthesis` — "Persona Journeys Become Book Reading Paths"
- Related features: [living-book-content-merge](living-book-content-merge.md), [playbook-documentation](playbook-documentation.md)
- Stage detection: `src/lib/docs/usage-stage.ts`
- Journey data: `src/lib/docs/journey-tracker.ts`
