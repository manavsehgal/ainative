# Design Decisions — ainative Calm Ops

Decision catalog with rationale. Updated by the self-healing loop during Mode 4 audits.
Each decision has an ID (DD-NNN), decided date, rationale, and supersession chain where applicable.

---

## Color System

### DD-001: OKLCH with Hue ~250

- **Decided:** 2026-03-08
- **Rationale:** OKLCH provides perceptually uniform color manipulation — equal chroma/lightness deltas produce visually equal contrast changes across all hues. Hue ~250 (indigo/blue-violet) is calm, professional, and avoids the overused "AI purple" (#7C3AFF range). All theme tokens use OKLCH notation.
- **Key values:** Primary light `oklch(0.50 0.20 260)`, dark `oklch(0.65 0.20 260)`. Dark mode locks all surfaces to hue 250 with chroma 0.02 for unified palette.

### DD-002: Semantic Status Tokens Over Raw Tailwind

- **Decided:** 2026-03-20
- **Rationale:** Status colors must be consistent and centrally mutable. Raw `text-green-500` creates fragile coupling to a specific Tailwind shade that diverges across components. Semantic tokens (`text-status-completed`, `bg-status-failed/15`) allow palette changes in one place.
- **Forbidden:** `text-green-*`, `text-red-*`, `text-blue-*`, `text-amber-*` for status indication. Use `text-status-*` and `text-priority-*` tokens instead.
- **Token source:** `design-system/tokens.json` → `color.status.*` and `color.priority.*`

---

## Surface System

### DD-003: Opaque Surfaces, No Glass Morphism

- **Decided:** 2026-03-20 (Calm Ops pivot, commit b527c15)
- **Rationale:** Glassmorphism (backdrop-filter, rgba surfaces, blur layers) caused compositing jank in dense operational views, reduced readability of data-heavy surfaces, and conflicted with the calm aesthetic goal. The project initially used glassmorphism (Mar 9, commit 63e059b with +1,139 lines of glass tokens) but removed it entirely during the Calm Ops pivot.
- **Supersedes:** Glassmorphism phase (2026-03-09)
- **Forbidden:** `backdrop-filter`, `backdrop-blur`, `rgba(`, `glass-*`, `--glass-*`, `--blur-glass`

### DD-004: 3-Tier Surface Hierarchy

- **Decided:** 2026-03-20
- **Rationale:** Clear visual nesting without shadows or transparency. Three tiers create parent→child→inset reading order:
  - Surface-1: Cards, raised panels (white in light, oklch 0.18 in dark)
  - Surface-2: Nested content, muted backgrounds (oklch 0.975 light, 0.16 dark)
  - Surface-3: Inset wells, scroll areas (oklch 0.96 light, 0.14 dark)
- **CSS utilities:** `.surface-card`, `.surface-card-muted`, `.surface-control`, `.surface-scroll`

### DD-005: Border-Centric Elevation (4 Levels)

- **Decided:** 2026-03-20
- **Rationale:** Borders are cheaper to render than box-shadows, more predictable across light/dark themes, and visually clearer at small sizes. Four levels:
  - `elevation-0`: Flat, inline (border-subtle, no shadow)
  - `elevation-1`: Cards, panels (border, shadow-subtle)
  - `elevation-2`: Active cards, toolbars (border, shadow-raised)
  - `elevation-3`: Popovers, modals, dialogs (border-strong, shadow-overlay)
- **Anti-pattern:** Using `shadow-lg`, `shadow-xl`, `shadow-2xl` directly instead of elevation utilities.

---

## Typography

### DD-006: Inter + JetBrains Mono

- **Decided:** 2026-03-20
- **Rationale:** Inter is optimized for small text (13-14px) in dense operational views — its x-height and letter spacing excel at the sizes ainative uses most. JetBrains Mono for code, IDs, timestamps, and monospace data.
- **Supersedes:** Geist Sans + Geist Mono (initial choice, removed)
- **Forbidden:** Any reference to `Geist`, `geist-sans`, `geist-mono`
- **Base font size:** 14px (set on `<html>`)
- **Scale:** Page title `text-2xl font-bold`, Card title `text-base font-medium`, Body `text-sm`, Dense `text-xs`

---

## Layout

### DD-007: PageShell Unification

- **Decided:** 2026-03-21 (commit 838852e)
- **Rationale:** Every route uses `PageShell` for consistent title/actions/filters/detail-pane anatomy. Eliminates per-page layout decisions, ensures consistent back navigation, bounded content width, and optional right-rail detail pane (420px). 16 pages migrated in one commit.
- **Component:** `src/components/shared/page-shell.tsx`
- **Anti-pattern:** Page routes that build their own layout wrapper instead of using PageShell.

### DD-008: Bento Grid for Forms and Detail Views

- **Decided:** 2026-03-11 (commits 497f71d, 344e07a)
- **Rationale:** Multi-column card-based grids (using `FormSectionCard` with fieldset/legend semantics) provide better scannability than single-column form stacks. Detail views use responsive 2-3 column grids with collapsible sections.
- **Pattern:** CSS Grid with `grid-cols-1 md:grid-cols-2` base, spanning cards for wide content.

### DD-009: Max Radius rounded-xl (12px)

- **Decided:** 2026-03-20
- **Rationale:** Oversized radii (20-30px) conflict with enterprise density and information-heavy surfaces. 12px maximum keeps surfaces professional and data-focused.
- **Forbidden:** `rounded-[24px]`, `rounded-[28px]`, `rounded-[30px]`, `rounded-2xl` on cards/containers. `rounded-full` is acceptable only on avatars, badges, and pulse indicators.

---

## Spacing

### DD-010: 8pt Grid with --space-* Tokens

- **Decided:** 2026-03-08
- **Rationale:** Consistent spatial rhythm across all surfaces. All spacing values use 4px increments on the 8pt base grid: `--space-1` (4px) through `--space-16` (64px). Standard padding is `--space-4` (16px), section padding `--space-6` (24px), page-level `--space-8` (32px).
- **Anti-pattern:** Arbitrary pixel values not on the 4px grid (e.g., `p-[5px]`, `gap-[7px]`).

---

## Status System

### DD-011: 5 Orthogonal Status Families

- **Decided:** 2026-03-20
- **Rationale:** Status is not one-dimensional. An entity can be "running" (lifecycle) AND "pending_approval" (governance) simultaneously. Five families:
  1. **Lifecycle:** planned, queued, running, active, completed, failed, paused, cancelled, draft
  2. **Governance:** pending_approval, approved, denied, needs_input
  3. **Runtime:** claude, codex, hybrid
  4. **Risk:** read_only, git_safe, full_auto
  5. **Schedule:** active, paused, completed, expired
- **Source:** `src/lib/constants/status-families.ts`
- **Component:** `StatusChip` renders any status from any family uniformly.

### DD-012: Badge Variants Mapped to Semantic Status

- **Decided:** 2026-03-20
- **Rationale:** Consistent visual encoding of status across all surfaces:
  - `default` (primary bg) → running/active states
  - `success` (green bg) → completed/approved states
  - `destructive` (red bg) → failed/denied states
  - `secondary` (muted bg) → queued/paused/cancelled states
  - `outline` (border only) → planned/draft/pending states
- **Source:** `src/lib/constants/status-colors.ts`

---

## Styling Patterns

### DD-013: data-slot Styling for shadcn/ui

- **Decided:** 2026-03-20
- **Rationale:** shadcn/ui components expose `data-slot` attributes. Styling via `[data-slot="card"]` in `globals.css` allows clean opaque surface application without modifying component source files. Doubled attribute selectors `[data-slot="x"][data-slot="x"]` boost specificity from (0,1,0) to (0,2,0) to override Tailwind v4 cascade layers.
- **Key selectors:** `[data-slot="card"]`, `[data-slot="input"]`, `[data-slot="select-trigger"]`, `[data-slot="popover-content"]`, `[data-slot="dialog-content"]`, `[data-slot="table-row"]`

### DD-014: Tailwind v4 @theme inline

- **Decided:** 2026-03-20
- **Rationale:** Tailwind v4's `@theme inline { ... }` block in `globals.css` maps CSS custom properties to utility classes without needing `tailwind.config.ts`. All design tokens defined in CSS, automatically generating utilities like `text-status-running`, `bg-surface-1`, etc.
- **No tailwind.config.ts needed** — the entire theme is in `globals.css`.

---

## Animation

### DD-015: Minimal Functional Animations Only

- **Decided:** 2026-03-20
- **Rationale:** Calm operational clarity means motion serves function, not decoration. Defined animations:
  - `transition-colors` (150ms) — hover state changes
  - `animate-spin` — loading spinners
  - `animate-pulse` — skeleton loaders
  - `animate-fade-in` — element entry (opacity + translateY, 300ms)
  - `animate-card-exit` — card deletion (opacity + scale + height, 400ms)
  - `animate-pulse-slide` — indeterminate progress bars
- **Forbidden:** `glass-shimmer`, noise-grain overlay, auto-glass enhancement, decorative parallax
- **Design metrics target:** MOTION_INTENSITY 2-3

---

## Candidate Patterns (Research-Informed, Not Yet Implemented)

### DD-016: Hierarchical Dimming (Linear-Inspired)

- **Status:** Candidate
- **Source:** Linear's 2026 design refresh — "structure should be felt, not seen"
- **Pattern:** Dim navigation surfaces (sidebar, tabs) while spotlighting content areas. Navigation chrome uses surface-2/surface-3 with reduced text contrast; content stays on surface-1 with full contrast.
- **Potential application:** App sidebar could use dimmed treatment to recede behind main content.

### DD-017: Border Opacity from OKLCH Lightness Delta

- **Status:** Candidate
- **Source:** Modern OKLCH design system research
- **Pattern:** Derive border visibility from the lightness difference between the surface and its parent. Darker surfaces automatically get stronger borders via `color-mix(in oklab, var(--border) 80%, transparent)` or similar. Eliminates manual border-subtle/border/border-strong selection.
- **Potential application:** Could replace the 3-tier border token system with a single computed border.
