---
title: "Design System — Calm Ops"
category: "feature-reference"
section: "design-system"
route: "cross-cutting"
tags: [design, tokens, oklch, typography, elevation, components, calm-ops]
features: ["calm-ops-design-system", "oklch-color-tokens", "shared-component-library"]
screengrabCount: 0
lastUpdated: "2026-03-21"
---

# Design System — Calm Ops

Stagent follows the "Calm Ops" design philosophy: opaque surfaces, border-centric elevation, and zero glass morphism. The system is defined in `design-system/MASTER.md` and implemented through CSS custom properties in `src/app/globals.css`.

## Key Features

### Color System

OKLCH color space with an accent hue of ~250 (indigo/blue-violet). Light-first theme with dark mode support. All color tokens are defined as OKLCH values, ensuring perceptual uniformity across the palette. Forbidden patterns: `rgba()`, `backdrop-filter`, `glass-*`, `gradient-*`.

### Elevation Model

Four elevation levels replace shadow-heavy or glass-based depth cues:

| Level | Usage | Treatment |
|-------|-------|-----------|
| `.elevation-0` | Flat / inset content | No shadow, subtle border |
| `.elevation-1` | Cards, panels | Light border + minimal shadow |
| `.elevation-2` | Popovers, dropdowns | Medium border + soft shadow |
| `.elevation-3` | Modals, command palette | Prominent border + deeper shadow |

### Surface Hierarchy

Three surface tiers create visual nesting without transparency:

- **surface-1** — white / raised (cards, panels)
- **surface-2** — muted (page backgrounds, secondary areas)
- **surface-3** — inset (code blocks, input fields)

### Typography

- **Body text**: Inter — clean, highly legible at 14px base size.
- **Monospace**: JetBrains Mono — code blocks, terminal output, status values.

### Spacing

8pt spacing scale via `--space-*` CSS custom properties. All padding, margin, and gap values derive from this scale to maintain consistent rhythm across layouts.

### Border Radius

Maximum radius is `rounded-xl` (12px). Components use `rounded-lg` for interactive cards and `rounded-md` for inputs and buttons.

### Badge Variants

Five status-driven badge variants map to task and workflow states:

| Variant | Status | Color |
|---------|--------|-------|
| `default` | Running | Indigo |
| `success` | Completed | Green |
| `secondary` | Queued | Gray |
| `destructive` | Failed | Red |
| `outline` | Planned | Border only |

### Interactive Cards

All interactive cards implement focus-visible rings for keyboard navigation, `rounded-lg` corners, and keyboard event handlers (Enter/Space to activate).

## Related

- [Shared Components](./shared-components.md)
- [Keyboard Navigation](./keyboard-navigation.md)
