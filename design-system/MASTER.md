# Stagent Design System — Calm Ops

Single source of truth for visual decisions. All new components must follow these conventions.

## Design Philosophy

**"Calm operational clarity"** — an enterprise-grade design system inspired by Linear's calm density, Stripe's component discipline, and GitHub Primer's accessibility rigor.

Core principles:
1. **Operational familiarity** — every page resembles a recognizable enterprise surface
2. **Progressive disclosure** — overview first, details on demand, raw logs last
3. **Quiet hierarchy** — typography, spacing, and borders do the work; color is for status
4. **Human oversight visible** — approvals, policies, provenance never feel bolted on
5. **Reusable primitives** — shared patterns across all entity types

## Color System

**Engine:** OKLCH with accent hue ~250 (indigo/blue-violet). Defined in `globals.css` with light/dark mode variants.

### Accent Palette

| Role | Light | Dark | Usage |
|------|-------|------|-------|
| Primary | `oklch(0.50 0.20 260)` | `oklch(0.65 0.20 260)` | Buttons, links, active states |
| Destructive | `oklch(0.55 0.22 25)` | `oklch(0.60 0.22 25)` | Delete, error actions |

### Semantic Status Tokens (always use these — never hardcode Tailwind colors)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--status-running` | `oklch(0.50 0.20 260)` | `oklch(0.65 0.20 260)` | Active/in-progress |
| `--status-completed` | `oklch(0.52 0.17 165)` | `oklch(0.62 0.17 165)` | Success/done |
| `--status-failed` | `oklch(0.55 0.22 25)` | `oklch(0.65 0.22 25)` | Error/failure |
| `--status-warning` | `oklch(0.65 0.18 75)` | `oklch(0.75 0.18 75)` | Warnings, pending |
| `--priority-critical` | `oklch(0.55 0.22 25)` | `oklch(0.65 0.22 25)` | P0 |
| `--priority-high` | `oklch(0.65 0.18 55)` | `oklch(0.75 0.18 55)` | P1 |
| `--priority-medium` | `oklch(0.50 0.20 260)` | `oklch(0.65 0.20 260)` | P2 |
| `--priority-low` | `oklch(0.55 0.02 250)` | `oklch(0.58 0.02 250)` | P3 |
| `--complexity-simple` | `oklch(0.52 0.17 165)` | `oklch(0.62 0.17 165)` | Simple |
| `--complexity-moderate` | `oklch(0.65 0.18 75)` | `oklch(0.75 0.18 75)` | Moderate |
| `--complexity-complex` | `oklch(0.55 0.22 25)` | `oklch(0.65 0.22 25)` | Complex |

### Tailwind Utility Classes

Mapped in `@theme inline` for automatic `text-*`, `bg-*`, `border-*` generation:

- `text-status-running`, `bg-status-running`, `border-status-running`
- `text-status-completed`, `bg-status-completed`, `border-status-completed`
- `text-status-failed`, `bg-status-failed`, `border-status-failed`
- `text-status-warning`, `bg-status-warning`, `border-status-warning`
- `text-priority-critical`, `text-priority-high`, `text-priority-medium`, `text-priority-low`
- `text-success`, `bg-success` (alias for status-completed)
- `text-warning`, `bg-warning` (alias for status-warning)
- `text-info`, `bg-info` (alias for status-running)

### Forbidden Patterns

- `text-green-500` / `text-green-600` — use `text-status-completed` or `text-success`
- `text-red-500` / `text-red-600` — use `text-status-failed` or `text-destructive`
- `text-blue-500` / `text-blue-600` — use `text-status-running` or `text-primary`
- `text-amber-500` / `text-amber-600` — use `text-status-warning` or `text-warning`
- Any `backdrop-filter`, `backdrop-blur` — removed from design system
- Any `rgba()` transparency on surface tokens — all surfaces are opaque
- Any `gradient-*` utility class — no page-level gradient backgrounds
- Any `glass-*` utility class — glass morphism has been removed entirely
- Any `rounded-[24px]`, `rounded-[28px]`, `rounded-[30px]` — max is `rounded-xl` (16px)

**Exception:** Decorative use only (illustrations, empty state artwork) — never for state indication.

## Surface System

All surfaces are **opaque** with border-centric elevation. No transparency, no backdrop-filter.

### Surface Hierarchy

| Level | Light | Dark | Usage |
|-------|-------|------|-------|
| Background | `oklch(0.985 0.004 250)` | `oklch(0.14 0.02 250)` | Page canvas |
| Surface-1 | `oklch(1 0 0)` (white) | `oklch(0.18 0.02 250)` | Cards, panels |
| Surface-2 | `oklch(0.975 0.004 250)` | `oklch(0.16 0.02 250)` | Nested cards, controls |
| Surface-3 | `oklch(0.96 0.006 250)` | `oklch(0.14 0.02 250)` | Inset areas |

### Elevation Levels

| Class | Border | Shadow | Usage |
|-------|--------|--------|-------|
| `.elevation-0` | `--border-subtle` | none | Flat, inline elements |
| `.elevation-1` | `--border` | subtle | Cards, panels |
| `.elevation-2` | `--border` | raised | Active cards, toolbars |
| `.elevation-3` | `--border-strong` | overlay | Popovers, modals |

### Surface Utility Classes

