---
name: doc-generator
description: Generate and maintain product documentation from code, feature specs, and screengrabs. Produces user journey guides for 4 personas (Personal, Work, Power User, Developer) and per-feature reference docs with embedded screenshots. Outputs to docs/ with YAML frontmatter and manifest.json for future UI consumption. Incremental — detects changes and regenerates only affected docs. Triggers on "generate docs", "update docs", "doc-generator", "write documentation", "create user guides", "build feature reference", "document the product", "docs for personas", "journey guide", "update documentation", or documentation generation requests. Also triggers when user says "docs for [section]" targeting a single app section.
---

# Doc Generator Skill

Synthesize product documentation from code, feature specs, and screengrabs. Produces structured markdown with YAML frontmatter for future UI consumption.

**Input sources:** `features/` specs, `screengrabs/manifest.json`, `src/components/shared/app-sidebar.tsx`, component `page.tsx` files, `README.md`, `AGENTS.md`

**Output:** `docs/` folder with feature reference docs, user journey guides, index, getting-started, and manifest.json

---

## Phase 1: Setup & Mode Detection

Determine generation mode from user request:

| Trigger | Mode |
|---------|------|
| "full docs", "regenerate all", "docs from scratch" | **full** |
| "journey guides", "persona docs" | **journeys-only** |
| "feature reference", "feature docs" | **features-only** |
| "docs for /workflows", "document the dashboard" | **single** |
| "update readme", "regenerate readme" | **readme-only** |
| "update docs", "generate docs" (default) | **incremental** |

### Setup Steps

1. Create output directories:
   ```bash
   mkdir -p docs/journeys docs/features
   ```

2. Read core artifacts:
   - `README.md` — project overview, CLI usage
   - `features/roadmap.md` — completed feature inventory
   - `features/changelog.md` — change history for incremental detection
   - `AGENTS.md` — project context and architecture

3. Check for `screengrabs/manifest.json`:
   - **If missing or stale** (older than `features/changelog.md` latest entry) → **auto-invoke `/screengrab`** to generate fresh captures and manifest
   - **If fresh** → proceed with manifest data
   - This ensures docs always have up-to-date screenshots without requiring manual coordination

---

## Phase 2: Inventory Scan

### 2a. Feature Spec Scan

For each completed feature in `features/roadmap.md`:
1. Read `features/{slug}.md`
2. Extract: title, description, user story, route(s), key UI elements
3. Classify by app section (map feature routes → section slugs)

### 2b. Screengrab Inventory

1. Read `screengrabs/manifest.json` if available
2. If manifest missing, fall back to listing `screengrabs/*.png` and parsing filenames
3. Build map: `page-slug → [screenshot entries]`
4. Prefer `screengrabs/` over `output/screengrabs/`

### 2c. Route Scan

1. Read `src/components/shared/app-sidebar.tsx`
2. Extract `navItems` array — each has label, href, icon
3. Map routes to page slugs (e.g., `/dashboard` → `dashboard`)

### 2d. Component Context

For each section, read the primary files to extract context:
- `src/app/{route}/page.tsx` — page structure, data queries
- Main component file (first import from `src/components/{section}/`) — actions available, tabs/views

**Lightweight** — only 2 files per section max. Extract: data displayed, actions available, tabs/views.

**Cross-cutting component context:** Additionally, read these shared component files to understand the design system primitives used across all surfaces:
- `src/components/shared/status-chip.tsx` — 5 status families (lifecycle, governance, runtime, risk, schedule)
- `src/components/shared/filter-bar.tsx` — horizontal filter controls with active count badge
- `src/components/shared/view-switcher.tsx` — saved view states per surface
- `src/components/shared/page-shell.tsx` — unified page layout wrapper
- `src/components/shared/detail-pane.tsx` — URL-driven 420px right-rail detail panel
- `src/components/shared/trust-tier-badge.tsx` — sidebar footer trust tier popover

Note their props and behavior for inclusion in cross-cutting feature docs (Design System, Shared Components, Keyboard & Navigation).

### 2e. Documentation Matrix

Cross-reference all inventories into a matrix:

