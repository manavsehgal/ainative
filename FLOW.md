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
| **Ideate** | Manual brainstorming → `ideas/` | Ideas refined to epic-level spec |
| **Specify** | `/product-manager` | Feature spec with acceptance criteria in `features/` |
| **Design** | `/frontend-designer` | UX criteria + interaction specs added to feature |
| **Build** | `/frontend-design` + `/taste` | Feature renders without errors, guardrails pass |
| **Verify** | `/quality-manager` + `/code-review` | Tests pass, coverage meets tier thresholds |
| **Evaluate** | `/quality-manager` (browser mode) | Acceptance criteria verified in running app |
| **Ship** | `/product-manager` + `/commit` | Changelog + roadmap updated, commit pushed |

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

Each skill's `SKILL.md` has a Role Boundaries table showing exactly when to use it vs. another.

## Plan-First Pattern

For non-trivial features (multi-file, new architecture, cross-cutting concerns):

1. **Explore** — Read relevant source files, understand current patterns
2. **Design** — Draft approach, identify files to create/modify
3. **Plan** — Enter plan mode, write implementation steps
4. **Build** — Execute the plan, phase by phase

## Support Skills

| Skill | Purpose |
|-------|---------|
| `/capture` + `/refer` | Scrape and look up external docs during Build |
| `/skill-creator` | Create or improve skills — evolve the lifecycle itself |
| `/code-review` | Standalone reviews (usually delegated by `/quality-manager`) |

## Feedback Loops

Evaluate findings route back into earlier phases:

- **UX issues** → return to Design (refine interaction specs)
- **Test gaps** → return to Specify (add missing acceptance criteria)
- **Code quality** → return to Build (refactor, fix guardrail violations)
- **Feature gaps** → return to Ideate (capture new ideas in `ideas/`)

## Directory Map

| Directory | Purpose |
|-----------|---------|
| `ideas/` | Raw product ideas, research, vision docs |
| `features/` | Structured feature specs + `roadmap.md` + `changelog.md` |
| `.claude/skills/` | All skill definitions (12 skills) |
| `.claude/reference/` | Captured external documentation |
