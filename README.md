# Stagent

> A control plane for AI agent tasks — assign, execute, monitor, and intervene through a clean web dashboard.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/) [![React 19](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/) [![Claude Agent SDK](https://img.shields.io/badge/Claude-Agent_SDK-D97706)](https://docs.anthropic.com/) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

## Why Stagent

AI agents are powerful but running them unsupervised is risky. Stagent gives you a dashboard to create tasks, dispatch them to Claude agents, watch execution in real time, and respond when agents need human judgment — bridging the gap between autonomous AI and human oversight.

## Quick Start

```bash
git clone <repo-url> && cd stagent && npm install

# Set up your Anthropic API key
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local

# Start the dev server
npm run dev
```

Open [localhost:3000](http://localhost:3000) to get started.

## Feature Highlights

| | Feature | What it does |
|---|---------|-------------|
| 📌 | **[Task Board](#task-board)** | Kanban board with drag-and-drop, status transitions, and agent dispatch |
| 🤖 | **[Agent Execution](#agent-integration)** | Fire-and-forget Claude SDK tasks with real-time log streaming |
| 📥 | **[Human-in-the-Loop](#inbox--human-in-the-loop)** | Approve tool use, answer questions, and review results from your inbox |
| 🔀 | **[Workflows](#workflow-engine)** | Multi-step orchestration: Sequence, Planner→Executor, Checkpoints |
| 🧠 | **[Multi-Agent Routing](#multi-agent-routing)** | Profile-based routing with auto-classification and per-step profiles |
| 📋 | **[Agent Profile Catalog](#agent-profile-catalog)** | 13 domain-specific profiles with import, testing, and MCP support |
| 📄 | **[Document Management](#document-management)** | Upload, preprocess, and inject documents into agent context |
| 🔒 | **[Tool Permissions](#tool-permission-persistence)** | "Always Allow" patterns for trusted tools — no repeated prompts |
| 🧩 | **[Workflow Blueprints](#workflow-blueprints)** | 8 pre-built templates with typed variables and dynamic forms |
| ⏰ | **[Scheduled Prompts](#scheduled-prompt-loops)** | Time-based scheduling with cron and human-friendly intervals |
| 🔄 | **[Autonomous Loops](#autonomous-loop-execution)** | Iterative agent execution with stop conditions and convergence detection |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React 19)                    │
│  Home · Tasks · Projects · Documents · Workflows         │
│  Schedules · Inbox · Monitor · Settings                  │
└──────────────┬──────────────────────┬────────────────────┘
               │ Server Components    │ API Routes
               │ (direct DB queries)  │ (mutations only)
┌──────────────▼──────────────────────▼────────────────────┐
│                  Next.js 16 Server                        │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Drizzle ORM │  │ Agent SDK    │  │ SSE Stream     │  │
│  │ (SQLite)    │  │ (Claude API) │  │ (Logs)         │  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────────┘  │
│         │                │                 │              │
│  ┌──────┴──────┐  ┌─────┴──────┐   ┌─────┴──────────┐  │
│  │ Scheduler   │  │ Profile    │   │ Permission     │  │
│  │ Engine      │  │ Registry   │   │ Checker        │  │
│  └─────────────┘  └────────────┘   └────────────────┘  │
└──────────┬────────────────┬─────────────────┬────────────┘
           │                │                 │
    ┌──────▼──────┐  ┌─────▼──────┐   ┌─────▼──────┐
    │ ~/.stagent/ │  │  Anthropic │   │  Browser   │
    │ stagent.db  │  │  API       │   │  EventSource│
    └─────────────┘  └────────────┘   └────────────┘
```

**Key design decisions:**

- **Server Components for reads** — Pages query SQLite directly, no API layer for reads
- **Fire-and-forget execution** — `POST /api/tasks/{id}/execute` returns 202, agent runs async
- **Notification-as-queue** — The `notifications` table is the message bus for human-in-the-loop; agents poll it via `canUseTool`
- **SSE for streaming** — `/api/logs/stream` pushes agent logs to the browser in real time
- **Profile-based routing** — Agent profiles define system prompts, allowed tools, and MCP configs per task type
- **Permission pre-check** — Saved "Always Allow" patterns bypass the notification loop for trusted tools

---

## Feature Deep Dives

### Core

#### Task Board
Kanban-style board with five columns: Planned → Queued → Running → Completed → Failed. Drag tasks between valid states, create inline, filter by project, and click any card for a detail panel with execution history.

#### Project Management
Create and organize projects as containers for related tasks. Each project can specify a working directory — agent tasks resolve `cwd` from the project's path, enabling agents to operate on external codebases. Server-rendered project cards with task counts, status badges, and a detail view at `/projects/[id]`.

#### Homepage Dashboard
Five-zone landing page: time-of-day greeting with live DB stats, priority task queue, activity feed, quick actions grid, and recent projects with progress bars. Includes sparkline charts, mini bar charts, and donut rings for at-a-glance trend visualization.

### Agent

#### Agent Integration
Claude Agent SDK integration with the `canUseTool` polling pattern. Tasks are dispatched fire-and-forget and run asynchronously. Every tool call, reasoning step, and decision is logged to `agent_logs`.

#### Multi-Agent Routing
Profile-based agent routing with four starter profiles: General, Code Reviewer, Researcher, and Document Writer. Each profile defines a system prompt, allowed tools, and MCP server configuration. A task classifier auto-selects the best profile based on task content, and users can override. Workflow steps support per-step profile assignment.

#### Workflow Engine
Multi-step task orchestration with three patterns:
- **Sequence** — Steps execute in order
- **Planner→Executor** — One agent plans, another executes each step
- **Human-in-the-Loop Checkpoint** — Pauses for human approval between steps

State machine engine with step-level retry, project association, and real-time status visualization.

#### AI Task Assist
AI-powered task creation: generate improved descriptions, break tasks into sub-tasks, recommend workflow patterns, and estimate complexity — all via the Agent SDK's `query` function.

#### Session Management
Resume failed or cancelled agent tasks with one click. Tracks retry counts (limit: 3), detects expired sessions, and provides atomic claim to prevent duplicate runs.

#### Autonomous Loop Execution
Iterative agent loop pattern with four stop conditions: max iterations, time budget, human cancel, and agent-signaled completion. Each iteration creates a child task with previous output as context. Loop status view with iteration timeline, progress bar, and expandable results. Pause/resume via DB status polling.

#### Agent Profile Catalog
13 domain-specific agent profiles across work (8) and personal (5) domains, built as portable Claude Code skill directories with `profile.yaml` sidecars. Profile gallery with domain tabs and search, YAML editor for customization, GitHub import via URL, and behavioral smoke tests with inline pass/fail results. MCP server configs passed through to Agent SDK execution.

#### Workflow Blueprints
8 pre-configured workflow templates across work (code review, research report, sprint planning, documentation) and personal (investment research, travel planning, meal planning, product research) domains. Browse blueprints in a gallery with domain filtering and search, preview steps and required variables, fill in a dynamic form, and instantly create a draft workflow with resolved prompts and profile assignments. Create custom blueprints via a YAML editor or import from GitHub URLs. Lineage tracking connects workflows back to their source blueprint.

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

#### Scheduled Prompt Loops
Time-based scheduling for agent tasks with human-friendly intervals (`5m`, `2h`, `1d`) and raw 5-field cron expressions. One-shot and recurring modes with pause/resume lifecycle, expiry limits, and max firings. Each firing creates a child task through the existing execution pipeline. Scheduler runs as a poll-based engine started via Next.js instrumentation hook.

#### Micro-Visualizations
Pure SVG chart primitives (Sparkline, MiniBar, DonutRing) with zero charting dependencies. Integrated into: homepage stats cards (7-day trends), activity feed (24h bar chart), project cards (completion donuts), monitor overview (success rate), and project detail (stacked status + 14-day sparkline). Full accessibility with `role="img"` and `aria-label`.

### UI & DevEx

#### Inbox & Human-in-the-Loop
When an agent needs approval or input, a notification appears in your inbox. Review tool permission requests with "Allow Once" / "Always Allow" / "Deny" buttons, answer agent questions, and see task completion summaries. Supports bulk dismiss and 10s polling.

#### Monitoring
Real-time agent log streaming via Server-Sent Events. Filter by task or event type, click entries to jump to task details, and auto-pause polling when the tab is hidden (Page Visibility API).

#### Content Handling
File upload with drag-and-drop in task creation. Type-aware content preview for text, markdown (via react-markdown), code, and JSON. Copy-to-clipboard and download-as-file for task outputs.

#### Settings
Configuration hub with three sections: authentication (API key or OAuth), tool permissions (saved "Always Allow" patterns with revoke), and data management.

#### CLI
`npx stagent` launches the dev server and opens the dashboard. Built with Commander, compiled via tsup to `dist/cli.js`.

#### Database
SQLite with WAL mode via better-sqlite3 + Drizzle ORM. Eight tables: `projects`, `tasks`, `workflows`, `agent_logs`, `notifications`, `documents`, `schedules`, `settings`. Self-healing bootstrap — tables are created on startup if missing.

#### App Shell
Responsive sidebar with collapsible icon-only mode, custom Stagent logo, tooltip navigation, dark/light/system theme, and OKLCH hue 250 blue-indigo color palette. Built on shadcn/ui (New York style) with PWA manifest and app icons. Routes: Home, Projects, Documents, Workflows, Schedules, Inbox, Monitor, Settings.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 + React 19 | Server Components for zero-API reads, Turbopack for fast dev |
| Language | TypeScript (strict) | End-to-end type safety from DB schema to UI |
| Styling | Tailwind CSS v4 + shadcn/ui | Utility-first CSS with accessible component primitives |
| Database | SQLite (WAL) + Drizzle ORM | Zero-config embedded DB, type-safe queries, concurrent reads |
| AI Agent | `@anthropic-ai/claude-agent-sdk` | Native tool-use, streaming, and `canUseTool` pattern |
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
    ├── agents/           # Claude Agent SDK + profiles
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
