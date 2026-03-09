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
| 📊 | **[Live Monitoring](#monitoring)** | SSE-powered agent activity stream with filtering and auto-scroll |
| 🧠 | **[AI Task Assist](#ai-task-assist)** | AI-generated descriptions, sub-task breakdown, and complexity estimates |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (React 19)                │
│  Home · Task Board · Inbox · Monitor · Workflows    │
└──────────────┬──────────────────────┬───────────────┘
               │ Server Components    │ API Routes
               │ (direct DB queries)  │ (mutations only)
┌──────────────▼──────────────────────▼───────────────┐
│                 Next.js 16 Server                    │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Drizzle ORM │  │ Agent SDK    │  │ SSE Stream │ │
│  │ (SQLite)    │  │ (Claude API) │  │ (Logs)     │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘ │
└─────────┼────────────────┼─────────────────┼────────┘
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

---

## Feature Deep Dives

### Core

#### Task Board
Kanban-style board with five columns: Planned → Queued → Running → Completed → Failed. Drag tasks between valid states, create inline, filter by project, and click any card for a detail panel with execution history.

#### Project Management
Create and organize projects as containers for related tasks. Server-rendered project cards with task counts, status badges, and a detail view at `/projects/[id]` showing task breakdown.

#### Homepage Dashboard
Five-zone landing page: time-of-day greeting with live DB stats, priority task queue, activity feed, quick actions grid, and recent projects with progress bars.

### Agent

#### Agent Integration
Claude Agent SDK integration with the `canUseTool` polling pattern. Tasks are dispatched fire-and-forget and run asynchronously. Every tool call, reasoning step, and decision is logged to `agent_logs`.

#### Workflow Engine
Multi-step task orchestration with three patterns:
- **Sequence** — Steps execute in order
- **Planner→Executor** — One agent plans, another executes each step
- **Human-in-the-Loop Checkpoint** — Pauses for human approval between steps

State machine engine with step-level retry and real-time status visualization.

#### AI Task Assist
AI-powered task creation: generate improved descriptions, break tasks into sub-tasks, recommend workflow patterns, and estimate complexity — all via the Agent SDK's `query` function.

#### Session Management
Resume failed or cancelled agent tasks with one click. Tracks retry counts (limit: 3), detects expired sessions, and provides atomic claim to prevent duplicate runs.

### UI & DevEx

#### Inbox & Human-in-the-Loop
When an agent needs approval or input, a notification appears in your inbox. Review tool permission requests, answer agent questions, and see task completion summaries. Supports bulk dismiss and 10s polling.

#### Monitoring
Real-time agent log streaming via Server-Sent Events. Filter by task or event type, click entries to jump to task details, and auto-pause polling when the tab is hidden (Page Visibility API).

#### Content Handling
File upload with drag-and-drop in task creation. Type-aware content preview for text, markdown (via react-markdown), code, and JSON. Copy-to-clipboard and download-as-file for task outputs.

#### CLI
`npx stagent` launches the dev server and opens the dashboard. Built with Commander, compiled via tsup to `dist/cli.js`.

#### Database
SQLite with WAL mode via better-sqlite3 + Drizzle ORM. Five tables: `projects`, `tasks`, `workflows`, `agent_logs`, `notifications`. Self-healing bootstrap — tables are created on startup if missing.

#### App Shell
Responsive sidebar with collapsible navigation, dark/light/system theme, and OKLCH hue 250 blue-indigo color palette. Built on shadcn/ui (New York style).

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
│   ├── workflows/        # Workflow management
│   ├── inbox/            # Notifications
│   └── monitor/          # Log streaming
├── components/
│   ├── dashboard/        # Homepage widgets
│   ├── tasks/            # Board, cards, panels
│   ├── workflows/        # Workflow UI
│   ├── monitoring/       # Log viewer
│   ├── notifications/    # Inbox components
│   ├── shared/           # App shell, sidebar
│   └── ui/               # shadcn/ui primitives
└── lib/
    ├── agents/           # Claude Agent SDK
    ├── db/               # Schema, migrations
    ├── workflows/        # Engine + types
    ├── constants/        # Status transitions
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
| `/api/uploads` | POST | File upload |

---

## Roadmap

### MVP — Complete ✅

All 14 features shipped across three layers:

| Layer | Features |
|-------|----------|
| **Foundation** | CLI bootstrap, database schema, app shell |
| **Core** | Project management, task board, agent integration, inbox notifications, monitoring dashboard |
| **Polish** | Homepage dashboard, UX fixes, workflow engine, AI task assist, content handling, session management |

### Next Up

| Feature | Description |
|---------|-------------|
| **Document Management** | File attachments, preprocessing, agent document context, document output generation |
| **Autonomous Loop Execution** | Agent loop pattern with stop conditions and iteration tracking |
| **Multi-Agent Swarm** | Multi-agent orchestration with Mayor/Workers/Refinery roles |
| **Agent Self-Improvement** | Agents learn patterns and update own context with human approval |
| **Multi-Agent Routing** | Route tasks to specialized agent configurations |
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
