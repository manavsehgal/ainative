# Stagent

> AI-powered task management where Claude agents execute tasks with human-in-the-loop oversight.

## The Problem

AI agents are powerful — but running them unsupervised is risky. You need a way to assign tasks, monitor execution, and intervene when an agent needs human judgment. Most task management tools weren't built for this. They track *human* work, not *agent* work.

Stagent is a **control plane for AI agent tasks**. It gives you a dashboard to create tasks, dispatch them to Claude agents, watch execution in real time, and respond to agent prompts — all through a clean web interface.

## Key Features

### Completed

📋 **Project Management** — Create and organize projects as containers for related tasks. Server-rendered project dashboard with real-time task counts.

📌 **Task Board** — Kanban-style board with drag-and-drop task management. Tasks flow through `planned → queued → running → completed/failed/cancelled` with validated status transitions.

🤖 **Agent Integration** — Fire-and-forget task execution via the Claude Agent SDK. Tasks are dispatched with `POST /api/tasks/{id}/execute` (returns 202) and run asynchronously with full logging.

📥 **Inbox Notifications** — Human-in-the-loop notification system. When an agent needs approval or input, it creates a notification via the `canUseTool` polling pattern. Respond directly from the inbox.

📊 **Monitoring Dashboard** — Real-time agent log streaming via Server-Sent Events. Watch agent reasoning, tool calls, and decisions as they happen.

🔄 **Session Management** — Resume failed or cancelled agent tasks. Tracks retry counts, detects expired sessions, and provides a one-click resume button.

⚙️ **Settings & Auth** — Configure authentication method (OAuth / API key) with encrypted key storage. Manage platform settings from a dedicated page.

### Foundation

🖥️ **CLI Bootstrap** — `npx stagent` launches the Next.js dev server and opens the dashboard. Built with Commander, compiled via tsup.

🗄️ **Database Schema** — SQLite with WAL mode via better-sqlite3 + Drizzle ORM. Five tables: projects, tasks, workflows, agent_logs, notifications. Self-healing bootstrap on startup.

🏗️ **App Shell** — Responsive sidebar layout with collapsible navigation, breadcrumbs, and theme support (light/dark/system). Built on shadcn/ui with OKLCH color theming.

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                   Browser (React 19)                │
│  Dashboard · Task Board · Inbox · Monitor · Settings│
└──────────────┬──────────────────────┬───────────────┘
               │ Server Components    │ API Routes
               │ (direct DB queries)  │ (mutations)
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

**Rendering pattern**: Server Components query the database directly — no API layer needed for reads. API routes handle client-side mutations only.

**Agent execution**: Tasks are dispatched fire-and-forget. The agent runs asynchronously, logging each step to the `agent_logs` table. When it needs human input, it writes to the `notifications` table and polls until a response arrives.

**Monitoring**: The dashboard streams logs via SSE (`/api/logs/stream`), giving you a live view of agent activity across all tasks.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 + React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui (New York) |
| Database | SQLite (WAL) via better-sqlite3 |
| ORM | Drizzle ORM |
| AI Agent | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) |
| CLI | Commander + tsup |
| Testing | Vitest + Testing Library |
| Validation | Zod v4 |

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd stagent
npm install

# Set up your Anthropic API key
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local

# Start the dev server (Turbopack)
npm run dev

# Or build and run the CLI
npm run build:cli
node dist/cli.js
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to get started.

## Roadmap

### MVP — Foundation & Core ✅

All foundation and core features are complete:
- Project management, task board, agent integration
- Human-in-the-loop inbox, monitoring dashboard
- Session management for agent task resume

### MVP — Polish (In Progress)

- **Task Definition AI** — AI-assisted task creation and refinement
- **Workflow Engine** — Multi-step task orchestration
- **Content Handling** — Rich content in task descriptions and agent outputs

### Post-MVP (Planned)

- **Multi-Agent Routing** — Route tasks to specialized agent configurations
- **Tauri Desktop** — Native desktop app packaging
- **Parallel Workflows** — Concurrent multi-step task execution

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── dashboard/        # Project overview
│   ├── projects/         # Project management
│   ├── inbox/            # Human-in-the-loop notifications
│   └── monitor/          # Agent log streaming
├── components/
│   ├── tasks/            # Task board, detail panels
│   ├── projects/         # Project cards, forms
│   ├── monitoring/       # Log viewer, stream display
│   ├── notifications/    # Inbox items, response forms
│   ├── shared/           # App shell, sidebar, nav
│   └── ui/               # shadcn/ui primitives
└── lib/
    ├── agents/           # Claude Agent SDK integration
    ├── db/               # Schema, migrations, queries
    ├── constants/        # Status transitions, config
    ├── validators/       # Zod schemas
    └── utils/            # Shared utilities
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes and add tests
4. Run `npm test` to verify all tests pass
5. Run `npx tsc --noEmit` to check types
6. Submit a pull request

See `CLAUDE.md` for detailed development conventions and architecture decisions.

## License

MIT
