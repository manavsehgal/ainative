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
| Glass shimmer | `glass-shimmer` | Hover shimmer on glass cards (stats, feature cards) |
| Card hover | `[data-slot="card"]:hover` | Auto glass enhancement (bg + shadow boost) |

## Glassmorphism System

### Glass Tokens

Defined in `globals.css` with light/dark variants.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--glass-bg` | `rgba(255,255,255,0.6)` | `oklch(0.18 0.025 280/0.25)` | Standard glass surface |
| `--glass-bg-heavy` | `rgba(255,255,255,0.75)` | `oklch(0.20 0.03 280/0.35)` | Sidebar, modals, popovers |
| `--glass-bg-light` | `rgba(255,255,255,0.4)` | `oklch(0.16 0.02 280/0.15)` | Nested glass, inputs |
| `--glass-bg-subtle` | `rgba(255,255,255,0.25)` | `oklch(0.14 0.015 280/0.1)` | Decorative overlays |
| `--glass-border` | `oklch(0.8 0.02 250/0.25)` | `oklch(0.4 0.04 280/0.2)` | Standard glass edge (violet-tinted) |
| `--glass-border-strong` | `oklch(0.75 0.03 250/0.35)` | `oklch(0.45 0.05 270/0.3)` | Emphasized edges (violet-tinted) |
| `--glass-border-subtle` | `oklch(0.85 0.015 250/0.15)` | `oklch(0.35 0.03 285/0.12)` | Inputs, nested glass (violet-tinted) |
| `--glass-shadow` | `0 8px 32px oklch(0.55 0.05 250/0.1)` | `... oklch(0.05 0.03 280/0.5)` | Standard colored shadow |
| `--glass-shadow-lg` | `0 12px 48px ...` | `... oklch(0.05 0.03 280/0.6)` | Hover/modal elevation |
| `--glass-shadow-sm` | `0 4px 16px ...` | `... oklch(0.05 0.03 280/0.35)` | Subtle depth |
| `--glass-bg-modal` | `oklch(0.97 0.008 250/0.65)` | `oklch(0.12 0.03 285/0.75)` | Sheet/dialog glass |
| `--glass-inner-glow` | `inset 0 1px 0 0 rgba(255,255,255,0.4)` | `... oklch(0.5 0.04 270/0.1)` | Top-edge highlight (violet) |
| `--blur-glass-sm/md/lg/xl` | `8/16/24/40px` | (same) | Backdrop-filter blur levels |

### Glass Utility Classes

| Class | Background | Blur | Border | Shadow | Usage |
|-------|-----------|------|--------|--------|-------|
| `.glass-card` | `--glass-bg` | md (16px) | standard | standard + glow | Default card surfaces |
| `.glass-card-heavy` | `--glass-bg-heavy` | lg (24px) | strong | large + glow | Sidebar, primary panels |
| `.glass-card-light` | `--glass-bg-light` | sm (8px) | subtle | small + subtle glow | Nested glass inside glass |
| `.glass-sidebar` | `--glass-bg-heavy` | lg (24px) | right-side | — | Sidebar panel |
| `.glass-input` | `--glass-bg-light` | sm (8px) | subtle | — | Form inputs |

### Data-Slot Auto-Glass

shadcn/ui components get glass treatment automatically via `[data-slot]` selectors:
- `[data-slot="card"]` → glass-card treatment + hover enhancement
- `[data-sidebar="sidebar"]` → backdrop blur
- `[data-slot="badge"]` → subtle backdrop blur
- `[data-slot="input"]`, `[data-slot="textarea"]`, `[data-slot="select-trigger"]` → glass input
- `[data-slot="popover-content"]`, `[data-slot="dropdown-menu-content"]`, `[data-slot="select-content"]` → heavy glass
- `[data-slot="sheet-content"]`, `[data-slot="dialog-content"]` → modal glass (`--glass-bg-modal`) + XL blur
- `[data-slot="sheet-overlay"]`, `[data-slot="dialog-overlay"]` → hue-250 tinted overlay + 4px blur
- `[data-slot="separator"]` → 2px 3D groove gradient (light/dark variants)
- `[data-slot="button"][data-variant="default"]` → translucent primary CTA with inner glow
- `[data-slot="button"][data-variant="outline"]` → glass fill + blur
- `[data-slot="button"][data-variant="secondary"]` → subtle glass
- `[data-slot="button"][data-variant="destructive"]` → translucent red with glow

### Pastel Gradient Presets

| Preset | Pages | Light identity | Dark identity |
|--------|-------|---------------|---------------|
| `--gradient-morning-sky` | Home, Dashboard | Golden sunrise → warm amber → soft peach | Deep black → midnight blue |
| `--gradient-ocean-mist` | Projects, Workflows | Cyan → seafoam → mint | Deep blue → blue-violet |
| `--gradient-forest-dawn` | Monitor | Mint → sage → soft green | Black → deep violet |
| `--gradient-sunset-glow` | Inbox | Peach → coral → rose | Velvet → warm violet |
| `--gradient-twilight` | Documents | Violet → indigo-mist → periwinkle | Deep violet → indigo |
| `--gradient-neutral` | Settings | Warm cream with soft golden tint | Neutral black with velvet warmth |

Applied via utility classes: `.gradient-morning-sky`, `.gradient-ocean-mist`, etc.
Dark variants use the black/velvet/blue/violet palette at lightness 0.09-0.12, chroma 0.02-0.05, with each gradient having a distinct hue identity (250-320).

### Dark Palette Families

The dark theme uses four distinct color families to create visual depth:

| Family | Hue | Lightness | Role |
|--------|-----|-----------|------|
| **Black** | 280 | 0.09 | Deepest surfaces — `--background`, gradient bases |
| **Velvet** | 310-320 | 0.14-0.18 | Rich accent surfaces — `--secondary`, sidebar accent, sunset gradient |
| **Blue** | 250 | 0.55-0.65 | Primary interactive — `--primary`, buttons, rings |
| **Violet** | 280-290 | 0.15-0.22 | Bridge surfaces — `--muted`, `--accent`, glass overlays, gradient midpoints |

### Glass Forbidden Patterns

- **Never** use `backdrop-blur` without a semi-transparent `background` — invisible without it
- **Never** nest `.glass-card` inside `.glass-card-heavy` — use `.glass-card-light` for nested glass
- **Never** stack more than 2 blur layers — performance degrades significantly
- **Always** include `-webkit-backdrop-filter` alongside `backdrop-filter` for Safari
- **Never** use glass on scrollable lists with 50+ items — repaints are expensive
- **Never** use solid `bg-*` colors on elements that should be glass — breaks the transparency
- **Never** use bare `border-b` for list dividers — use `border-b border-border/50` for softened separators
- **Never** use solid opaque `bg-primary` on buttons in glass UI — buttons get auto-glass via data-slot selectors

## Design Metrics (Target Range)

| Metric | Target | Context |
|--------|--------|---------|
| DESIGN_VARIANCE | 6-7 | Glassmorphism + gradients add visual richness |
| MOTION_INTENSITY | 5-6 | Shimmer animations, hover transitions |
| VISUAL_DENSITY | 5-6 | Glass creates depth and breathing room |
