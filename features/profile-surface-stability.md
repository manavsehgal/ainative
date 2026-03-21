---
title: Profile Surface Stability
status: completed
priority: P2
milestone: post-mvp
source: ideas/ux-improvements.md
dependencies:
  - operational-surface-foundation
  - agent-profile-catalog
---

# Profile Surface Stability

## Description

The profile browser and profile detail routes were redesigned into denser, more capable operational views, but they were left on the default glass-card rendering path after the broader surface-system migration. That mismatch meant the profile experience still depended on backdrop blur for primary content, which reintroduced the exact instability the surface work was meant to remove: compositing flash during first paint, inconsistent card treatment during scroll, and a softer-than-intended scan rhythm.

This feature closes that gap with a bounded profile-specific refinement. It keeps the route-level gradient identity and lightweight shell atmosphere, but moves the actual list, detail cards, and supporting panels onto the stable solid-surface primitives. The result is closer to the intended Neosignal-inspired operator feel: compact hierarchy, deliberate framing, and dense content that does not visually recompose while the user is reading or scrolling.

## User Story

As a Stagent operator browsing or inspecting agent profiles, I want the profile surfaces to feel stable and crisp while I scroll so that the page reads like an operational catalog instead of a blur-heavy showcase.

## Technical Approach

- Wrap `/profiles` and `/profiles/[id]` content in a bounded `surface-page` container so the gradient remains atmospheric while the working area stays visually stable
- Move profile list cards, detail cards, test rows, and SKILL preview containers from default `Card` glass treatment onto `surface-card`, `surface-card-muted`, `surface-panel`, and `surface-scroll`
- Update search and domain filter controls to use `surface-control` so the top toolbar matches the denser operational treatment
- Preserve the existing information architecture and interactions while removing reliance on the global `[data-slot="card"]` backdrop-blur path for primary profile content

## Acceptance Criteria

- [x] `/profiles` renders profile cards inside solid operational surfaces instead of default auto-glass cards
- [x] `/profiles/[id]` renders its primary detail cards, SKILL preview, and test rows without relying on backdrop blur
- [x] The profile toolbar uses stable control surfaces consistent with the solid-surface system
- [x] Route-level framing preserves the ocean-mist gradient identity while visually separating the dense working area
- [x] Investigation notes and changelog capture that the previous compositing fix addressed symptoms, while this slice removes the fragile rendering path for profiles

## Scope Boundaries

**Included:**
- Profile browser and detail-route surface migration
- Compact page framing for the profile routes
- Toolbar/control surface refinement for profile browsing
- Product-doc reconciliation for this shipped slice

**Excluded:**
- Reworking profile information architecture
- Changing profile creation/edit flows
- Replacing glass usage elsewhere in the shell
- Broader cross-route density refinement is now shipped in `ui-density-refinement`

## References

- Source: `ideas/ux-improvements.md`
- Related features: `operational-surface-foundation`, `agent-profile-catalog`, `ui-density-refinement`
