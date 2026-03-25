---
title: Living Book Content Merge
status: completed
priority: P1
milestone: post-mvp
source: conversation/2026-03-24-living-book-synthesis
dependencies:
  - playbook-documentation
---

# Living Book Content Merge

## Description

Map the Playbook's 19 feature docs and 4 journey guides into the Book's 9-chapter structure, filling the 6 stub chapters with real substance. Each Book chapter gains a "Try It Now" section that links directly to the relevant Playbook feature docs (e.g., Chapter 4: Workflow Orchestration links to `features/workflows.md`). The Playbook content becomes the practical companion to the Book's narrative — readers follow the story, then do the thing.

This is the foundation of the "Living Book" initiative: a single unified content experience at `/book` that merges the Book's narrative arc with the Playbook's reference depth. Instead of writing 6 stub chapters from scratch, the existing Playbook content fills them immediately.

## User Story

As a Stagent user reading the Book, I want each chapter to include practical reference links and "Try It Now" sections, so I can move from understanding concepts to doing them without switching to a separate documentation system.

As a Playbook user, I want my feature guides to be discoverable within the Book's narrative context, so I understand where each feature fits in the bigger autonomy story.

## Technical Approach

### Content Mapping

Create a chapter-to-playbook mapping configuration:

| Chapter | Playbook Feature Docs | Journey |
|---------|----------------------|---------|
| Ch 1: Project Management | projects, task-board | personal-use |
| Ch 2: Task Execution | agent-integration, task-definition-ai | work-use |
| Ch 3: Document Processing | document-preprocessing, document-manager | — |
| Ch 4: Workflow Orchestration | workflow-engine, ai-assist-workflow-creation | power-user |
| Ch 5: Scheduled Intelligence | scheduled-prompt-loops, autonomous-loop-execution | — |
| Ch 6: Agent Self-Improvement | agent-self-improvement, learned-context | developer |
| Ch 7: Multi-Agent Swarms | multi-agent-routing, multi-agent-swarm | — |
| Ch 8: Human-in-the-Loop | inbox-notifications, tool-permission-persistence | — |
| Ch 9: Autonomous Organization | workflow-blueprints, agent-profile-catalog | — |

### Implementation Files

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/book/chapter-mapping.ts` | Create | Maps chapter IDs to playbook slugs and journey IDs |
| `src/lib/book/content.ts` | Modify | Add "Try It Now" sections to all 9 chapters using InteractiveBlock links |
| `src/lib/book/types.ts` | Modify | Add `relatedDocs` and `relatedJourney` fields to `BookChapter` type |
| `src/components/book/try-it-now.tsx` | Create | "Try It Now" section component rendering linked Playbook cards |
| `src/components/book/book-reader.tsx` | Modify | Render TryItNow component at end of each chapter's sections |

### Content Block Extension

Add a new `InteractiveBlock` variant for cross-referencing Playbook content:

```typescript
{
  type: "interactive",
  interactiveType: "link",
  label: "Try: Create your first workflow",
  description: "Open the Workflow Orchestration guide in the Playbook",
  href: "/user-guide/workflows"
}
```

### UX Considerations

- **Visual separation**: "Try It Now" sections use a distinct card with indigo accent border (elevation-1) to differentiate from narrative content
- **Non-intrusive**: Sections appear at the end of each chapter, not interrupting the reading flow
- **Bidirectional links**: Playbook pages gain a "Read the story" link back to the relevant Book chapter
- **Loading state**: Skeleton loader for Playbook card content fetched at render time

## Acceptance Criteria

- [ ] All 9 chapters have `relatedDocs` mappings to relevant Playbook feature docs
- [ ] "Try It Now" section renders at the end of each chapter with linked Playbook cards
- [ ] Clicking a Playbook card navigates to the `/user-guide/[slug]` route
- [ ] Playbook detail pages show a "Read the story" breadcrumb linking back to the parent Book chapter
- [ ] Stub chapters (4-9) gain at least 2 content sections drawn from existing Playbook material
- [ ] Chapter reading time estimates update to reflect merged content
- [ ] Book reader TOC includes "Try It Now" as a navigable section

## Scope Boundaries

**Included:**
- Chapter-to-Playbook mapping configuration
- "Try It Now" component and rendering
- Bidirectional navigation between Book and Playbook
- Filling stub chapters with Playbook-sourced content sections

**Excluded:**
- Removing or deprecating the standalone `/user-guide` route (kept for direct access)
- Migrating content.ts to markdown files (see living-book-markdown-pipeline)
- Reading path personalization (see living-book-reading-paths)
- Author's Notes callouts (see living-book-authors-notes)

## References

- Source: `conversation/2026-03-24-living-book-synthesis` — "Map Playbook feature docs → Book chapter sections"
- Related features: [playbook-documentation](playbook-documentation.md), [living-book-authors-notes](living-book-authors-notes.md)
- Strategy: `ai-native-notes/ai-native-book-strategy.md`
