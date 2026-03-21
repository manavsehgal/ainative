---
name: frontend-designer
description: UX strategist and design orchestrator for frontend interfaces. Use this skill when the user asks for design review, UX recommendations, user flow analysis, design system management, interface strategy, design audits, persona-driven design decisions, component inventory, interaction specifications, or design deliverables. Also triggers on "review the UX", "design review", "user flow", "information architecture", "interaction design", "design system audit", "component inventory", "design tokens", or any request needing design thinking beyond building or styling a single component. Do NOT use for building components (use frontend-design), checking Tailwind code (use taste), or creating feature specs (use product-manager).
---

# Frontend Designer

UX strategist that bridges product requirements to design execution. Answers the "why" layer: why this interface serves this user, why this layout supports this workflow, why these patterns match the product goals.

## Role Boundaries

| Need | Skill | Not This Skill |
|------|-------|----------------|
| "Build me a landing page" | `frontend-design` | `frontend-designer` |
| "Check my Tailwind code" | `taste` | `frontend-designer` |
| "Create a feature spec" | `product-manager` | `frontend-designer` |
| "Review the UX of this component" | `frontend-designer` | `taste` |
| "What's the right layout for this workflow?" | `frontend-designer` | `frontend-design` |
| "Audit component consistency" | `frontend-designer` | `taste` |

## Workflow Detection

Determine which mode to run based on user intent:

### 1. Design Review
**Trigger:** User asks to review, audit, or evaluate an existing UI — code, screenshot, or live page.

### 2. UX Recommendation
**Trigger:** User has a feature or product goal and needs interface strategy before building.

### 3. Design Deliverable
**Trigger:** User requests a component inventory, interaction specification, or design token set.

### 4. Design System Management
**Trigger:** User asks to audit component consistency, standardize patterns, manage design tokens, or persist design decisions for cross-session consistency.

### 5. Product-Design Bridge
**Trigger:** User has feature specs (from `product-manager`) and needs UX-testable acceptance criteria or interaction patterns added.

---

## Design Review Mode

Read the UI code or screenshot, then evaluate against these criteria:

### Pre-Flight Check
Run `/taste` pre-flight checklist first. If violations exist, report them before proceeding to UX review.

### UX Evaluation Criteria

**Information Architecture**
- Content hierarchy matches user mental models
- Navigation structure supports primary tasks
- Labels and categories are intuitive (not org-chart-driven)
- Progressive disclosure: right information at the right depth

**Interaction Design**
- Primary actions are visually dominant and easy to reach
- Destructive actions require confirmation and are visually de-emphasized
- Feedback loops: every user action produces visible response
- Error recovery: users can undo, go back, or escape from any state
- Keyboard navigation and focus management

**State Completeness**
- All data states handled: loading, empty, populated, error, offline
- Transition states: what happens between states? Skeleton loaders, optimistic updates?
- Edge cases: very long text, zero items, thousands of items, missing optional data

**Persona Alignment**
- Interface complexity matches user expertise level
- Terminology matches the domain (not developer jargon)
- Task frequency drives placement: frequent actions are fast, rare actions are findable

**Accessibility**
- Color contrast meets WCAG AA (4.5:1 for text, 3:1 for large text)
- Interactive elements have minimum 44x44px touch targets
- Screen reader flow matches visual hierarchy
- Focus indicators are visible and styled (not browser defaults)

### Review Output Format

```markdown
## Design Review: [Component/Page Name]

### Summary
[1-2 sentence overall assessment]

### Strengths
- [What works well and why]

### Issues

#### Critical (blocks usability)
- **[Issue]**: [Description] -> [Recommendation]

#### Important (degrades experience)
- **[Issue]**: [Description] -> [Recommendation]

#### Minor (polish opportunity)
- **[Issue]**: [Description] -> [Recommendation]

### Taste Pre-Flight
- [Results from /taste checklist, if violations found]
```

**Persistence:** After presenting the review, invoke `/product-manager` incremental update to: (a) update the feature's `features/<name>.md` acceptance criteria with Critical/Important UX fixes, (b) log the design review in `features/changelog.md`. If issues require new work not tied to an existing feature, create or append to `ideas/ux-improvements.md`.

---

## UX Recommendation Mode

When a user has a feature or product goal, produce interface strategy before handing off to implementation skills.

