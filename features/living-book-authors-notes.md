---
title: Living Book Author's Notes
status: completed
priority: P2
milestone: post-mvp
source: conversation/2026-03-24-living-book-synthesis
dependencies:
  - living-book-content-merge
---

# Living Book Author's Notes

## Description

Embed the `ai-native-notes/` screenshots and strategy content into Book chapters as "Author's Notes" callout blocks. These meta-content blocks show real screenshots of Stagent workflows that generated the chapter's content — the story of *how* the Book was built using Stagent. This is the "dogfooding proof" that makes the Book unique: inline evidence that Stagent built its own documentation.

The 8 existing screenshots (workflow-progress, inbox-notifications, chat-querying, code-generation, etc.) become embedded proof points within relevant chapters, wrapped in a distinctive "Author's Notes" callout variant.

## User Story

As a reader, I want to see real screenshots and behind-the-scenes notes from the Stagent team, so I believe the "built with Stagent" claim is genuine and not just marketing.

As a potential adopter evaluating Stagent, I want to see real workflow execution screenshots inline with the narrative, so I can visualize what the tool looks like in practice.

## Technical Approach

### New Callout Variant

Extend the `CalloutBlock` type with an `"authors-note"` variant:

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/book/types.ts` | Modify | Add `"authors-note"` to CalloutBlock variant union |
| `src/components/book/content-blocks.tsx` | Modify | Render Author's Notes with distinct visual treatment |
| `src/lib/book/content.ts` | Modify | Insert Author's Notes blocks into relevant chapter sections |

### Screenshot Mapping

| Screenshot | Chapter | Placement |
|------------|---------|-----------|
| `workflow-progress.png` | Ch 4 (Workflow Orchestration) | After "Implementation" section |
| `inbox-notifications-workflow-progress.png` | Ch 8 (Human-in-the-Loop) | After "Permission Systems" section |
| `chat-querying-workflow.png` | Ch 2 (Task Execution) | After "Multi-Agent" section |
| `code-generation-book-components.png` | Ch 1 (Project Management) | After "Meta Insight" callout |
| `book-reader-workflow.png` | Ch 4 (Workflow Orchestration) | In "Adaptive Blueprints" section |
| `book-reader-workflow-running.png` | Ch 5 (Scheduled Intelligence) | In "Recurring Loops" section |
| `book-reader-task-ai-assist.png` | Ch 2 (Task Execution) | In "AI-Assisted Execution" section |
| `hot-reloading-feature.png` | Ch 6 (Agent Self-Improvement) | In "Feedback Loops" section |

### Visual Design (UX Spec)

Author's Notes callouts follow the Calm Ops design system:

- **Container**: `elevation-1` card with dashed left border in OKLCH hue 250 (indigo)
- **Header**: "Author's Note" label with a pen icon, muted text
- **Image**: Full-width within the callout, rounded-lg corners, optional caption
- **Collapsible**: Author's Notes are collapsible by default to avoid disrupting reading flow — reader can expand to see the screenshot and commentary
- **Typography**: Body text uses italic style to distinguish from chapter narrative

### Image Handling

Screenshots are served from the `public/book/` directory:

| File | Action | Purpose |
|------|--------|---------|
| `public/book/authors-notes/` | Create | Directory for Author's Notes screenshots |
| Copy script | Run once | Copy `ai-native-notes/*.png` → `public/book/authors-notes/` |

## Acceptance Criteria

- [ ] `CalloutBlock` type supports `"authors-note"` variant
- [ ] Author's Notes render with distinct visual treatment (dashed border, pen icon, italic text)
- [ ] All 8 existing screenshots are embedded in relevant chapters
- [ ] Author's Notes are collapsible (collapsed by default)
- [ ] Expanding an Author's Note reveals the screenshot with caption
- [ ] `ai-native-book-strategy.md` key insights are referenced in the Ch 1 "Meta Insight" Author's Note
- [ ] Images load with proper alt text and lazy loading
- [ ] Author's Notes do not appear in reading time calculations

## Scope Boundaries

**Included:**
- New `authors-note` callout variant in types and renderer
- Embedding all 8 existing screenshots into chapter sections
- Collapsible behavior with expand/collapse toggle
- Image optimization and alt text

**Excluded:**
- Auto-generating Author's Notes from execution logs (see living-book-self-updating)
- Video or animated screenshot embeds
- User-submitted notes or annotations

## References

- Source: `conversation/2026-03-24-living-book-synthesis` — "Embed ai-native-notes screenshots as Author's Notes callouts"
- Content: `ai-native-notes/` — 1 strategy doc + 8 screenshots
- Related features: [living-book-content-merge](living-book-content-merge.md)