| Section | Features | Screenshots | Route | Components Read |
|---------|----------|-------------|-------|-----------------|

This matrix drives all subsequent generation phases.

---

## Phase 3: Incremental Detection

1. Check for `docs/.last-generated` timestamp:
   ```bash
   cat docs/.last-generated 2>/dev/null
   ```

2. If exists and mode is **incremental**:
   a. Read `features/changelog.md` for entries after timestamp
   b. Map changed features → affected sections
   c. Check `screengrabs/.last-run` freshness
   d. Build list of sections needing regeneration

3. If **no changes** detected → log "No documentation changes needed" → skip to Phase 8

4. If `.last-generated` missing or mode is **full** → regenerate everything

---

## Phase 4: Feature Reference Generation

**Book integration note:** Book chapters in `book/chapters/*.md` now contain `> [!case-study]` callouts referencing `ai-native-notes/` source files and "Building with Stagent" API examples. When regenerating feature docs, cross-reference book chapters but do not duplicate case study narrative. Feature docs should focus on implementation details; book chapters provide the narrative context.

Generate docs for 11 app sections + 3 cross-cutting feature groups:

| Section | Doc File | Route |
|---------|----------|-------|
| Home | `docs/features/home-workspace.md` | `/` |
| Dashboard | `docs/features/dashboard-kanban.md` | `/dashboard` |
| Inbox | `docs/features/inbox-notifications.md` | `/inbox` |
| Monitor | `docs/features/monitoring.md` | `/monitor` |
| Projects | `docs/features/projects.md` | `/projects` |
| Workflows | `docs/features/workflows.md` | `/workflows` |
| Documents | `docs/features/documents.md` | `/documents` |
| Profiles | `docs/features/profiles.md` | `/profiles` |
| Schedules | `docs/features/schedules.md` | `/schedules` |
| Cost & Usage | `docs/features/cost-usage.md` | `/costs` |
| Settings | `docs/features/settings.md` | `/settings` |
| User Guide | `docs/features/user-guide.md` | `/user-guide` |
| Provider Runtimes | `docs/features/provider-runtimes.md` | cross-cutting |
| Agent Intelligence | `docs/features/agent-intelligence.md` | cross-cutting |
| Tool Permissions | `docs/features/tool-permissions.md` | cross-cutting |
| Design System | `docs/features/design-system.md` | cross-cutting |
| Keyboard & Navigation | `docs/features/keyboard-navigation.md` | cross-cutting |
| Shared Components | `docs/features/shared-components.md` | cross-cutting |

### Per-Section Doc Template

```markdown
---
title: "{Section Name}"
category: "feature-reference"
section: "{section-slug}"
route: "{primary-route}"
tags: [...]
features: ["{feature-slug-1}", ...]
screengrabCount: {N}
lastUpdated: "{ISO date}"
---

# {Section Name}

{Overview synthesized from feature specs — user-facing language, no internal jargon}

## Screenshots

![{alt text}](../screengrabs/{file}.png)
*{Caption}*

## Key Features

### {Feature Name}
{Description rewritten for end users}

## How To

### {Action — e.g., "Create a New Task"}
1. Step-by-step from form fields + acceptance criteria
2. ...

## Related
- [{Related section}](./{related-doc}.md)
```

### Content Rules

- **Rewrite** technical specs into user-facing language (no P1, SDK, Drizzle, ORM, etc.)
- **Only embed screenshots** that exist in the inventory (max 6 per doc)
- **Use relative paths**: `../screengrabs/{filename}` for images (the user guide viewer resolves these to GitHub raw URLs at runtime; `public/readme/` is excluded from the npm package)
- **Derive How-To steps** from component form fields + spec acceptance criteria
- **Never overwrite** docs with `manual: true` in frontmatter
- **Cross-cutting docs** (Provider Runtimes, Agent Intelligence, Tool Permissions) aggregate content from multiple sections and reference those section docs

### Screenshot Type Embedding Rules

Different screenshot types serve different documentation purposes. Use this mapping when deciding which screenshots to embed in each feature reference doc:

