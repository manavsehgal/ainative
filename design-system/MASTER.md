# Stagent Design System

Single source of truth for visual decisions. All new components must follow these conventions.

## Color System

**Engine:** OKLCH with hue 250 (blue-indigo). Defined in `globals.css` with light/dark mode variants.

### Semantic Tokens (always use these — never hardcode Tailwind colors)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--status-running` | `oklch(0.55 0.18 250)` | `oklch(0.65 0.18 250)` | Active/in-progress states |
| `--status-completed` | `oklch(0.6 0.15 170)` | `oklch(0.65 0.15 170)` | Success/done states |
| `--status-failed` | `oklch(0.55 0.2 25)` | `oklch(0.65 0.2 25)` | Error/failure states |
| `--status-warning` | `oklch(0.7 0.15 75)` | `oklch(0.75 0.15 75)` | Warnings, pending review |
| `--priority-critical` | `oklch(0.55 0.2 25)` | `oklch(0.65 0.2 25)` | P0 priority |
| `--priority-high` | `oklch(0.7 0.15 55)` | `oklch(0.75 0.15 55)` | P1 priority |
| `--priority-medium` | `oklch(0.55 0.18 250)` | `oklch(0.65 0.18 250)` | P2 priority |
| `--priority-low` | `oklch(0.6 0.02 250)` | `oklch(0.6 0.02 250)` | P3 priority |
| `--complexity-simple` | `oklch(0.6 0.15 170)` | `oklch(0.65 0.15 170)` | Simple complexity |
| `--complexity-moderate` | `oklch(0.7 0.15 75)` | `oklch(0.75 0.15 75)` | Moderate complexity |
| `--complexity-complex` | `oklch(0.55 0.2 25)` | `oklch(0.65 0.2 25)` | Complex tasks |

### Tailwind Utility Classes

These are mapped in `@theme inline` so Tailwind auto-generates `text-*`, `bg-*`, `border-*` variants:

- `text-status-running`, `bg-status-running`, `border-status-running`
- `text-status-completed`, `bg-status-completed`, `border-status-completed`
- `text-status-failed`, `bg-status-failed`, `border-status-failed`
- `text-status-warning`, `bg-status-warning`, `border-status-warning`
- `text-priority-critical`, `text-priority-high`, `text-priority-medium`, `text-priority-low`
- `text-success`, `bg-success`, `border-success` (alias for status-completed)
- `text-warning`, `bg-warning`, `border-warning` (alias for status-warning)
- `text-info`, `bg-info`, `border-info` (alias for status-running)
- `text-complexity-simple`, `text-complexity-moderate`, `text-complexity-complex`

### Forbidden Patterns

Never use raw Tailwind color classes for semantic meaning:
- `text-green-500` / `text-green-600` — use `text-status-completed` or `text-success`
- `text-red-500` / `text-red-600` — use `text-status-failed` or `text-destructive`
- `text-blue-500` / `text-blue-600` — use `text-status-running` or `text-primary`
- `text-amber-500` / `text-amber-600` — use `text-status-warning` or `text-warning`
- `text-orange-500` — use `text-priority-high`
- `bg-green-500` / `bg-red-500` — use `bg-success` / `bg-status-failed`

**Exception:** Decorative use only (gradients, illustrations) — never for state indication.

## Typography

**Font family:** Geist Sans (body) + Geist Mono (code, IDs, timestamps)

### Scale

| Level | Class | Usage |
|-------|-------|-------|
| Page title | `text-2xl font-bold` | Route headings |
| Card title | `text-base font-medium` | Card headers |
| Section heading | `SectionHeading` component | Uppercase label sections |
| Body | `text-sm` | Default text |
| Caption | `text-xs text-muted-foreground` | Metadata, timestamps |
| Metric | `text-2xl font-bold` | Dashboard stat values |

### Section Heading Component

Use `<SectionHeading>` from `@/components/shared/section-heading` for labeled sections:
```tsx
<SectionHeading>Recent Projects</SectionHeading>
```
Renders as: `text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3`

## Spacing

| Context | Pattern |
|---------|---------|
| Page padding | `p-6` |
| Card internal | `p-3` to `p-4` (compact) or default CardContent |
| Grid gap | `gap-4` |
| Section margin | `mb-6` |
| Inline element gap | `gap-2` to `gap-3` |
| Stack spacing | `space-y-2` to `space-y-3` |

## Border Radius

Base: `--radius: 0.625rem` (10px)

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Small elements, badges |
| `--radius-md` | 8px | Inputs, buttons |
| `--radius-lg` | 10px | Cards |
| `--radius-xl` | 14px | Modals, sheets |

## Components

### Badge Variants

| Variant | Usage |
|---------|-------|
| `default` | Running/active states (primary blue) |
| `success` | Completed/done states (green tint) |
| `secondary` | Queued/cancelled (muted) |
| `destructive` | Failed/error states |
| `outline` | Planned/draft (bordered) |

### State Components

| Component | Path | Usage |
|-----------|------|-------|
| `EmptyState` | `@/components/shared/empty-state` | No data available. Props: icon, heading, description, action? |
| `ErrorState` | `@/components/shared/error-state` | Data fetch/operation failed. Props: heading?, description, onRetry? |
| `Skeleton` | `@/components/ui/skeleton` | Loading placeholder |

### Interactive Cards

All clickable cards must include:
- `cursor-pointer transition-colors hover:bg-accent/50`
- `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl`
- `tabIndex={0}` + `onKeyDown` handler for non-Link cards

## Icons

**Library:** Lucide React

| Size | Class | Usage |
|------|-------|-------|
| Default | `h-4 w-4` | Inline icons, buttons, badges |
| Medium | `h-5 w-5` | List items, column empty states |
| Large | `h-8 w-8` | Empty states (minor), quick actions |
| Hero | `h-12 w-12` | EmptyState component |

## Animation

| Pattern | Class | Usage |
|---------|-------|-------|
| Hover transition | `transition-colors` | All interactive elements |
| Loading spinner | `animate-spin` | Loader2 icon |
| Loading placeholder | `animate-pulse` | Skeleton component |
| Focus ring | `focus-visible:ring-2` | Keyboard navigation |

## Design Metrics (Target Range)

| Metric | Target | Context |
|--------|--------|---------|
| DESIGN_VARIANCE | 4-6 | Functional task management, not ornate |
| MOTION_INTENSITY | 4-5 | Subtle transitions, not flashy |
| VISUAL_DENSITY | 5-7 | Data-rich but breathable |