### Process

1. **Understand the context** — Read feature specs from `features/` if they exist. Identify the target persona, core task, and success metric.
2. **Define information architecture** — What content/data does the user need? In what order? At what depth?
3. **Select interaction patterns** — Based on the task type, choose appropriate patterns (see Pattern Library below).
4. **Establish visual hierarchy** — What should the user see first, second, third? What can be hidden?
5. **Specify key states** — Map out loading, empty, error, and success states for the primary flow.
6. **Calibrate design metrics** — Use the coordination table to recommend `/taste` metric values.
7. **Hand off** — Provide direction for `/frontend-design` (aesthetic) and `/taste` (metric tuning).

### Product Context Coordination Table

Recommend `/taste` design metric values based on product context:

| Product Context | DV | MI | VD | Style Direction | Key Anti-Pattern |
|-----------------|------|------|------|-----------------|------------------|
| Kanban / task management | 4-6 | 4-5 | 5-7 | flat, functional | ornate design, hidden features |
| Inbox / notifications | 3-5 | 3-4 | 4-6 | minimal, scan-friendly | heavy chrome, slow response |
| Monitoring dashboard | 3-5 | 5-7 | 7-8 | data-dense, heat-map | slow rendering, no filtering |
| Onboarding / setup wizard | 5-7 | 6-8 | 2-4 | claymorphic, playful | complex jargon, info overload |
| Landing page / marketing | 7-9 | 7-9 | 3-5 | aurora, motion-driven | generic photos, static layout |
| Settings / configuration | 2-4 | 2-3 | 4-5 | flat, minimal | playful design, unclear labels |
| Data table / admin panel | 2-4 | 2-3 | 7-9 | flat, data-dense | ornate design, hidden features |
| Creative tool / editor | 5-7 | 5-7 | 5-7 | dark mode, flexible | rigid layout, slow perf |
| E-commerce / product page | 6-8 | 6-8 | 4-6 | vibrant, trust-first | low-quality imagery |
| Documentation / knowledge base | 3-5 | 2-4 | 3-5 | minimal, high-contrast | cluttered layout, slow loading |
| Social media / community | 6-8 | 6-8 | 5-7 | vibrant, block-based | accessibility ignored |
| Healthcare / medical | 2-4 | 2-3 | 4-6 | neumorphic, accessible | bright neon, motion-heavy |
| Financial / banking | 2-4 | 3-4 | 5-7 | trust-first, minimal | playful design, unclear fees |
| Education / learning | 5-7 | 5-7 | 4-6 | claymorphic, playful | dark modes, complex jargon |
| Media / streaming | 7-9 | 7-9 | 5-7 | dark mode, motion-driven | static layout, slow player |
| Real estate / property | 5-7 | 5-7 | 4-6 | glass + minimal | poor photos, no virtual tours |
| Travel / booking | 7-9 | 7-9 | 4-6 | aurora, motion-driven | generic photos, complex booking |
| Food / restaurant | 6-8 | 5-7 | 4-6 | vibrant, warm colors | low-quality imagery |
| Fitness / wellness | 6-8 | 6-8 | 5-7 | vibrant + dark mode | static design, no gamification |
| News / editorial | 3-5 | 3-5 | 5-7 | minimal, high-contrast | cluttered layout, slow loading |
| Developer tools / IDE | 2-4 | 2-3 | 6-8 | dark mode, mono-heavy | light mode default, slow perf |
| CRM / sales pipeline | 3-5 | 4-5 | 6-8 | flat, data-dense | ornate design, hidden features |
| Analytics / BI dashboard | 3-5 | 5-7 | 7-9 | data-dense, heat-map | slow rendering, no filtering |
| Chat / messaging | 4-6 | 4-6 | 5-7 | soft UI, real-time | heavy chrome, slow response |
| IoT / smart home | 4-6 | 5-7 | 6-8 | glass + dark mode | slow updates, no automation |

DV = DESIGN_VARIANCE, MI = MOTION_INTENSITY, VD = VISUAL_DENSITY (all 1-10 scale, see `/taste`).

### Font Pairing Quick-Reference

Curated pairings using Google Fonts. Load via `https://fonts.googleapis.com/css2?family=Font+Name:wght@400;500;700&display=swap`.