- `blueprints` view → embed in workflow docs to show template gallery
- `permissions` tab view → embed in inbox/governance docs
- `detail` views (profiles, schedules, documents) → embed in their respective feature docs as the primary "what it looks like" image
- `card-edit` view → embed in task/dashboard docs showing inline editing
- `bulk-select` view → embed in task/dashboard docs showing batch operations
- `workflow-confirm` view → embed in workflow docs showing AI-assisted creation flow
- `create-form-filled` views → embed in feature docs showing the creation experience

---

## Phase 4.5: Journey Coverage Analysis

Before generating or updating journey guides, analyze which features and screenshots lack journey representation. This ensures every completed feature appears in at least one user guide.

### 4.5a. Build Feature-to-Journey Map

For each existing journey file in `docs/journeys/*.md`:
1. Extract all screenshot references (`../screengrabs/{file}.png`)
2. Map each screenshot → its tagged features via `screengrabs/manifest.json`
3. Build a set of features represented in each journey

### 4.5b. Build Screenshot-to-Journey Map

For each screenshot in `screengrabs/manifest.json`:
1. Check if it's referenced in at least one journey file
2. Flag unreferenced screenshots as candidates for journey insertion

### 4.5c. Compute Coverage Gaps

For each completed feature in `features/roadmap.md`:
1. Check if it appears in the feature-to-journey map from 4.5a
2. Features with zero journey coverage → **coverage gap**
3. Group gaps by feature category (from roadmap section headers)

### 4.5d. Map Gaps to Personas

Use this decision matrix to assign uncovered features to the most appropriate journey persona:

| Feature Category | Primary Persona | Secondary Persona |
|-----------------|----------------|-------------------|
| Foundation/Core | Personal Use | — |
| Documents | Work Use | — |
| Agent Intelligence | Power User | — |
| Agent Profiles | Power User | Developer |
| UI Enhancement | Personal Use | Work Use |
| Platform/Runtime | Developer | — |
| Governance/Cost | Work Use | Developer |
| Environment | Developer | — |
| Chat | Personal Use | Work Use |
| Workflows | Power User | Work Use |
| Schedules | Power User | Work Use |
| Runtime Quality | Developer | — |

### 4.5e. Coverage Report

Output a summary consumed by Phase 5:

```
### Journey Coverage Analysis

| Metric | Value |
|--------|-------|
| Total completed features | N |
| Features with journey coverage | M |
| Features without journey coverage | K |
| Screenshots referenced in journeys | X / Y |

#### Coverage Gaps by Persona

| Persona | Features to Add | Screenshots to Embed |
|---------|----------------|---------------------|
| Personal Use | [list] | [list] |
| Work Use | [list] | [list] |
| Power User | [list] | [list] |
| Developer | [list] | [list] |
```

If `docs/.coverage-gaps.json` exists from a previous `/user-guide-sync` run, read it and merge those findings into this analysis rather than duplicating effort.

---

## Phase 5: User Journey Generation

Before generating journeys, read the coverage analysis from Phase 4.5. In incremental mode, focus journey updates on the features and screenshots identified as coverage gaps. In full mode, ensure the generated journeys collectively cover all features and screenshots.

Generate 4 journey guides in `docs/journeys/`:

| Persona | File | Difficulty | Theme | Sections |
|---------|------|-----------|-------|----------|
| Personal Use | `personal-use.md` | beginner | Solo productivity: create project → add tasks → track progress → review | Home, Dashboard, Projects |
| Work Use | `work-use.md` | intermediate | Team context: organize projects → manage documents → schedule automations → track costs → handle approvals | Projects, Documents, Schedules, Costs, Inbox |
| Power User | `power-user.md` | advanced | Advanced: custom profiles → build workflows → blueprints → autonomous loops → monitor execution | Profiles, Workflows, Schedules, Monitor |
| Developer | `developer.md` | advanced | Technical: CLI setup → auth config → provider runtimes → API integration → extending profiles | Settings, Monitor, Profiles, CLI |

**Additional interaction coverage per persona** — each journey should demonstrate these new UX patterns where they naturally fit:

