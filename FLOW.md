# Development Lifecycle

Vibe coding high-quality products with Claude Code — from idea to shipped feature.

## Session Start Checklist

1. Read this file and `CLAUDE.md` for process + project context
2. Check `features/roadmap.md` for current priorities and status
3. Scan recent git log (`git log --oneline -10`) for in-progress work
4. Resume any incomplete feature, or pick the next one from the roadmap

## Lifecycle Phases

| Phase | Skill(s) | Recommended Gate |
|-------|----------|-----------------|
| **Ideate** | `/capture` + brainstorming → `ideas/` | Ideas refined to epic-level spec |
| **Specify** | `/product-manager` | Feature spec with acceptance criteria in `features/` |
| **Design** | `/frontend-designer` | UX criteria + interaction specs added to feature |
| **Build** | `/frontend-design` + `/taste` + `/refer` | Feature renders without errors, guardrails pass |
| **Verify** | `/quality-manager` + `/code-review` | Tests pass, coverage meets tier thresholds |
| **Evaluate** | `/quality-manager` (browser mode) | Acceptance criteria verified in running app |
| **Ship** | `/product-manager` (ship verify) + `/commit` | AC verified, frontmatter synced, changelog updated, commit pushed |

### Gate Philosophy

Gates are **recommended checkpoints**, not hard blockers. Skip gates when speed matters
(quick fixes, spikes), but always hit Verify + Evaluate for user-facing features.

## Cross-Skill Coordination

Key handoff patterns between skills:

- **product-manager → frontend-designer**: Feature specs flow into UX enrichment (interaction specs, user flows)
- **frontend-designer → taste**: Design decisions produce tunable metrics (variance, motion, density)
- **frontend-design + taste**: Co-trigger on builds — creative direction + engineering guardrails
- **quality-manager → code-review**: QM orchestrates, delegates code review as a sub-workflow
- **quality-manager ↔ product-manager**: Test gaps surface new specs; acceptance criteria become test cases
- **capture → ideas/**: Scraped articles and research feed Ideate with YAML frontmatter metadata
- **capture → refer**: Doc-site captures in `.claude/reference/` become searchable via `/refer` during Build/Design
- **supervisor → all skills**: Reads project state holistically, recommends which phase/skill to invoke next

Each skill's `SKILL.md` has a Role Boundaries table showing exactly when to use it vs. another.

## Plan-First Pattern

For non-trivial features (multi-file, new architecture, cross-cutting concerns):

1. **Explore** — Read relevant source files, understand current patterns
2. **Design** — Draft approach, identify files to create/modify
3. **Plan** — Enter plan mode, write implementation steps
4. **Build** — Execute the plan, phase by phase

## Reference & Meta Skills

| Skill | When | What it produces |
|-------|------|-----------------|
| `/capture <url>` | Ideate: scrape ideas | `ideas/<article>.md` with YAML frontmatter |
| `/capture <url>` | Any: build reference library | `.claude/reference/<lib>/` with search-index.md |
| `/refer` | Build/Design: look up docs | Surgical answers from captured references |
| `/skill-creator` | Meta: evolve the lifecycle | New or improved skill definitions |
| `/code-review` | Verify: standalone reviews | Usually delegated by `/quality-manager` |
| `/supervisor` | Meta: project health + next steps | `features/supervisor-report.md` |
| `/worktree-production` | Dogfooding: run app in worktree | Setup, sync, seed, migration rules |

## Feedback Loops

Evaluate findings route back into earlier phases:

- **UX issues** → return to Design (refine interaction specs)
- **Test gaps** → return to Specify (add missing acceptance criteria)
- **Code quality** → return to Build (refactor, fix guardrail violations)
- **Feature gaps** → return to Ideate (capture new ideas in `ideas/`)

## Directory Map

| Directory | Purpose |
|-----------|---------|
| `ideas/` | Raw ideas + `/capture`d articles with frontmatter |
| `features/` | Structured feature specs + `roadmap.md` + `changelog.md` |
| `.claude/skills/` | All skill definitions (14 skills) |
| `.claude/reference/` | Captured docs — populate via `/capture`, look up via `/refer` |
| `bin/sync-worktree.sh` | Worktree sync script — rebase + conditional `npm install` |