| Pairing | Display Font | Body Font | Best For |
|---------|-------------|-----------|----------|
| Startup Bold | Clash Display | Satoshi | Startups, bold SaaS |
| SaaS Friendly | Plus Jakarta Sans | Plus Jakarta Sans | SaaS, productivity |
| Tech Modern | Space Grotesk | DM Sans | Dev tools, AI products |
| Geometric Clean | Outfit | Work Sans | Agencies, portfolios |
| Corporate Trust | Lexend | Source Sans 3 | Enterprise, gov, healthcare |
| Editorial Classic | Playfair Display | Lato | Editorial, luxury (serif) |
| Playful Creative | Fredoka | Nunito | Children's, education |
| Dashboard Data | Fira Code | Fira Sans | Analytics, admin panels |
| Fashion Forward | Syne | Manrope | Fashion, creative agencies |
| Sports Impact | Barlow Condensed | Barlow | Sports, fitness, competition |
| Wellness Calm | Lora | Raleway | Spa, wellness, organic |
| Gaming Bold | Russo One | Chakra Petch | Gaming, esports |
| Crypto/Web3 | Orbitron | Exo 2 | Crypto, blockchain |
| Accessibility First | Atkinson Hyperlegible | Atkinson Hyperlegible | Gov, healthcare, inclusive |
| Retro Vintage | Abril Fatface | Merriweather | Vintage brands, breweries |

**Note:** Pairings are compatible with `/taste` approved fonts (Geist, Outfit, Satoshi, Clash Display, Plus Jakarta Sans). When a `/taste`-approved font is available, prefer it. Use these pairings for industry-specific recommendations where the approved list doesn't cover the domain.

### Recommendation Output Format

```markdown
## UX Recommendation: [Feature/Goal]

### Context
- **Persona:** [Who is using this]
- **Core task:** [Primary action they're trying to complete]
- **Success metric:** [How we know this works]

### Information Architecture
[Content hierarchy and navigation structure]

### Interaction Patterns
[Selected patterns with rationale — reference Pattern Library]

### Visual Hierarchy
1. [Primary focal point — what user sees first]
2. [Secondary elements]
3. [Tertiary/discoverable elements]

### Key States
- **Loading:** [Approach]
- **Empty:** [Approach]
- **Error:** [Approach]
- **Success:** [Approach]

### Design Metric Calibration
| Metric | Recommended | Rationale |
|--------|-------------|-----------|
| DESIGN_VARIANCE | [value] | [why] |
| MOTION_INTENSITY | [value] | [why] |
| VISUAL_DENSITY | [value] | [why] |

### Handoff
- **To /frontend-design:** [Aesthetic direction, tone, mood]
- **To /taste:** [Specific metric values, any rule overrides]
```

**Persistence:** After presenting the recommendation, invoke `/product-manager` incremental update to: (a) update the feature's `features/<name>.md` Technical Approach and Acceptance Criteria with UX specs, (b) add UX-testable acceptance criteria, (c) update `features/roadmap.md` if design dependencies change build order. If no feature file exists for the concept, create a new idea in `ideas/` then run `/product-manager` grooming for it.

---

## Design Deliverable Mode

### Component Inventory

Audit existing components and produce a structured inventory:

```markdown
## Component Inventory: [Project/Feature]

### Component Catalog

| Component | Location | Variants | States | Accessibility |
|-----------|----------|----------|--------|---------------|
| [Name] | [file:line] | [list] | [list] | [pass/issues] |

### Consistency Issues
- [Components that solve the same problem differently]
- [Inconsistent spacing, color, or typography across similar components]
- [Missing variants that exist in sibling components]

### Recommendations
- [Components to consolidate]
- [Missing components to create]
- [Variants to standardize]
```

**Persistence:** After presenting the deliverable, invoke `/product-manager` incremental update to update relevant feature files with new component/interaction requirements. Add missing components as acceptance criteria on the feature files that need them.

### Interaction Specification

Define detailed interaction behavior for complex components:

```markdown
## Interaction Spec: [Component Name]

### Trigger
[What initiates this interaction]

### States
| State | Visual | Behavior | Transition |
|-------|--------|----------|------------|
| Default | [description] | [description] | — |
| Hover | [description] | [description] | [duration, easing] |
| Active | [description] | [description] | [duration, easing] |
| Focused | [description] | [description] | [duration, easing] |
| Disabled | [description] | [description] | — |
| Loading | [description] | [description] | [duration, easing] |

### Keyboard Interactions
| Key | Action |
|-----|--------|
| Enter/Space | [action] |
| Escape | [action] |
| Arrow keys | [action] |
| Tab | [action] |

### Edge Cases
- [What happens with very long content]
- [What happens with rapid repeated interactions]
- [What happens during network latency]
```

### Chart Type Guidance

When a deliverable includes data visualization, recommend chart types by data pattern:

| Chart Type | Data Pattern | Library |
|------------|-------------|---------|
| Bar (vertical) | Category comparison | Recharts |
| Bar (horizontal) | Long-label comparison | Recharts |
| Line | Trend over time | Recharts |
| Area | Volume over time | Recharts |
| Pie/Donut | Part-to-whole (≤5 slices) | Recharts |
| Heatmap | Density across 2D | Nivo |
| Sparkline | Inline trend indicator | Tremor |
| KPI card | Single metric + delta | Tremor |
| Funnel | Conversion stages | Nivo |
| Treemap | Hierarchical proportions | Nivo |
| Gauge/Radial | Progress toward target | Recharts |

**Anti-patterns:** Never use 3D charts. Prefer small multiples over dual-axis. Avoid pie charts with >5 slices (use horizontal bar instead).

---

## Design System Management Mode

### Audit Process

1. **Collect** — Read all component files, extract visual patterns (colors, spacing, typography, border radius)
2. **Cross-reference** — Check extracted values against `/taste` approved values
3. **Identify drift** — Components using values outside the design system
4. **Report** — Produce consistency report with specific file:line references

### Audit Output Format

```markdown
## Design System Audit

### Token Coverage
- Colors: [N/M components use design tokens]
- Spacing: [N/M components use consistent scale]
- Typography: [N/M components use approved fonts/sizes]
- Border radius: [N/M components use consistent values]

### Drift Report
| Component | File | Issue | Current | Expected |
|-----------|------|-------|---------|----------|
| [name] | [file:line] | [type] | [value] | [value] |

### Recommendations
- [Tokens to add to design system]
- [Components to update]
- [Patterns to deprecate]
```

**Persistence:** After presenting the audit, invoke `/product-manager` incremental update to create or update `ideas/design-system-fixes.md` with remediation items. If drift severity is high (multiple components affected, accessibility violations), flag for `/product-manager` to create a dedicated feature file.

### Design System Persistence

Persist design decisions to files so they survive across sessions:

**Folder convention:**
- `design-system/MASTER.md` — Single source of truth at project root
- `design-system/pages/<page>.md` — Optional per-page overrides

**MASTER.md captures:**
- Color tokens (OKLCH values, semantic names)
- Typography selections (font pairings from quick-reference, weights, scale)
- Spacing scale (base unit, multipliers)
- Border radius convention (e.g., "4px buttons, 8px cards, 12px modals")
- Component pattern choices (e.g., "tables over cards for data display")
- Animation conventions (motion intensity, preferred easing functions)
- Design metric calibration (DV, MI, VD values from coordination table)

**Override pattern:** Page-level files inherit from MASTER and override specific tokens. Example: a marketing landing page overrides `DESIGN_VARIANCE: 4` → `DESIGN_VARIANCE: 8` while keeping all other tokens from MASTER.

**When to persist:**
- After a Design System Audit produces design decisions
- After a UX Recommendation calibrates design metrics
- When the user explicitly requests "save these design decisions"

**Cross-session consistency:** On subsequent runs, check for `design-system/MASTER.md` first. If it exists, read it before making recommendations to calibrate against existing decisions. Flag any conflicts between new recommendations and persisted decisions.

---

## Product-Design Bridge Mode

When feature specs exist (from `/product-manager`), enrich them with UX detail:

### Process

1. **Read feature spec** — Parse the feature file from `features/`
2. **Identify UX gaps** — What interaction details are missing from the spec?
3. **Propose additions** — UX-testable acceptance criteria, state specifications, interaction patterns
4. **Invoke `/product-manager` incremental update** — Use the `/product-manager` skill to persist UX enrichments directly into feature files, roadmap, and changelog. Do not merely format changes — actively invoke the skill to write them.