| Persona | Additional Interactions to Cover |
|---------|--------------------------------|
| Personal Use | Command Palette for quick navigation, density toggle for task list customization |
| Work Use | FilterBar on documents, trust tier management via sidebar popover, saved views |
| Power User | Keyboard shortcuts, command palette power usage, custom saved views, detail pane right-rail |
| Developer | Settings subsection walkthrough (auth, runtime, presets, permissions), API route references |

### Journey Template

```markdown
---
title: "{Persona} Guide"
category: "user-journey"
persona: "{slug}"
difficulty: "beginner|intermediate|advanced"
estimatedTime: "{N} minutes"
sections: [...]
tags: [...]
lastUpdated: "{ISO date}"
---

# {Persona} Guide

{Narrative intro — who this persona is, what they want to accomplish}

## Prerequisites
- {What they need before starting}

## Journey Steps

### Step 1: {Action}
{Narrative paragraph explaining context and goal}

![{Description}](../screengrabs/{file}.png)

1. Navigate to **{Section}**
2. Click **{Button}**
3. ...

> **Tip:** {Contextual tip from feature spec or component behavior}

### Step 2: ...

## What's Next
- [Next journey](./{file}.md)
- [Feature deep-dive](../features/{file}.md)
```

### Journey Rules

- **8-15 steps** per journey
- **At least 3 screenshots** per journey
- **Narrative flow** — tell a story, don't list features
- **Prefer `journey-*.png` screenshots** when available from screengrab captures
- **Never duplicate** the same image within a single journey
- **Estimate time** based on step count: ~2 min per step
- **Every completed feature** from the roadmap MUST appear in at least one journey guide
- **Every screenshot** in `screengrabs/manifest.json` MUST be referenced in at least one journey
- Coverage gaps from Phase 4.5 MUST be resolved during journey generation
- When adding features to journeys, insert steps at **narratively appropriate positions** (not appended to the end)
- After generating all journeys, **re-run coverage check** to confirm 100% feature and screenshot coverage
- Log a **WARNING** if any feature or screenshot still lacks journey coverage after generation

### Persona Data Profiles

Use these consistent persona identities across all journey guides. The same names and projects appear in screengrab form data, ensuring screenshots and journey text match.

| Persona | Name | Role | Project | Typical Task | Description Theme |
|---------|------|------|---------|-------------|-------------------|
| Personal | Alex | Solo developer | "Side Project Tracker" | "Refactor auth module" | Solo dev productivity |
| Work | Jordan | Team lead | "Q2 Marketing Campaign" | "Review brand guidelines doc" | Team collaboration |
| Power User | Sam | DevOps engineer | "ML Pipeline Orchestrator" | "Train model v3.2 with new dataset" | Complex automation |
| Developer | Riley | Platform engineer | "Stagent Plugin Dev" | "Add custom tool integration" | API/CLI/extension |

Reference these personas by name in journey narrative text (e.g., "Alex creates a new project called 'Side Project Tracker'...").

### Journey Screenshot Hints for New Captures

When embedding the newer screenshot types into journey guides, use this mapping to determine which persona journey each screenshot belongs to and what step context to provide:

| Screenshot | Journey Persona | Step Context |
|---|---|---|
| `profiles-detail.png` | Developer | "Browse agent profiles and inspect capabilities" |
| `profiles-create-form-filled.png` | Developer | "Create a custom agent profile" |
| `workflows-blueprints.png` | Work | "Browse workflow blueprints for team processes" |
| `dashboard-workflow-confirm.png` | Power User | "Convert complex tasks into multi-step workflows via AI Assist" |
| `dashboard-card-edit.png` | Personal | "Quick-edit task details from the kanban board" |
| `dashboard-bulk-select.png` | Power User | "Batch-queue multiple tasks for execution" |
| `inbox-permissions.png` | Work | "Review and approve agent permission requests" |
| `schedules-detail.png` | Power User | "Monitor schedule firing history and next run" |
| `documents-detail.png` | Work | "View document metadata and extracted content" |

---

## Phase 6: Index & Navigation

### 6a. `docs/index.md`

Hub document linking all journeys and features:

