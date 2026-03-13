# Stagent

> A governed AI agent operations workspace for running, supervising, and reusing AI work through projects, workflows, documents, profiles, schedules, inbox approvals, and live monitoring.

[![Download macOS Desktop](https://img.shields.io/badge/Download-macOS_Desktop-0a7cff?style=for-the-badge&logo=apple)](https://github.com/manavsehgal/stagent/releases/latest/download/Stagent.dmg) [![GitHub Releases](https://img.shields.io/github/v/release/manavsehgal/stagent?display_name=release&style=for-the-badge)](https://github.com/manavsehgal/stagent/releases/latest)

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/) [![React 19](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/) [![Claude Agent SDK](https://img.shields.io/badge/Claude-Agent_SDK-D97706)](https://docs.anthropic.com/) [![OpenAI Codex App Server](https://img.shields.io/badge/OpenAI-Codex_App_Server-10A37F)](https://developers.openai.com/codex/app-server) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

## Why Stagent

AI agents are powerful, but production deployment breaks down when teams cannot see what the agent is doing, understand which rules it is following, or intervene before an unsafe action lands. Stagent solves that operating problem.

Stagent is a local-first AI operations workspace built around governed execution and reusable automation primitives. Instead of treating every agent run as a one-off prompt, it gives teams a structured system of home workspace signals, execution dashboards, project context, workflow blueprints, reusable profiles, schedules, documents, inbox approvals, and live monitoring.

## Get Started

### Download Desktop for macOS

**Primary install path:** [Download the latest macOS desktop release](https://github.com/manavsehgal/stagent/releases/latest/download/Stagent.dmg)

Grab the latest `Stagent.dmg` or `Stagent.app.zip` asset from GitHub Releases, then move `Stagent.app` into `/Applications`.

Current desktop release notes:

- macOS-only for now
- unsigned build, so macOS may warn that the app is from an unidentified developer
- the current desktop wrapper expects `node` to be available on the machine

<img src="./output/playwright/home-playwright-after.png" alt="Stagent home workspace" width="1200" />

### Repository development

```bash
git clone <repo-url> && cd stagent && npm install

# Set up one or both runtime credentials
cat > .env.local <<'EOF'
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
EOF

# Start the dev server
npm run dev
```

Open [localhost:3000](http://localhost:3000) to get started.

## Feature Highlights

| | Feature | What it does |
|---|---------|-------------|
| 🏠 | **[Home Workspace](#home-workspace)** | Workspace briefing with active work, pending review, project signals, and live activity |
| 📌 | **[Task Execution](#task-execution)** | Status-driven execution board for planned, queued, running, completed, and failed work |
| 📁 | **[Projects](#projects)** | Portfolio-level organization with scoped context and working directories |
| 🔀 | **[Workflows](#workflows)** | Multi-step orchestration with sequence, planner-executor, and checkpoint patterns |
| 🧩 | **[Workflow Blueprints](#workflow-blueprints)** | Reusable templates for spinning up common automations quickly |
| 🧠 | **[Agent Profiles](#agent-profiles)** | Reusable specialist definitions with prompts, tool policy, and runtime tuning |
| ⏰ | **[Schedules](#schedules)** | Recurring and one-shot automations with cadence, expiry, and firing controls |
| 📄 | **[Documents](#document-management)** | Upload, preprocess, inspect, and link files to tasks and projects |
| 📥 | **[Human-in-the-Loop Inbox](#inbox--human-in-the-loop)** | Approve tool use, answer questions, and review results from one queue |
| 👀 | **[Monitoring](#monitoring)** | Live runtime visibility with log streaming, filters, and health signals |
| 🔁 | **[Provider Runtimes](#provider-runtimes)** | Shared runtime layer with Claude Code and OpenAI Codex App Server adapters |
| 🧪 | **[Parallel + Swarm Workflows](#parallel--swarm-workflows)** | Bounded fork/join and swarm orchestration without a free-form graph editor |
| 💸 | **[Cost & Usage](#cost--usage)** | Provider-aware metering, budgets, and spend visibility for governed runs |
| 🚨 | **[Ambient Approvals](#ambient-approvals)** | Shell-level approval prompts that keep Inbox as the durable supervision queue |
| 🔒 | **[Tool Permissions](#tool-permission-persistence)** | Trusted-tool policies with explicit "Always Allow" rules |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React 19)                    │
│  Home · Dashboard · Projects · Documents · Workflows     │
│  Profiles · Schedules · Inbox · Monitor · Settings       │
└──────────────┬──────────────────────┬────────────────────┘
               │ Server Components    │ API Routes
               │ (direct DB queries)  │ (mutations only)
┌──────────────▼──────────────────────▼────────────────────┐
│                  Next.js 16 Server                        │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Drizzle ORM │  │ Runtime      │  │ SSE Stream     │  │
│  │ (SQLite)    │  │ Registry     │  │ (Logs)         │  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────────┘  │
│         │                │                 │              │
│  ┌──────┴──────┐  ┌─────┴────────────┐  ┌─┴───────────┐ │
│  │ Scheduler   │  │ Claude + OpenAI  │  │ Permission  │ │
│  │ Engine      │  │ runtime adapters │  │ Checker     │ │
│  └─────────────┘  └──────────────────┘  └─────────────┘ │
└──────────┬────────────────┬─────────────────┬────────────┘
           │                │                 │
    ┌──────▼──────┐  ┌─────▼─────────────┐  ┌─────▼──────┐
    │ ~/.stagent/ │  │ Anthropic / OpenAI│  │  Browser   │
    │ stagent.db  │  │ runtime backends  │  │ EventSource│
    └─────────────┘  └───────────────────┘  └────────────┘
```

**Key design decisions:**

- **Server Components for reads** — Pages query SQLite directly, no API layer for reads
- **Fire-and-forget execution** — `POST /api/tasks/{id}/execute` returns 202, agent runs async
- **Notification-as-queue** — The `notifications` table is the message bus for human-in-the-loop; agents poll it via `canUseTool`
- **SSE for streaming** — `/api/logs/stream` pushes agent logs to the browser in real time
- **Provider runtime abstraction** — Tasks, schedules, workflows, task assist, and health checks route through shared runtime adapters instead of provider-specific entry points
- **Reusable agent profiles** — Profiles define instructions, allowed tools, runtime tuning, and MCP configs for repeated use
- **Permission pre-check** — Saved "Always Allow" patterns bypass the notification loop for trusted tools

---

## Feature Deep Dives

### Core

#### Home Workspace
Workspace-level briefing with active work, pending review, failed items, project counts, and live agent activity. The home view is designed for daily triage before you drill into execution, inbox, or monitoring detail.

#### Task Execution
Status-driven execution board with five columns: Planned → Queued → Running → Completed → Failed. Filter across projects, create tasks inline, and open task detail to inspect status, description, and runtime state without leaving the board.

#### Projects
Create and organize projects as containers for related tasks. Each project can specify a working directory — agent tasks resolve `cwd` from the project's path, enabling agents to operate on external codebases. Server-rendered project cards with task counts, status badges, and a detail view at `/projects/[id]`.

### Agent

#### Provider Runtimes
Stagent now supports two governed execution runtimes behind a shared runtime registry:
- **Claude Code** via the Anthropic Claude Agent SDK
- **OpenAI Codex App Server** via `codex app-server`

Tasks, schedules, and workflow steps can target a runtime explicitly, while settings exposes runtime-specific authentication and health checks. Runtime-specific execution still lands in the same inbox, monitoring, and task state surfaces.

#### Agent Integration
Claude Agent SDK integration with the `canUseTool` polling pattern remains the default Claude execution path. Tasks are dispatched fire-and-forget and run asynchronously, while every tool call, reasoning step, and decision is surfaced through inbox approvals and monitor logs.

#### OpenAI Codex Runtime
OpenAI Codex App Server is integrated as Stagent's second governed runtime. Codex-backed tasks preserve project working directories, document context, resumable thread IDs, inbox approval requests, user questions, and provider-labeled logs. The same runtime can also power task assist, scheduled firings, and workflow child tasks.

#### Agent Profiles
Profile-backed execution with specialist definitions for different job types. Each profile packages instructions, allowed tools, runtime tuning, and MCP server configuration so teams can reuse behavior intentionally instead of relying on ad hoc prompts. Workflow steps and schedules can reference profiles directly, and runtimes can be selected independently when provider support differs.

#### Workflows
Multi-step task orchestration with three patterns:
- **Sequence** — Steps execute in order
- **Planner→Executor** — One agent plans, another executes each step
- **Human-in-the-Loop Checkpoint** — Pauses for human approval between steps

State machine engine with step-level retry, project association, and real-time status visualization.

#### Parallel + Swarm Workflows
Stagent now supports two bounded expansion patterns on top of the workflow engine:
- **Parallel research fork/join** — 2-5 concurrent branches followed by one synthesis step
- **Swarm orchestration** — mayor → worker pool → refinery with retryable stages and configurable worker concurrency

Both patterns preserve the same governed task model, runtime selection, monitoring stream, and workflow detail surface instead of introducing a separate orchestration product.

#### AI Task Assist
AI-powered task creation: generate improved descriptions, break tasks into sub-tasks, recommend workflow patterns, and estimate complexity through the shared runtime task-assist layer. Claude and OpenAI task assist now both route through the provider runtime abstraction.

#### Session Management
Resume failed or cancelled agent tasks with one click. Tracks retry counts (limit: 3), detects expired sessions, and provides atomic claim to prevent duplicate runs.

#### Autonomous Loop Execution
Iterative agent loop pattern with four stop conditions: max iterations, time budget, human cancel, and agent-signaled completion. Each iteration creates a child task with previous output as context. Loop status view with iteration timeline, progress bar, and expandable results. Pause/resume via DB status polling.

#### Agent Profile Catalog
Curated agent profiles across work and personal domains, built as portable Claude Code skill directories with `profile.yaml` sidecars. The profile gallery supports domain filtering and search, while YAML customization, GitHub import, and behavioral smoke tests keep profile behavior inspectable and reusable.

#### Workflow Blueprints
Pre-configured workflow templates across work and personal domains. Browse blueprints in a gallery with filtering and search, preview steps and required variables, fill in a dynamic form, and create draft workflows with resolved prompts and profile assignments. Create custom blueprints via YAML or import from GitHub URLs. Lineage tracking connects workflows back to their source blueprint.

<img src="https://unpkg.com/stagent@latest/public/readme/workflow-blueprints.png" alt="Stagent workflow blueprint gallery" width="1200" />

### Documents

#### Document Management
Full document browser at `/documents` with table and grid views. Upload files with drag-and-drop, preview images/PDFs/markdown/code inline, search by filename and extracted text, and filter by processing status or project. Bulk delete, link/unlink to projects and tasks.

#### Document Preprocessing
Automatic text extraction on upload for five file types: text, PDF (pdf-parse), images (image-size), Office documents (mammoth/jszip), and spreadsheets (xlsx). Extracted text, processed paths, and processing errors are tracked per document.

#### Agent Document Context
Documents linked to a task are automatically injected into the agent's prompt as context. The context builder aggregates extracted text from all linked documents, giving agents access to uploaded reference material without manual copy-paste.

### Platform

#### Tool Permission Persistence
"Always Allow" option for agent tool permissions. When you approve a tool, you can save it as a pattern (e.g., `Bash(command:git *)`, `Read`, `mcp__server__tool`). Saved patterns are checked before creating notifications — trusted tools are auto-approved instantly. Manage patterns from the Settings page. `AskUserQuestion` always requires human input.

#### Ambient Approvals
Pending permission requests now surface through a shell-level approval presenter on any route, so operators can respond without leaving the page they are working on. Inbox remains the durable queue and source of truth, while the ambient surface provides the fast path for active supervision.

#### Schedules
Time-based scheduling for agent tasks with human-friendly intervals (`5m`, `2h`, `1d`) and raw 5-field cron expressions. One-shot and recurring modes with pause/resume lifecycle, expiry limits, and max firings. Each firing creates a child task through the shared execution pipeline, and schedules can now target a runtime explicitly. Scheduler runs as a poll-based engine started via Next.js instrumentation hook.

#### Micro-Visualizations
Pure SVG chart primitives (Sparkline, MiniBar, DonutRing) with zero charting dependencies. Integrated into: homepage stats cards (7-day trends), activity feed (24h bar chart), project cards (completion donuts), monitor overview (success rate), and project detail (stacked status + 14-day sparkline). Full accessibility with `role="img"` and `aria-label`.

#### Cost & Usage
Provider-normalized metering tracks token and spend activity across tasks, resumes, workflow child tasks, schedules, task assist, and profile tests. The dedicated `Cost & Usage` surface adds summary cards, trend views, provider/model breakdowns, and budget-aware audit visibility on top of the usage ledger.

### UI & DevEx

#### Inbox & Human-in-the-Loop
When an agent needs approval or input, a notification appears in your inbox. Review tool permission requests with "Allow Once" / "Always Allow" / "Deny" buttons, answer agent questions, and see task completion summaries. Supports bulk dismiss and 10s polling.

<img src="https://unpkg.com/stagent@latest/public/readme/inbox-approvals.png" alt="Stagent inbox approval flow" width="1200" />

#### Monitoring
Real-time agent log streaming via Server-Sent Events. Filter by task or event type, click entries to jump to task details, and auto-pause polling when the tab is hidden (Page Visibility API).

#### Content Handling
File upload with drag-and-drop in task creation. Type-aware content preview for text, markdown (via react-markdown), code, and JSON. Copy-to-clipboard and download-as-file for task outputs.

#### Settings
Configuration hub with provider-aware sections: Claude authentication (API key or OAuth), OpenAI Codex runtime API-key management, tool permissions (saved "Always Allow" patterns with revoke), and data management.

#### CLI
Stagent still uses a small Node sidecar under the hood. It is built from `bin/cli.ts` into `dist/cli.js`, but it is now an internal desktop bootstrap rather than a user-facing distribution channel.

#### Tauri Desktop
The repo produces macOS desktop artifacts via Tauri. Local development uses `npm run desktop:dev`, local packaging uses `npm run desktop:build`, and release publishing now runs locally via `npm run desktop:release` so the uploaded GitHub assets stay on stable names: `Stagent.dmg` and `Stagent.app.zip`. Keep `public/icon-512.png` as a square, unmasked source icon; macOS applies the rounded mask later. The local release script also stamps the same branded icon onto the mounted DMG volume so Finder shows the corrected Stagent icon during install.

#### Database
SQLite with WAL mode via better-sqlite3 + Drizzle ORM. Eight tables: `projects`, `tasks`, `workflows`, `agent_logs`, `notifications`, `documents`, `schedules`, `settings`. Self-healing bootstrap — tables are created on startup if missing.

#### App Shell
Responsive sidebar with collapsible icon-only mode, custom Stagent logo, tooltip navigation, dark/light/system theme, and OKLCH hue 250 blue-indigo color palette. Built on shadcn/ui (New York style) with PWA manifest and app icons. Routes: Home, Dashboard, Projects, Documents, Workflows, Profiles, Schedules, Inbox, Monitor, Settings.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 + React 19 | Server Components for zero-API reads, Turbopack for fast dev |
| Language | TypeScript (strict) | End-to-end type safety from DB schema to UI |
| Styling | Tailwind CSS v4 + shadcn/ui | Utility-first CSS with accessible component primitives |
| Database | SQLite (WAL) + Drizzle ORM | Zero-config embedded DB, type-safe queries, concurrent reads |
| AI Runtime | `@anthropic-ai/claude-agent-sdk` + `codex app-server` | Governed Claude and OpenAI execution behind a shared runtime layer |
| CLI | Commander + tsup | Familiar CLI framework, fast ESM bundling |
| Testing | Vitest + Testing Library | Fast test runner with React component testing |
| Content | react-markdown + remark-gfm | Full GitHub-flavored markdown rendering |
| Validation | Zod v4 | Runtime type validation at system boundaries |
| Documents | pdf-parse, mammoth, xlsx, image-size | Multi-format document preprocessing |
| Scheduling | cron-parser | Cron expression parsing and next-fire-time computation |

---

## Development

```bash
npm run dev            # Next.js dev server (Turbopack)
npm run build:cli      # Build CLI → dist/cli.js
npm test               # Run Vitest
npm run test:coverage  # Coverage report
```

## Desktop Release Checklist

```bash
npm run desktop:release
```

For a build-only smoke check, run `npm run desktop:release -- --skip-upload`.

The release script builds locally on macOS, verifies the DMG, creates or updates the `desktop-v<package.json version>` GitHub release, uploads `Stagent.dmg` and `Stagent.app.zip`, and refreshes the stable download URL at `https://github.com/manavsehgal/stagent/releases/latest/download/Stagent.dmg`.

### Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── dashboard/        # Project overview
│   ├── projects/[id]/    # Project detail
│   ├── documents/        # Document browser
│   ├── workflows/        # Workflow management
│   ├── schedules/        # Schedule management
│   ├── inbox/            # Notifications
│   ├── monitor/          # Log streaming
│   └── settings/         # Configuration
├── components/
│   ├── dashboard/        # Homepage widgets + charts
│   ├── tasks/            # Board, cards, panels
│   ├── workflows/        # Workflow UI
│   ├── documents/        # Document browser + upload
│   ├── schedules/        # Schedule management
│   ├── monitoring/       # Log viewer
│   ├── notifications/    # Inbox + permission actions
│   ├── settings/         # Auth, permissions, data mgmt
│   ├── shared/           # App shell, sidebar
│   └── ui/               # shadcn/ui primitives
└── lib/
    ├── agents/           # Runtime adapters, provider integrations, profiles
    ├── db/               # Schema, migrations
    ├── documents/        # Preprocessing + context builder
    ├── workflows/        # Engine + types + blueprints
    ├── schedules/        # Scheduler engine + interval parser
    ├── settings/         # Auth, permissions, helpers
    ├── constants/        # Status transitions, colors
    ├── queries/          # Chart data aggregation
    ├── validators/       # Zod schemas
    └── utils/            # Shared helpers
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects/[id]` | GET/PUT/DELETE | Project CRUD |
| `/api/tasks/[id]/execute` | POST | Fire-and-forget task dispatch (202) |
| `/api/tasks/[id]/resume` | POST | Resume failed/cancelled task |
| `/api/tasks/[id]/respond` | POST | Human response to agent prompt |
| `/api/tasks/[id]/logs` | GET | Task log history |
| `/api/logs/stream` | GET | SSE agent log stream |
| `/api/notifications` | GET/POST | Notification management |
| `/api/workflows` | POST | Create workflow |
| `/api/workflows/[id]/execute` | POST | Execute workflow |
| `/api/documents` | GET | List documents with joins |
| `/api/documents/[id]` | PATCH/DELETE | Document metadata + deletion |
| `/api/uploads` | POST | File upload |
| `/api/schedules` | GET/POST | Schedule CRUD |
| `/api/schedules/[id]` | GET/PATCH/DELETE | Schedule detail + updates |
| `/api/permissions` | GET/POST/DELETE | Tool permission patterns |
| `/api/settings/openai` | GET/POST | OpenAI Codex runtime settings |
| `/api/settings/test` | POST | Provider-aware runtime connectivity test |
| `/api/profiles` | GET | List agent profiles |
| `/api/profiles/[id]/test` | POST | Run behavioral tests on a profile |
| `/api/profiles/import` | POST | Import profile from GitHub URL |
| `/api/blueprints` | GET/POST | List and create blueprints |
| `/api/blueprints/[id]` | GET/DELETE | Blueprint detail and deletion |
| `/api/blueprints/[id]/instantiate` | POST | Create workflow from blueprint |
| `/api/blueprints/import` | POST | Import blueprint from GitHub URL |

---

## Roadmap

### MVP — Complete

All 14 features shipped across three layers:

| Layer | Features |
|-------|----------|
| **Foundation** | CLI bootstrap, database schema, app shell |
| **Core** | Project management, task board, agent integration, inbox notifications, monitoring dashboard |
| **Polish** | Homepage dashboard, UX fixes, workflow engine, AI task assist, content handling, session management |

### Post-MVP — Complete

| Feature | What shipped |
|---------|-------------|
| **Document Management** | File attachments, preprocessing (5 formats), agent document context, document browser UI |
| **Multi-Agent Routing** | Profile registry (4 profiles), task classifier, per-step profile assignment |
| **Agent Profile Catalog** | 13 domain-specific profiles, GitHub import, behavioral testing, MCP server passthrough |
| **Micro-Visualizations** | Sparklines, mini bars, donut rings — zero-dependency SVG charts |
| **Tool Permission Persistence** | "Always Allow" patterns, pre-check bypass, Settings management |
| **Scheduled Prompt Loops** | Cron + human-friendly intervals, one-shot/recurring, pause/resume lifecycle |
| **Provider Runtimes** | Shared runtime registry with Claude Code and OpenAI Codex App Server adapters |
| **Autonomous Loop Execution** | 4 stop conditions, iteration context chaining, pause/resume, loop status view |
| **Workflow Blueprints** | 8 templates, gallery, YAML editor, dynamic forms, GitHub import, lineage tracking |
| **Command Palette** | ⌘K palette with navigation, create actions, recent items, theme toggle |

### Planned

| Feature | Description |
|---------|-------------|
| **Multi-Agent Swarm** | Multi-agent orchestration with Mayor/Workers/Refinery roles |
| **Agent Self-Improvement** | Agents learn patterns and update context with human approval |
| **Document Output Generation** | Agent-generated documents as deliverables |
| **Parallel Workflows** | Concurrent step execution within workflows |
| **Tauri Desktop** | Native desktop app packaging |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes and add tests
4. Run `npm test` and `npx tsc --noEmit`
5. Submit a pull request

See `CLAUDE.md` for architecture details and development conventions.

## License

Licensed under the [Apache License 2.0](LICENSE).