### Bridge Output Format

```markdown
## Design Bridge: [Feature Name]

### UX Acceptance Criteria (to add)
- [ ] [UX-testable criterion — describes user experience, not implementation]

### State Specifications (to add to Technical Approach)
- **[State]:** [What the user sees and can do]

### Interaction Patterns (to add to Technical Approach)
- **[Pattern]:** [Description and rationale]

### Design Dependencies
- [Components that need to exist or be modified]
- [Design tokens that need to be defined]
```

**Persistence:** This mode's output is already formatted for product-manager consumption. After presenting the bridge output, invoke `/product-manager` incremental update to write UX acceptance criteria, state specifications, and interaction patterns directly into the feature file, and update roadmap if design dependencies affect build order.

---

## Persist to Product Backlog

**Every frontend-designer mode must persist its findings.** After completing any mode and presenting output to the user, invoke `/product-manager` to capture recommendations in the product backlog. Recommendations that only exist in conversation are lost when the session ends.

### Persistence Routing Table

| Mode | Output Type | Product-Manager Action |
|------|-------------|----------------------|
| **Design Review** | Critical/Important issues on released features | Update `features/<name>.md` acceptance criteria with UX fixes; add changelog entry under "Design Review" |
| **Design Review** | Issues requiring new work | Create/append to `ideas/ux-improvements.md` |
| **UX Recommendation** | Strategy for a planned feature | Update `features/<name>.md` Technical Approach + Acceptance Criteria with UX specs; update roadmap if design dependencies change build order |
| **UX Recommendation** | Strategy for a new concept (no feature file) | Create new idea in `ideas/` then run `/product-manager` grooming |
| **Design Deliverable** | Component Inventory gaps | Add missing components as acceptance criteria on relevant feature files |
| **Design System Audit** | Drift issues | Create/update `ideas/design-system-fixes.md` with remediation items; if severity is high, flag for dedicated feature |
| **Product-Design Bridge** | UX enrichments | Invoke `/product-manager` incremental update directly (output is already formatted compatibly) |

### Invocation Pattern

After presenting mode output, run:
1. Determine which feature files or idea files are affected
2. Invoke `/product-manager` with the incremental update workflow
3. Confirm to the user which files were updated

---

## Pattern Library

Reference catalog of interaction patterns organized by task type:

### Data Display
- **Table with inline editing** — For power users managing structured data
- **Card grid** — For visual/scannable content (use sparingly per `/taste` anti-card rule)
- **List with expandable detail** — For sequential review workflows
- **Dashboard with key metrics** — For monitoring and status overview

### Data Input
- **Inline editing** — For frequent, small edits (click-to-edit)
- **Modal form** — For focused, multi-field creation
- **Wizard / stepper** — For complex, multi-stage input
- **Command palette** — For keyboard-first power users

### Navigation
- **Sidebar + content** — For deep hierarchies with frequent switching
- **Tab bar** — For 3-7 peer-level sections
- **Breadcrumb trail** — For deep, linear hierarchies
- **Search-first** — For large, flat content collections

### Feedback
- **Toast notification** — For non-blocking success/info messages
- **Inline validation** — For form fields (validate on blur, not on keystroke)
- **Progress indicator** — For multi-step or long-running operations
- **Optimistic update** — For low-risk actions where speed matters

---

## Guidelines

- **Strategy before pixels** — Always define the UX rationale before recommending visual solutions
- **Persona-grounded** — Every recommendation ties back to who is using the interface and why
- **Measurable** — Prefer UX criteria that can be tested ("user can complete task in 3 clicks") over subjective opinions ("looks clean")
- **Skill boundaries** — Do not generate component code (that's `/frontend-design`). Do not enforce Tailwind rules (that's `/taste`). Do not write feature specs (that's `/product-manager`). Recommend, specify, and review.
- **Cross-reference** — When recommending design metric values, always reference the coordination table and explain the rationale
- **Incremental** — When adding UX detail to existing feature specs, use the product-manager's Incremental Update Workflow format
- **Persist, don't just present** — Every recommendation must flow into the product backlog. After completing any mode, invoke `/product-manager` incremental update to capture findings in feature files, roadmap, and changelog. Recommendations that only exist in conversation are lost.