```markdown
---
title: "Stagent Documentation"
category: "index"
lastUpdated: "{ISO date}"
---

# Stagent Documentation

{One-paragraph product overview from README}

## Getting Started
- [Quick Start Guide](./getting-started.md)

## User Journeys

| Guide | Difficulty | Time | Description |
|-------|-----------|------|-------------|
| [Personal Use](./journeys/personal-use.md) | Beginner | ~20 min | Solo productivity |
| ... |

## Feature Reference

| Section | Route | Features |
|---------|-------|----------|
| [Home & Workspace](./features/home-workspace.md) | `/` | ... |
| ... |
```

### 6b. `docs/getting-started.md`

Quick start guide synthesized from:
- `README.md` — installation + CLI commands
- App shell spec — first-run experience
- Settings spec — initial configuration

```markdown
---
title: "Getting Started"
category: "getting-started"
lastUpdated: "{ISO date}"
---

# Getting Started

## Installation
{From README}

## First Run
{From app-shell + CLI specs}

## Configuration
{From settings spec}
```

### 6c. `docs/manifest.json`

Machine-readable index for future `/docs` UI route:

```json
{
  "generated": "ISO-timestamp",
  "version": 1,
  "sections": [{
    "slug": "dashboard-kanban",
    "title": "Dashboard & Kanban",
    "category": "feature-reference",
    "path": "features/dashboard-kanban.md",
    "route": "/dashboard",
    "tags": ["kanban", "tasks"],
    "features": ["task-board"],
    "screengrabCount": 4
  }],
  "journeys": [{
    "slug": "personal-use",
    "title": "Personal Use Guide",
    "persona": "personal",
    "difficulty": "beginner",
    "path": "journeys/personal-use.md",
    "sections": ["home-workspace", "dashboard-kanban", "projects"],
    "stepCount": 10
  }],
  "metadata": {
    "totalDocs": 25,
    "totalScreengrabs": 50,
    "featuresCovered": 50,
    "appSections": 12
  }
}
```

---

## Phase 7: README Generation

README reflects the latest docs content since it runs after all doc phases complete. In **readme-only** mode, skip Phases 2-6 and run this phase directly.

### Data Sources

Read these files to generate README content:
- `features/roadmap.md` — milestone status, feature list, what's next
- `features/changelog.md` — recent completions for "what's new"
- `CLAUDE.md` — tech stack, quick start commands, architecture summary
- `features/*.md` — individual feature descriptions (frontmatter `status` field)
- `package.json` — project name, version, description
- `.claude/reference/stagent-io-about/` — captured snapshot of https://stagent.io/about/, used verbatim as the `## About Author` section body (rename `### Why Stagent` → `### Research Premise` to avoid colliding with the top-level `## Why Stagent` heading). If the snapshot is missing, invoke `/capture https://stagent.io/about/` before continuing.

### README Structure

Generate `README.md` using the **pyramid principle** — most important information first, progressive detail below. The README serves as the GitHub landing page: hook readers fast, give them a CTA, then reward scrolling with depth.

**Above the fold (first ~50 lines — hook + CTA):**

```
# Project Name
> Compelling tagline — benefit-oriented, not feature-oriented

Status badges (build, version, license, tech stack)

## Why Project Name
2-3 sentences: what pain this solves, who it's for, why it's different.
Not a generic problem statement — specific value proposition.

## Quick Start
Copy-paste-ready installation + first run. This is the CTA.
Minimal steps, no prerequisites wall. Get running in <60 seconds.

## Feature Highlights
Top 5-6 features as a visual grid/table:
| Icon | Feature | One-liner |
Each links to a detail section or doc below the fold.
```

**Below the fold (progressive detail for engaged readers):**

```
## About Author
Insert the content of `.claude/reference/stagent-io-about/` verbatim,
wrapped in `<!-- ABOUT:BEGIN source=https://stagent.io/about/ -->` and
`<!-- ABOUT:END -->` sync markers. Always sits immediately after
`## Why Stagent` and before `## Runtime Bridge` / `## Architecture`.

## Architecture
How It Works diagram (code block or mermaid), rendering pattern,
data flow, key design decisions. Product-facing, not developer-jargon.

## Feature Deep Dives
Grouped by domain (e.g., Core, Agent, UI, DevEx).
Each group: brief intro + feature descriptions.
Derived from completed/in-progress features in roadmap + feature specs.

