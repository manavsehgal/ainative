# Stagent

AI-powered task management platform where Claude agents execute tasks with human-in-the-loop oversight.

## Quick Start

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build:cli    # Build CLI → dist/cli.js
npm test             # Run vitest
npm run test:coverage # Coverage report
```

## Tech Stack

- **Framework**: Next.js 16 + React 19 + TypeScript (strict)
- **Styling**: Tailwind CSS v4 + shadcn/ui (New York style) + OKLCH hue 250 theme
- **Database**: SQLite via better-sqlite3 + Drizzle ORM, WAL mode, at `~/.stagent/stagent.db`
- **Agent SDK**: @anthropic-ai/claude-agent-sdk with canUseTool polling pattern
- **Testing**: Vitest + Testing Library + jsdom
- **CLI**: Commander → tsup build → `dist/cli.js`

## Architecture

### Data Layer
- **Schema**: `src/lib/db/schema.ts` — 5 tables: projects, tasks, workflows, agent_logs, notifications
- **Types**: Use `ProjectRow`, `TaskRow`, etc. from schema (never `as any`)
- **Migrations**: Drizzle Kit in `src/lib/db/migrations/`
- **Path alias**: `@/*` maps to `./src/*`

### Rendering Pattern
- **Server Components** query the database directly (no API call)
- **API routes** exist only for client-side mutations
- **SSE** for log streaming via ReadableStream with poll loop

### Task Execution
- Fire-and-forget: `POST /api/tasks/[id]/execute` returns 202
- Notifications table acts as a message queue for human-in-the-loop (canUseTool polling)
- Status flow: planned → queued → running → completed/failed/cancelled
- Valid transitions defined in `src/lib/constants/task-status.ts`

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Home redirect |
| `/dashboard` | Project overview |
| `/projects` | Project management |
| `/inbox` | Human-in-the-loop notifications |
| `/monitor` | Agent log streaming |

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/projects/[id]` | Project CRUD |
| `/api/tasks/[id]/execute` | Fire-and-forget task execution |
| `/api/tasks/[id]/respond` | Human response to agent prompt |
| `/api/tasks/[id]/logs` | Task log history |
| `/api/logs/stream` | SSE log stream |
| `/api/notifications` | Notification CRUD |

## Code Conventions

### File Organization
- Components: `src/components/{domain}/` (tasks, projects, monitoring, notifications, shared, ui)
- Tests: `__tests__/` subdirectories adjacent to source files
- Validators: `src/lib/validators/`
- Constants: `src/lib/constants/`
- Utilities: `src/lib/utils/`

### Patterns
- Use Zod v4 for validation at system boundaries
- Use `crypto.randomUUID()` for IDs
- Timestamps as integers (Unix epoch) in SQLite, `{ mode: "timestamp" }` in Drizzle
- shadcn/ui components live in `src/components/ui/` — do not modify these directly
- Client components must have `"use client"` directive

### Testing
- Test files: `src/**/__tests__/**/*.test.{ts,tsx}`
- Coverage tiers: Critical 90%+ (validators) > High 75%+ (agents/API) > Medium 60%+ (components)
- Excluded from coverage: `src/components/ui/`, test files, type declarations, layout/error boundaries
- Setup file: `src/test/setup.ts`

## Development Lifecycle

See `FLOW.md` for the full lifecycle reference card — 7 phases from Ideate to Ship with skill coordination and feedback loops.

### Ship Checklist (per feature)
Before marking a feature `completed` in roadmap:
- [ ] Every acceptance criterion verified (code exists and works)
- [ ] Technical approach items reconciled (built or explicitly deferred)
- [ ] Feature spec frontmatter `status:` updated to match roadmap
- [ ] Changelog entry added with key deliverables
- [ ] Browser evaluation passed (user-facing features, via `/quality-manager`)

### Key Skills
- `/product-manager` — Feature specs, roadmap, changelog
- `/frontend-designer` — UX strategy, design review
- `/frontend-design` + `/taste` — Build with creative direction + engineering guardrails
- `/quality-manager` — Testing, coverage, code review orchestration, browser evaluation
- `/capture` + `/refer` — Documentation scraping and lookup

### Key Directories
- `ideas/` — Raw product ideas and research
- `features/` — Structured feature specs + `roadmap.md` + `changelog.md`
- `.claude/skills/` — All skill definitions (12 skills)