| Class | Usage |
|-------|-------|
| `.surface-page` | Page-level background |
| `.surface-page-shell` | Bounded page container with border |
| `.surface-toolbar` | Toolbar / filter bar |
| `.surface-card` | Primary operational card |
| `.surface-card-muted` | Secondary/nested card |
| `.surface-panel` | Grouped sections |
| `.surface-control` | Search, filter, toolbar controls |
| `.surface-scroll` | Scrollable containers |

### Data-Slot Styling

shadcn/ui components get clean opaque styling via `[data-slot]` selectors:
- `[data-slot="card"]` → opaque card with subtle border + hover border-strong
- `[data-slot="input"]`, `[data-slot="textarea"]` → surface-1 with border
- `[data-slot="popover-content"]`, `[data-slot="dropdown-menu-content"]` → overlay elevation
- `[data-slot="sheet-content"]`, `[data-slot="dialog-content"]` → overlay elevation
- `[data-slot="separator"]` → 1px solid border (no 3D groove)

## Typography

**Font family:** Geist Sans (body) + Geist Mono (code, IDs, timestamps)

> Note: Font migration to Inter + JetBrains Mono is planned (F2).

### Scale

| Level | Class | Usage |
|-------|-------|-------|
| Page title | `text-2xl font-bold` | Route headings |
| Card title | `text-base font-medium` | Card headers |
| Section heading | `SectionHeading` component | Uppercase label sections |
| Body | `text-sm` | Default text (14px) |
| Dense | `text-xs` | Table cells, metadata (13px) |
| Caption | `text-xs text-muted-foreground` | Timestamps, secondary info |
| Metric | `text-2xl font-bold` | Dashboard stat values |

## Spacing

**System:** 8pt grid with CSS custom properties.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight gaps |
| `--space-2` | 8px | Default inline gap |
| `--space-3` | 12px | Compact padding |
| `--space-4` | 16px | Standard padding |
| `--space-6` | 24px | Section padding |
| `--space-8` | 32px | Page-level spacing |

| Context | Pattern |
|---------|---------|
| Page padding | `p-4 sm:p-6` |
| Card internal | `p-3` to `p-4` |
| Grid gap | `gap-4` |
| Section margin | `mb-6` |
| Inline element gap | `gap-2` to `gap-3` |

## Border Radius

Base: `--radius: 0.5rem` (8px)

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Small elements, badges |
| `--radius-md` | 6px | Inputs, buttons |
| `--radius-lg` | 8px | Cards |
| `--radius-xl` | 12px | Page shells, modals |

**Rule:** Maximum radius is `rounded-xl` (12px). No oversized 20-30px radii in enterprise surfaces.

## Components

### Badge Variants

| Variant | Usage |
|---------|-------|
| `default` | Running/active states (primary) |
| `success` | Completed/done states |
| `secondary` | Queued/cancelled (muted) |
| `destructive` | Failed/error states |
| `outline` | Planned/draft (bordered) |

### State Components

| Component | Path | Usage |
|-----------|------|-------|
| `EmptyState` | `@/components/shared/empty-state` | No data. Props: icon, heading, description, action? |
| `ErrorState` | `@/components/shared/error-state` | Fetch/operation failed. Props: heading?, description, onRetry? |
| `Skeleton` | `@/components/ui/skeleton` | Loading placeholder |

### Interactive Cards

All clickable cards must include:
- `cursor-pointer transition-colors hover:bg-accent/50`
- `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg`
- `tabIndex={0}` + `onKeyDown` handler for non-Link cards

## Icons

**Library:** Lucide React

| Size | Class | Usage |
|------|-------|-------|
| Default | `h-4 w-4` | Inline icons, buttons, badges |
| Medium | `h-5 w-5` | List items |
| Large | `h-8 w-8` | Empty states (minor) |
| Hero | `h-12 w-12` | EmptyState component |

## Animation

**Principle:** Minimal, functional only. No decorative animations.

| Pattern | Class | Usage |
|---------|-------|-------|
| Hover transition | `transition-colors` | All interactive elements (150ms) |
| Border hover | `hover:border-border-strong` | Cards (150ms) |
| Loading spinner | `animate-spin` | Loader2 icon |
| Loading placeholder | `animate-pulse` | Skeleton component |
| Focus ring | `focus-visible:ring-2` | Keyboard navigation |
| Card exit | `animate-card-exit` | Ghost card deletion (400ms) |

### Removed Animation Patterns

- `glass-shimmer` — removed (was hover shimmer on glass cards)
- Card hover auto-glass enhancement — removed
- Noise grain overlay — removed

## Theme System

### Light Theme (Primary)
- Flagship design target
- Opaque white surfaces (`oklch(1 0 0)`)
- Subtle shadows, visible borders
- Strong text contrast

### Dark Theme (Derived Secondary)
- Charcoal base, not pure black (`oklch(0.14 0.02 250)`)
- Unified hue 250 (blue-indigo)
- Stronger borders than light mode
- Softer text whites (`oklch(0.92 0.01 250)`)
- Every `.dark` token has a derivation comment explaining the light→dark mapping

### Dark Surface Hierarchy

| Family | Lightness | Role |
|--------|-----------|------|
| Base | 0.14 | Background |
| Raised | 0.18 | Cards, surface-1 |
| Intermediate | 0.16 | Surface-2, nested |
| Overlay | 0.20 | Popovers, secondary |

## Design Metrics (Target Range)

| Metric | Target | Context |
|--------|--------|---------|
| DESIGN_VARIANCE | 3-4 | Calm, consistent, border-centric |
| MOTION_INTENSITY | 2-3 | Minimal transitions only |
| VISUAL_DENSITY | 6-7 | Dense operational surfaces with breathing room |