## Tech Stack
Detailed stack with versions and brief rationale for key choices.
Badge-style or table format. Derived from CLAUDE.md.

## Development
Setup, testing commands, CLI usage, project structure overview.
For contributors and developers evaluating the codebase.

## Roadmap
Current milestone, what's next, what's planned.
Condensed view of features/roadmap.md.

## Contributing + License
```

### Rules

- **No arbitrary line limit** — README should be as long as the project deserves, but every section must earn its place
- **Progressive disclosure** — Hero + value prop + Quick Start + feature highlights must appear in the first ~50 lines
- **Pyramid principle** — Most important information first in every section; details follow
- **Scannable structure** — Use tables, badges, code blocks, and visual hierarchy (not walls of text). No section should be a wall of prose
- **Link don't repeat** — For deep details, link to `docs/` and `features/` docs rather than inlining everything
- **No duplicating CLAUDE.md content verbatim** — summarize for an external audience (CLAUDE.md is for developers IN the codebase; README is for people discovering the product)
- **Features section** only includes completed or in-progress features (not planned)
- **Roadmap section** shows high-level milestones, not individual feature specs
- Re-generate on each doc-generator run to keep README current with every release
- Use emoji icons sparingly in the Features section for visual scanning
- Quick Start should be copy-paste-ready (minimal steps to get running)
- **No subscription/pricing content** — Stagent is 100% Community Edition (Apache 2.0) with all features free and unlimited. Do NOT generate subscription tiers, pricing tables, soft limits, "Premium" sections, or upgrade CTAs. If feature specs still reference tiers, ignore those references in README output
- **About section is always present** — every generated README must include a `## About Author` section sourced from `.claude/reference/stagent-io-about/`, wrapped in `<!-- ABOUT:BEGIN source=https://stagent.io/about/ -->` … `<!-- ABOUT:END -->`. Placement is locked: immediately after `## Why Stagent`, before `## Runtime Bridge` / `## Architecture`. Do not paraphrase the captured content; only rename `### Why Stagent` → `### Research Premise` to avoid colliding with the top-level heading. If the captured reference is missing or empty, invoke `/capture https://stagent.io/about/` before writing README and abort README regeneration if capture fails

### Steps

1. **Read current state** — scan roadmap, changelog, CLAUDE.md, and feature frontmatter
2. **Identify completed/in-progress features** — only these appear in the Features section; group by domain
3. **Summarize architecture** — translate CLAUDE.md's developer-facing architecture into a product-facing "How It Works" overview
4. **Generate README.md** — write or overwrite the file following the pyramid structure above
4a. **Inject About section** — read `.claude/reference/stagent-io-about/` (invoking `/capture https://stagent.io/about/` first if missing), rename the `### Why Stagent` subheading to `### Research Premise`, and splice the result between `<!-- ABOUT:BEGIN source=https://stagent.io/about/ -->` and `<!-- ABOUT:END -->` markers immediately after the `## Why Stagent` section
5. **Verify progressive disclosure** — confirm hero + value prop + Quick Start + feature highlights appear in the first ~50 lines
6. **Verify scannability** — ensure no section is a wall of text; every section uses tables, lists, or code blocks
7. **Log in changelog** — add a "README updated" entry if part of a Ship phase

---

## Phase 8: Completion

### 8a. Validate

1. **Image refs** — verify all `![...](../screengrabs/{file}.png)` point to existing files
2. **Cross-doc links** — verify all `[...](./...)` links resolve to existing docs
3. Log any broken references as warnings

### 8b. Coverage Report

Generate a table of sections × features covered × screenshots × journey references:

```
| Section | Features | Screenshots | Journeys | Status |
|---------|----------|-------------|----------|--------|
| Dashboard | 3/3 | 5 | Personal, Work | COMPLETE |
| Workflows | 2/2 | 3 | Power User | COMPLETE |
| Monitor | 1/1 | 2 | Power User, Dev | COMPLETE |
| ... | | | | |
```

### 8c. Gap Analysis

