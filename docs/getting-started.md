---
title: "Getting Started"
category: "getting-started"
lastUpdated: "2026-03-31"
---

# Getting Started

Get ainative running in under a minute and create your first AI-powered business task.

## Installation

### Quick Start (npx)

ainative runs as a single command with no clone or build step required:

```bash
npx ainative-business
```

This downloads and launches ainative on [localhost:3000](http://localhost:3000). All data is stored locally:

- **Database**: `~/.ainative/ainative.db` (SQLite with WAL mode)
- **Uploads**: `~/.ainative/uploads/`

### From Source

For contributors or developers who want full control:

```bash
git clone https://github.com/manavsehgal/ainative.git
cd ainative && npm install
npm run dev
```

### Requirements

- **Node.js 20+** required for the runtime
- **One or more AI provider credentials**:
  - Anthropic API key or OAuth token (for Claude runtimes)
  - OpenAI API key (for Codex and OpenAI Direct runtimes)
  - Ollama installed locally (for free local model execution -- no API key needed)

## First Run

When you open ainative for the first time at [localhost:3000](http://localhost:3000):

1. **Home Workspace** appears with empty stat cards, an activity feed placeholder, and sidebar navigation
2. **Configure a runtime** by navigating to **Settings** to enter your provider credentials
3. **Test connectivity** using the **Test Connection** button in Settings to verify your runtime is reachable
4. **(Optional) Connect Ollama** for local models -- install Ollama, pull a model, then test the connection in Settings

The Home Workspace serves as your daily briefing with active work counts, pending reviews, and a live activity stream that populates as you create and execute tasks.

## Configuration

### Claude Authentication

Navigate to **Settings** to configure Claude access:

- **OAuth** (recommended) -- Uses your Claude Max or Pro subscription. No API key needed. Best for users with an existing Anthropic subscription
- **API Key** -- Enter your `ANTHROPIC_API_KEY` for direct API access. Useful for programmatic or metered usage

OAuth is the default authentication method and is recommended for most users to avoid unexpected API charges.

### Codex Runtime Setup

To enable the OpenAI Codex runtime alongside Claude:

1. Navigate to **Settings**
2. Enter your `OPENAI_API_KEY` in the OpenAI section
3. Click **Test Connection** to verify the Codex App Server is reachable
4. Once connected, you can select Codex as the runtime when creating or executing tasks

### Ollama Setup (Local Models)

Run AI tasks locally with zero API cost:

1. Install Ollama from [ollama.com](https://ollama.com)
2. Pull a model: `ollama pull llama3`
3. Navigate to **Settings** and scroll to the **Ollama** section
4. Click **Test Connection** to verify Ollama is reachable
5. Your local models will appear as runtime options throughout the workspace

### Budget Configuration

Control AI spending from **Settings**:

- Set monthly or per-task budget limits
- View token usage breakdowns by provider
- Enable budget guardrails that pause execution when thresholds are reached
- Monitor cumulative spend on the **Cost & Usage** page (`/costs`)
- Ollama executions are tracked at $0, reducing cloud API spend

### Tool Permissions

Agents request permission before using tools. Streamline approvals from **Settings**:

- **Always Allow** -- Save patterns for tools you trust (e.g., `Read`, `Bash(command:git *)`)
- **Presets** -- Enable read-only, git-safe, or full-auto permission bundles
- **Per-request** -- Review and approve individual tool calls from the **Inbox**

### Delivery Channels

Receive schedule results and chat with ainative from Slack, Telegram, or webhooks:

1. Navigate to **Settings** and scroll to **Delivery Channels**
2. Click **+ Add Channel** and configure your messaging service
3. Click **Test** to verify connectivity
4. Toggle **Chat** on for bidirectional mode (Slack and Telegram only)

See the [Delivery Channels](./features/delivery-channels.md) guide for detailed per-service setup instructions.

### Seed Sample Data

To explore ainative with example data before creating your own:

1. Navigate to **Settings** then **Data Management**
2. Click **Seed Sample Data**
3. This creates sample projects, tasks, and workflows you can browse and execute

## Creating Your First Task

1. Navigate to **Tasks** (`/tasks`) to see the kanban board
2. Click **Create Task** to open the task creation form
3. Enter a title and description for your task
4. (Optional) Click **AI Assist** to get an improved description, complexity estimate, and suggested agent profile
5. (Optional) Assign a project, select an agent profile, or attach documents
6. Click **Create** -- your task appears in the "Planned" column
7. Click the task card to open its detail view, then click **Execute** to dispatch it to an agent
8. Watch the **Monitor** page (`/monitor`) for live execution logs
9. Check **Inbox** (`/inbox`) for any tool approval requests the agent sends during execution

## CLI Usage

ainative includes a CLI for headless and scripted workflows:

```bash
# Build the CLI from source
npm run build:cli

# Run the CLI
node dist/cli.js

# Or use the published package
ainative
```

### Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build:cli` | Build CLI to `dist/cli.js` |
| `npm test` | Run unit tests |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:e2e` | Run end-to-end integration tests |

## What's Next

- [Personal Use Guide](./journeys/personal-use.md) -- Solo productivity walkthrough with heartbeat scheduling and Telegram
- [Work Use Guide](./journeys/work-use.md) -- Team operations with multi-channel delivery and agent handoffs
- [Power User Guide](./journeys/power-user.md) -- Ollama local models, episodic memory, and NLP scheduling
- [Developer Guide](./journeys/developer.md) -- Platform configuration, channel architecture, and CLI tooling
- [Feature Reference](./index.md) -- Browse all features by section
