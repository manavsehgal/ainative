# Stagent

> Governed AI Agent Workspace — Supervised Local Execution, Workflows, Documents, and Provider Runtimes.

[![npm](https://img.shields.io/npm/v/stagent)](https://www.npmjs.com/package/stagent) [![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/) [![React 19](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/) [![Claude Agent SDK](https://img.shields.io/badge/Claude-Agent_SDK-D97706)](https://docs.anthropic.com/) [![OpenAI Codex App Server](https://img.shields.io/badge/OpenAI-Codex_App_Server-10A37F)](https://developers.openai.com/codex/app-server) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**[stagent.io](https://stagent.io)** · **[GitHub](https://github.com/manavsehgal/stagent)**

## Quick Start

```bash
npx stagent
```

Open [localhost:3000](http://localhost:3000). That's it — zero config, local SQLite, own your data.

**Profiles & Policies** · **Blueprints & Schedules** · **Built-in Playbook** · **Open Source**

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/home-list.png" alt="Stagent home workspace" width="1200" />

| Home Workspace | Reusable Profiles | Workflow Blueprints | Governed Execution |
|:-:|:-:|:-:|:-:|
| Workspace briefing with active work, pending review, project signals, and live activity | Specialist definitions with prompts, tool policy, and runtime tuning you can reuse | Pre-configured templates with dynamic forms, YAML editing, and lineage tracking | Human-in-the-loop approvals, tool permissions, and ambient supervision |

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/home-below-fold.png" alt="Stagent home workspace below fold — projects, activity feed, and signals" width="1200" />

---

## Why Stagent

AI agents are powerful — but production use breaks down when teams cannot see what the agent is doing, which rules it follows, or intervene before an unsafe action lands. Stagent gives you a **governed operations workspace** where every run is visible, every profile is reusable, and every approval is auditable.

- **Local-first** — SQLite database, no cloud dependency, `npx stagent` and go
- **Multi-provider** — Claude Code + OpenAI Codex App Server behind one runtime registry
- **Human-in-the-loop** — Inbox approvals, ambient toasts, tool permission policies
- **Reusable profiles** — 21 agent profiles with instructions, tool policies, and runtime tuning
- **Workflow orchestration** — 6 patterns (sequence, planner-executor, checkpoint, parallel, loop, swarm)
- **Cost governance** — Usage metering, budgets, and spend visibility per provider and model

---

## Runtime Bridge

Stagent ships a shared runtime registry that routes tasks, schedules, and workflow steps through two governed execution backends: **Claude Code** (Anthropic Claude Agent SDK) and **OpenAI Codex App Server**. Both land in the same inbox, monitoring, and task-state surfaces — switching providers is a config change, not a rewrite.

---

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
| 📋 | **[Kanban Board](#kanban-board-operations)** | Inline editing, bulk operations, and persistent board state |
| 🤖 | **[AI Assist → Workflows](#ai-assist--workflow-creation)** | Bridge task assist recommendations into governed workflow execution |
| 🧬 | **[Agent Self-Improvement](#agent-self-improvement)** | Agents learn patterns from execution history with human-approved context evolution |
| 🎯 | **[Tool Permission Presets](#tool-permission-presets)** | Pre-configured permission bundles (read-only, git-safe, full-auto) with layered apply/remove |
| 📦 | **[Workflow Context Batching](#workflow-context-batching)** | Workflow-scoped proposal buffering with batch approve/reject for learned context |
| 🧪 | **[E2E Test Automation](#e2e-test-automation)** | API-level end-to-end test suite covering both runtimes, 4 profiles, and 4 workflow patterns |
| ⌨️ | **[Command Palette](#command-palette)** | Global `⌘K` search for fast navigation across tasks, projects, workflows, and settings |
| 📖 | **[Playbook](#playbook)** | Built-in documentation with usage-stage awareness, adoption heatmap, and guided learning journeys |

---

## Architecture

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/architecture.svg" alt="Stagent architecture diagram" width="900" />

**Key design decisions:**

- **Server Components for reads** — Pages query SQLite directly, no API layer for reads
- **Fire-and-forget execution** — `POST /api/tasks/{id}/execute` returns 202, agent runs async
- **Notification-as-queue** — The `notifications` table is the message bus for human-in-the-loop; agents poll it via `canUseTool`
- **SSE for streaming** — `/api/logs/stream` pushes agent logs to the browser in real time
- **Provider runtime abstraction** — Tasks, schedules, workflows, task assist, and health checks route through shared runtime adapters instead of provider-specific entry points
- **Reusable agent profiles** — Profiles define instructions, allowed tools, runtime tuning, and MCP configs for repeated use
- **Permission pre-check** — Saved "Always Allow" patterns bypass the notification loop for trusted tools
- **Learned context loop** — Pattern extraction → human approval → versioned context injection creates a supervised self-improvement cycle
- **Permission presets** — Layered preset bundles (read-only ⊂ git-safe ⊂ full-auto) that compose with individual "Always Allow" patterns

---

## Feature Deep Dives

### Core

#### Home Workspace
Workspace-level briefing with active work, pending review, failed items, project counts, and live agent activity. The home view is designed for daily triage before you drill into execution, inbox, or monitoring detail.

#### Task Execution
Status-driven execution board with five columns: Planned → Queued → Running → Completed → Failed. Filter across projects, create tasks inline, and open task detail to inspect status, description, and runtime state without leaving the board.

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/dashboard-list.png" alt="Stagent kanban board" width="1200" />

| Table View | Filtered by Project | Task Detail |
|:-:|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/dashboard-table.png" alt="Dashboard table view" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/dashboard-filtered.png" alt="Dashboard filtered by project" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/dashboard-detail.png" alt="Task detail sheet" width="380" /> |

#### Projects
Create and organize projects as containers for related tasks. Each project can specify a working directory — agent tasks resolve `cwd` from the project's path, enabling agents to operate on external codebases. Server-rendered project cards with task counts, status badges, and a detail view at `/projects/[id]`.

| Project Cards | Project Detail |
|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/projects-list.png" alt="Project cards overview" width="580" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/projects-detail.png" alt="Project detail view" width="580" /> |

| Create Project — Empty | Create Project — Filled |
|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/projects-create-form-empty.png" alt="Empty project creation form" width="580" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/projects-create-form-filled.png" alt="Filled project creation form" width="580" /> |

### Agent

#### Provider Runtimes
Stagent supports two governed execution runtimes behind a shared runtime registry:
- **Claude Code** via the Anthropic Claude Agent SDK
- **OpenAI Codex App Server** via `codex app-server`

Tasks, schedules, and workflow steps can target a runtime explicitly, while settings exposes runtime-specific authentication and health checks. Runtime-specific execution still lands in the same inbox, monitoring, and task state surfaces.

#### Agent Integration
Claude Agent SDK integration with the `canUseTool` polling pattern remains the default Claude execution path. Tasks are dispatched fire-and-forget and run asynchronously, while every tool call, reasoning step, and decision is surfaced through inbox approvals and monitor logs.

#### OpenAI Codex Runtime
OpenAI Codex App Server is integrated as Stagent's second governed runtime. Codex-backed tasks preserve project working directories, document context, resumable thread IDs, inbox approval requests, user questions, and provider-labeled logs. The same runtime can also power task assist, scheduled firings, and workflow child tasks.

#### Agent Profiles
Profile-backed execution with specialist definitions for different job types. Each profile packages instructions, allowed tools, max turns, and output format so teams can reuse behavior intentionally instead of relying on ad hoc prompts. Profile cards display role-based icon circles with keyword-inferred colors (blue for work, purple for personal), alongside domain tags, runtime badges, and tool counts. Workflow steps and schedules can reference profiles directly, and runtimes can be selected independently when provider support differs.

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/profiles-list.png" alt="Stagent agent profiles with role-based icon circles" width="1200" />

#### Workflows
Multi-step task orchestration with six patterns:
- **Sequence** — Steps execute in order
- **Planner→Executor** — One agent plans, another executes each step
- **Human-in-the-Loop Checkpoint** — Pauses for human approval between steps
- **Parallel** — Concurrent branch execution with fork/join synthesis
- **Loop** — Iterative agent execution with configurable stop conditions
- **Swarm** — Mayor/workers/refinery multi-agent orchestration

State machine engine with step-level retry, project association, and real-time status visualization.

#### Parallel + Swarm Workflows
Stagent supports two bounded expansion patterns on top of the workflow engine:
- **Parallel research fork/join** — 2-5 concurrent branches followed by one synthesis step
- **Swarm orchestration** — mayor → worker pool → refinery with retryable stages and configurable worker concurrency

Both patterns preserve the same governed task model, runtime selection, monitoring stream, and workflow detail surface instead of introducing a separate orchestration product.

#### AI Task Assist
AI-powered task creation: generate improved descriptions, break tasks into sub-tasks, recommend workflow patterns, and estimate complexity through the shared runtime task-assist layer. Claude and OpenAI task assist now both route through the provider runtime abstraction.

| Task Creation Form | AI Suggestions | AI Applied |
|:-:|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/dashboard-create-form-empty.png" alt="Empty task creation form" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/dashboard-create-form-ai-assist.png" alt="AI Assist suggestions panel" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/dashboard-create-form-ai-applied.png" alt="AI suggestions applied to form" width="380" /> |

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/dashboard-create-form-filled.png" alt="Completed task creation form" width="1200" />

#### AI Assist → Workflow Creation
Bridge from AI task assist to workflow engine: when task assist recommends a multi-step plan, a "Create as Workflow" button converts the recommendation into a validated workflow definition with per-step profile assignments, dependency ordering, and pattern selection across all six workflow types. The `WorkflowConfirmationSheet` lets operators review and edit steps, profiles, and configuration before creating the workflow. A keyword-based profile suggestion fallback ensures steps get reasonable profile assignments even without the AI classifier.

#### Agent Self-Improvement
Agents learn from execution history through a human-approved instruction evolution loop. After each task completion, the pattern extractor analyzes logs and proposes context updates — concise behavioral rules the agent should follow in future runs. Operators approve, reject, or edit proposals before they take effect. Learned context is versioned with rollback support and size-limited summarization to prevent unbounded growth. A sweep agent can audit the codebase for improvement opportunities and create prioritized tasks from its findings.

#### Workflow Context Batching
During workflow execution, the pattern extractor buffers context proposals into a learning session instead of creating individual notifications per proposal. When the workflow completes, all proposals are surfaced as a single batch for review. Operators can approve all, reject all, or review individually — reducing notification noise from multi-step workflows while preserving human oversight. The batch review component integrates into the existing pending approval host.

#### Session Management
Resume failed or cancelled agent tasks with one click. Tracks retry counts (limit: 3), detects expired sessions, and provides atomic claim to prevent duplicate runs.

#### Autonomous Loop Execution
Iterative agent loop pattern with four stop conditions: max iterations, time budget, human cancel, and agent-signaled completion. Each iteration creates a child task with previous output as context. Loop status view with iteration timeline, progress bar, and expandable results. Pause/resume via DB status polling.

#### Agent Profile Catalog
Curated agent profiles across work and personal domains, built as portable Claude Code skill directories with `profile.yaml` sidecars. The profile gallery displays role-based icon circles with keyword-inferred colors and supports domain filtering and search, while YAML customization, GitHub import, and behavioral smoke tests keep profile behavior inspectable and reusable.

#### Workflow Blueprints
Pre-configured workflow templates across work and personal domains. Browse blueprints in a gallery with pattern-colored icon circles, domain tags, and difficulty badges. Preview steps and required variables, fill in a dynamic form, and create draft workflows with resolved prompts and profile assignments. Create custom blueprints via YAML or import from GitHub URLs. Lineage tracking connects workflows back to their source blueprint.

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/workflows-list.png" alt="Stagent workflows with keyword-inferred icon circles" width="1200" />

| Workflow Detail | Execution Runs | Blueprint Templates |
|:-:|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/workflows-detail.png" alt="Workflow detail with steps and status" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/workflows-runs.png" alt="Workflow execution run history" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/workflows-templates.png" alt="Workflow blueprint templates gallery" width="380" /> |

| Create Workflow — Empty | Create Workflow — Filled |
|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/workflows-create-form-empty.png" alt="Empty workflow creation form" width="580" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/workflows-create-form-filled.png" alt="Filled workflow creation form" width="580" /> |

### Documents

#### Document Management
Full document browser at `/documents` with table and grid views. Upload files with drag-and-drop, preview images/PDFs/markdown/code inline, search by filename and extracted text, and filter by processing status or project. Bulk delete, link/unlink to projects and tasks.

| Table View | Grid View | Upload Dialog |
|:-:|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/documents-list.png" alt="Documents table view" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/documents-grid.png" alt="Documents grid view" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/documents-upload-form.png" alt="Document upload dialog" width="380" /> |

#### Document Preprocessing
Automatic text extraction on upload for five file types: text, PDF (pdf-parse), images (image-size), Office documents (mammoth/jszip), and spreadsheets (xlsx). Extracted text, processed paths, and processing errors are tracked per document.

#### Agent Document Context
Documents linked to a task are automatically injected into the agent's prompt as context. The context builder aggregates extracted text from all linked documents, giving agents access to uploaded reference material without manual copy-paste.

### Knowledge

#### Playbook
Built-in documentation system at `/playbook` with usage-stage awareness that adapts content to your experience level (new, early, active, power user). Browse feature reference docs and guided learning journeys organized by persona (Personal, Work, Power User, Developer). Adoption heatmap tracks which features you've explored, while journey cards show progress through multi-step learning paths. Markdown rendering with automatic internal link resolution, table of contents, related docs, and screengrab embedding.

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/playbook-list.png" alt="Stagent playbook documentation" width="1200" />

| Project Tasks Journey | Task Detail Journey | Inbox Action Journey |
|:-:|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/journey-project-tasks.png" alt="Playbook journey — project tasks" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/journey-task-detail.png" alt="Playbook journey — task detail" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/journey-inbox-action.png" alt="Playbook journey — inbox action" width="380" /> |

### Platform

#### Tool Permission Persistence
"Always Allow" option for agent tool permissions. When you approve a tool, you can save it as a pattern (e.g., `Bash(command:git *)`, `Read`, `mcp__server__tool`). Saved patterns are checked before creating notifications — trusted tools are auto-approved instantly. Manage patterns from the Settings page. `AskUserQuestion` always requires human input.

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/trust-tier-popover.png" alt="Trust tier popover with permission levels" width="600" />

#### Ambient Approvals
Pending permission requests now surface through a shell-level approval presenter on any route, so operators can respond without leaving the page they are working on. Inbox remains the durable queue and source of truth, while the ambient surface provides the fast path for active supervision.

#### Tool Permission Presets
Pre-configured permission bundles that reduce friction for common tool approval patterns. Three layered presets — read-only (file reads, glob, grep), git-safe (adds git operations), and full-auto (adds write, edit, bash) — compose with existing "Always Allow" patterns. Presets are layered: enabling git-safe automatically includes read-only patterns; removing git-safe only strips its unique additions. Risk badges indicate the trust level of each preset. Manage presets from the Settings page alongside individual tool permissions.

#### Schedules
Time-based scheduling for agent tasks with human-friendly intervals (`5m`, `2h`, `1d`) and raw 5-field cron expressions. One-shot and recurring modes with pause/resume lifecycle, expiry limits, and max firings. Each firing creates a child task through the shared execution pipeline, and schedules can now target a runtime explicitly. Scheduler runs as a poll-based engine started via Next.js instrumentation hook.

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/schedules-list.png" alt="Stagent schedules" width="1200" />

| Create Schedule — Empty | Create Schedule — Filled |
|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/schedules-create-form-empty.png" alt="Empty schedule creation form" width="580" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/schedules-create-form-filled.png" alt="Filled schedule creation form" width="580" /> |

#### Micro-Visualizations
Pure SVG chart primitives (Sparkline, MiniBar, DonutRing) with zero charting dependencies. Integrated into: homepage stats cards (7-day trends), activity feed (24h bar chart), project cards (completion donuts), monitor overview (success rate), and project detail (stacked status + 14-day sparkline). Full accessibility with `role="img"` and `aria-label`.

#### Cost & Usage
Provider-normalized metering tracks token and spend activity across tasks, resumes, workflow child tasks, schedules, task assist, and profile tests. The dedicated `Cost & Usage` surface adds summary cards, trend views, provider/model breakdowns, and budget-aware audit visibility on top of the usage ledger.

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/cost-usage-list.png" alt="Stagent cost and usage dashboard" width="1200" />

### UI & DevEx

#### Inbox & Human-in-the-Loop
When an agent needs approval or input, a notification appears in your inbox. Review tool permission requests with "Allow Once" / "Always Allow" / "Deny" buttons, answer agent questions, and see task completion summaries. Supports bulk dismiss and 10s polling.

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/inbox-list.png" alt="Stagent inbox approval flow" width="1200" />

| Expanded Notification | Fully Expanded Detail |
|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/inbox-expanded.png" alt="Inbox notification expanded" width="580" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/inbox-fully-expanded.png" alt="Inbox notification fully expanded with context" width="580" /> |

#### Monitoring
Real-time agent log streaming via Server-Sent Events. Filter by task or event type, click entries to jump to task details, and auto-pause polling when the tab is hidden (Page Visibility API).

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/monitor-list.png" alt="Stagent monitoring dashboard" width="1200" />

#### Content Handling
File upload with drag-and-drop in task creation. Type-aware content preview for text, markdown (via react-markdown), code, and JSON. Copy-to-clipboard and download-as-file for task outputs.

#### Settings
Configuration hub with provider-aware sections: Claude authentication (API key or OAuth), OpenAI Codex runtime API-key management, tool permissions (saved "Always Allow" patterns with revoke), permission presets, budget configuration, and data management.

<img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/settings-list.png" alt="Stagent settings" width="1200" />

| Permission Presets | Budget Configuration | Data Management |
|:-:|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/settings-presets.png" alt="Tool permission presets" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/settings-budget.png" alt="Budget configuration" width="380" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/settings-data.png" alt="Data management" width="380" /> |

#### CLI
The `npx stagent` entry point boots a Next.js server from the published npm package. It is built from `bin/cli.ts` into `dist/cli.js` using tsup, and serves as the primary distribution channel — no clone required.

#### Database
SQLite with WAL mode via better-sqlite3 + Drizzle ORM. Ten tables: `projects`, `tasks`, `workflows`, `agent_logs`, `notifications`, `documents`, `schedules`, `settings`, `learned_context`, `usage_ledger`. Self-healing bootstrap — tables are created on startup if missing.

#### Command Palette
Global `⌘K` command palette for fast navigation and search across tasks, projects, workflows, and settings. Recent items, fuzzy search, and keyboard-driven navigation.

| Empty Palette | Search Results |
|:-:|:-:|
| <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/command-palette-empty.png" alt="Command palette empty state" width="580" /> | <img src="https://raw.githubusercontent.com/manavsehgal/stagent/main/public/readme/command-palette-search.png" alt="Command palette search results" width="580" /> |

#### App Shell
Responsive sidebar with collapsible icon-only mode, custom Stagent logo, tooltip navigation, dark/light/system theme, and OKLCH hue 250 blue-indigo color palette. Built on shadcn/ui (New York style) with PWA manifest and app icons. Routes: Home, Dashboard, Inbox, Monitor, Projects, Workflows, Documents, Profiles, Schedules, Cost & Usage, Playbook, Settings.

#### E2E Test Automation
API-level end-to-end test suite built on Vitest with 120-second timeouts and sequential execution. Five test files cover single-task execution, sequence workflows, parallel workflows, blueprints, and cross-runtime scenarios across both Claude and Codex backends. Tests skip gracefully when runtimes are not configured, preventing CI failures. Run with `npm run test:e2e`.

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
npm run test:e2e       # E2E integration tests (requires runtime credentials)
```

### Project Structure

```
docs/                     # Playbook markdown docs + manifest.json
src/
├── app/                  # Next.js App Router pages
│   ├── dashboard/        # Task kanban board
│   ├── projects/[id]/    # Project detail
│   ├── tasks/            # Task detail + creation (redirects to dashboard)
│   ├── profiles/         # Agent profile gallery + detail + creation
│   ├── documents/        # Document browser
│   ├── workflows/        # Workflow management + blueprints
│   ├── schedules/        # Schedule management
│   ├── costs/            # Cost & usage dashboard
│   ├── playbook/         # Documentation & learning journeys
│   ├── inbox/            # Notifications
│   ├── monitor/          # Log streaming
│   └── settings/         # Configuration
├── components/
│   ├── dashboard/        # Homepage widgets + charts
│   ├── tasks/            # Board, cards, panels
│   ├── profiles/         # Profile gallery, detail, form, learned context
│   ├── workflows/        # Workflow UI + blueprints + swarm
│   ├── documents/        # Document browser + upload
│   ├── costs/            # Cost dashboard + filters
│   ├── playbook/         # Playbook docs + journeys + adoption
│   ├── schedules/        # Schedule management
│   ├── monitoring/       # Log viewer
│   ├── notifications/    # Inbox + permission actions
│   ├── settings/         # Auth, permissions, budgets, data mgmt
│   ├── shared/           # App shell, sidebar
│   └── ui/               # shadcn/ui primitives
└── lib/
    ├── agents/           # Runtime adapters, profiles, learned context, pattern extraction
    ├── db/               # Schema, migrations
    ├── docs/             # Playbook reader, adoption, usage-stage, journey tracker
    ├── documents/        # Preprocessing + context builder
    ├── workflows/        # Engine + types + blueprints
    ├── schedules/        # Scheduler engine + interval parser
    ├── settings/         # Auth, permissions, helpers
    ├── usage/            # Metering ledger + pricing registry
    ├── constants/        # Status transitions, colors
    ├── queries/          # Chart data aggregation
    ├── validators/       # Zod schemas
    └── utils/            # Shared helpers
```

### API Endpoints (52 routes)

| Domain | Endpoint | Method | Purpose |
|--------|----------|--------|---------|
| **Projects** | `/api/projects` | GET/POST | List and create projects |
| | `/api/projects/[id]` | GET/PUT/DELETE | Project CRUD |
| **Tasks** | `/api/tasks` | GET/POST | List and create tasks |
| | `/api/tasks/[id]` | GET/PATCH/DELETE | Task detail, update, delete |
| | `/api/tasks/[id]/execute` | POST | Fire-and-forget task dispatch (202) |
| | `/api/tasks/[id]/resume` | POST | Resume failed/cancelled task |
| | `/api/tasks/[id]/cancel` | POST | Cancel running task |
| | `/api/tasks/[id]/respond` | POST | Human response to agent prompt |
| | `/api/tasks/[id]/output` | GET | Task execution output |
| | `/api/tasks/[id]/logs` | GET | Task log history |
| | `/api/tasks/assist` | POST | AI task assist (description, subtasks, workflow recommendation) |
| **Workflows** | `/api/workflows` | GET/POST | List and create workflows |
| | `/api/workflows/[id]` | GET/PATCH/DELETE | Workflow detail, update, delete |
| | `/api/workflows/[id]/execute` | POST | Execute workflow |
| | `/api/workflows/[id]/status` | GET | Workflow execution status |
| | `/api/workflows/[id]/steps/[stepId]/retry` | POST | Retry failed workflow step |
| | `/api/workflows/from-assist` | POST | Create workflow from AI assist recommendation |
| **Blueprints** | `/api/blueprints` | GET/POST | List and create blueprints |
| | `/api/blueprints/[id]` | GET/DELETE | Blueprint detail and deletion |
| | `/api/blueprints/[id]/instantiate` | POST | Create workflow from blueprint |
| | `/api/blueprints/import` | POST | Import blueprint from GitHub URL |
| **Documents** | `/api/documents` | GET | List documents with joins |
| | `/api/documents/[id]` | GET/PATCH/DELETE | Document detail, metadata, deletion |
| | `/api/documents/[id]/file` | GET | Download document file |
| **Uploads** | `/api/uploads` | POST | File upload |
| | `/api/uploads/[id]` | GET/DELETE | Upload detail and deletion |
| | `/api/uploads/cleanup` | POST | Clean up orphaned uploads |
| **Profiles** | `/api/profiles` | GET | List agent profiles |
| | `/api/profiles/[id]` | GET/PUT/DELETE | Profile CRUD |
| | `/api/profiles/[id]/test` | POST | Run behavioral tests on a profile |
| | `/api/profiles/[id]/context` | GET/POST/PATCH | Learned context: version history, manual add, approve/reject/rollback |
| | `/api/profiles/import` | POST | Import profile from GitHub URL |
| **Notifications** | `/api/notifications` | GET/POST | List and create notifications |
| | `/api/notifications/[id]` | PATCH/DELETE | Update and delete notification |
| | `/api/notifications/mark-all-read` | POST | Mark all notifications as read |
| | `/api/notifications/pending-approvals` | GET | Pending approval notifications |
| | `/api/notifications/pending-approvals/stream` | GET | SSE stream for pending approvals |
| **Schedules** | `/api/schedules` | GET/POST | Schedule CRUD |
| | `/api/schedules/[id]` | GET/PATCH/DELETE | Schedule detail + updates |
| **Settings** | `/api/settings` | GET/POST | General settings |
| | `/api/settings/openai` | GET/POST | OpenAI Codex runtime settings |
| | `/api/settings/test` | POST | Provider-aware runtime connectivity test |
| | `/api/settings/budgets` | GET/POST | Budget configuration |
| | `/api/permissions` | GET/POST/DELETE | Tool permission patterns |
| | `/api/permissions/presets` | GET/POST/DELETE | Permission preset bundles |
| **Context** | `/api/context/batch` | POST | Batch approve/reject context proposals |
| **Monitoring** | `/api/logs/stream` | GET | SSE agent log stream |
| **Playbook** | `/api/playbook/status` | GET | Playbook adoption status and usage stage |
| **Platform** | `/api/command-palette/recent` | GET | Recent command palette items |
| | `/api/data/clear` | POST | Clear all data |
| | `/api/data/seed` | POST | Seed sample data |

---

## Roadmap

### MVP — Complete

All 14 features shipped across three layers:

| Layer | Features |
|-------|----------|
| **Foundation** | CLI bootstrap, database schema, app shell |
| **Core** | Project management, task board, agent integration, inbox notifications, monitoring dashboard |
| **Polish** | Homepage dashboard, UX fixes, workflow engine, AI task assist, content handling, session management |

### Post-MVP — 31 features shipped

| Category | Features |
|----------|---------|
| **Documents** (5) | File attachments, preprocessing (5 formats), agent context injection, document browser, output generation |
| **Agent Intelligence** (6) | Multi-agent routing, autonomous loops, multi-agent swarm, AI assist→workflows, agent self-improvement, workflow context batching |
| **Agent Profiles** (2) | Agent profile catalog (13+ profiles), workflow blueprints (8 templates) |
| **UI Enhancement** (13) | Ambient approvals, learned context UX, micro-visualizations, command palette, operational surface, profile surface, accessibility, UI density, kanban operations, board persistence, detail view redesign, playbook documentation, workflow UX overhaul (in-progress) |
| **Platform** (8) | Scheduled prompt loops, tool permissions, provider runtimes, OpenAI Codex runtime, cross-provider profiles, parallel fork/join, tool permission presets, npm publish (deferred) |
| **Runtime Quality** (2) | SDK runtime hardening, E2E test automation |
| **Governance** (3) | Usage metering ledger, spend budget guardrails, cost & usage dashboard |

### In Progress

| Feature | Description |
|---------|-------------|
| Workflow UX Overhaul | Document context propagation, output readability, dashboard visibility, AI assist guidance |

---

## Contributing

### Contributor Setup

```bash
git clone https://github.com/manavsehgal/stagent.git && cd stagent && npm install

# Set up one or both runtime credentials
cat > .env.local <<'EOF'
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
EOF

# Start the dev server
npm run dev
```

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes and add tests
4. Run `npm test` and `npx tsc --noEmit`
5. Submit a pull request

See `AGENTS.md` for architecture details and development conventions.

---

## License

Licensed under the [Apache License 2.0](LICENSE).

Copyright 2025-2026 [Manav Sehgal](https://stagent.io)