Report:
- Sections with **no screenshots** (need screengrab run)
- Features **not covered** in any doc (need spec review)
- Journeys **missing screenshots** (need targeted captures)

### 8d. Write Timestamp

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ" > docs/.last-generated
```

### 8e. Update Manifest

Write `docs/manifest.json` with final counts from the generation run.

### 8f. Summary

Report:
- Total files generated/updated
- Section count
- Journey count (with persona names)
- Gap list (if any)
- README updated (yes/no)
- Incremental note (if applicable): "Updated N sections, skipped M unchanged"

---

## Error Recovery

| Scenario | Action |
|---|---|
| Feature spec file not found | Skip feature, note in gap analysis |
| No screengrabs for section | Generate doc without images, flag in gap analysis |
| Component file unreadable | Fall back to spec-only content |
| Manual edit detected (`manual: true` in frontmatter) | Never overwrite — skip with log message |
| Screengrab manifest missing | Fall back to filename-based inference |
| Screengrab manifest stale | Auto-invoke `/screengrab` before proceeding |
| Cross-doc link broken | Log warning, continue generation |
| Image ref broken | Log warning, remove image from doc |

---

## Naming Convention

```
docs/
├── index.md                          # Hub with navigation tables
├── getting-started.md                # Quick start guide
├── manifest.json                     # Machine-readable index for UI
├── .last-generated                   # ISO timestamp of last run
├── features/
│   ├── home-workspace.md             # Home / route
│   ├── dashboard-kanban.md           # Dashboard + kanban
│   ├── inbox-notifications.md        # Inbox + notifications
│   ├── monitoring.md                 # Monitor page
│   ├── projects.md                   # Projects management
│   ├── workflows.md                  # Workflow builder
│   ├── documents.md                  # Document management
│   ├── profiles.md                   # Agent profiles
│   ├── schedules.md                  # Scheduled prompts
│   ├── cost-usage.md                 # Cost & usage tracking
│   ├── settings.md                   # Settings & configuration
│   ├── provider-runtimes.md          # Cross-cutting: provider runtimes
│   ├── agent-intelligence.md         # Cross-cutting: AI features
│   ├── tool-permissions.md           # Cross-cutting: tool permissions
│   ├── design-system.md              # Cross-cutting: Calm Ops design system
│   ├── keyboard-navigation.md        # Cross-cutting: command palette + shortcuts
│   ├── shared-components.md          # Cross-cutting: reusable component library
│   └── user-guide.md                   # User Guide documentation system
└── journeys/
    ├── personal-use.md               # Beginner persona
    ├── work-use.md                   # Intermediate persona
    ├── power-user.md                 # Advanced persona
    └── developer.md                  # Developer persona
```

---

## Checklist

- [ ] Mode determined (full/incremental/journeys-only/features-only/single)
- [ ] Core artifacts read (README, roadmap, changelog, AGENTS.md)
- [ ] Feature specs scanned and classified by section
- [ ] Screengrab inventory built (manifest.json or filename inference)
- [ ] Routes extracted from app-sidebar.tsx
- [ ] Component context read per section
- [ ] Documentation Matrix assembled
- [ ] Incremental detection completed
- [ ] Feature reference docs generated (18 files including 4 new cross-cutting docs)
- [ ] Screenshots embedded with valid paths and captions
- [ ] User journey guides generated (4 personas)
- [ ] Journey steps include narrative flow + screenshots
- [ ] Getting Started guide generated
- [ ] Index.md generated with navigation tables
- [ ] manifest.json generated for future UI
- [ ] All image refs validated
- [ ] All cross-doc links validated
- [ ] README.md generated/updated
- [ ] README.md `## About Author` section present and matches `.claude/reference/stagent-io-about/` (modulo the `Why Stagent` → `Research Premise` rename)
- [ ] Coverage report generated
- [ ] Cross-cutting docs generated (Design System, Keyboard Navigation, Shared Components, User Guide)
- [ ] Persona data profiles defined and used consistently in journeys
- [ ] New shared component screenshots embedded in cross-cutting docs
- [ ] Journey guides reference Command Palette, density toggle, view switching, trust tiers
- [ ] `.last-generated` timestamp written
