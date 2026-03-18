---
title: "Getting Started"
category: "getting-started"
lastUpdated: "2026-03-18"
---

# Getting Started

Get Stagent running in under a minute and create your first governed agent task.

## Installation

Stagent runs as a single command — no clone, no build step required:

```bash
npx stagent
```

Open [localhost:3000](http://localhost:3000) in your browser. All data is stored in `~/.stagent/stagent.db` (SQLite) and uploaded files go to `~/.stagent/uploads/`.

### Requirements

- **Node.js 20+** — required for the runtime
- **One or both AI provider credentials**:
  - Anthropic API key or OAuth (for Claude Code runtime)
  - OpenAI API key (for Codex App Server runtime)

## First Run

When you open Stagent for the first time:

1. **Home Workspace** — You'll see the workspace briefing with empty stat cards
2. **Configure a runtime** — Navigate to **Settings** and enter your API key for Claude or OpenAI (or both)
3. **Test connectivity** — Use the **Test Connection** button in Settings to verify your runtime is reachable

## Your First Task

1. Navigate to **Dashboard** (kanban board)
2. Click **Create Task**
3. Enter a title and description
4. (Optional) Click **AI Assist** to get an improved description and complexity estimate
5. Click **Create** — your task appears in the "Planned" column
6. Click the task card, then **Execute** to dispatch it to an agent
7. Watch the **Monitor** page for live logs, and check **Inbox** for approval requests

## Configuration

### Claude Authentication

Go to **Settings** → Claude section:
- **OAuth** (default) — Uses your Claude subscription, no API key needed
- **API Key** — Enter your `ANTHROPIC_API_KEY` for direct API access

### OpenAI Codex Runtime

Go to **Settings** → OpenAI section:
- Enter your `OPENAI_API_KEY`
- Test the connection to verify the Codex App Server is reachable

### Tool Permissions

Agents request permission before using tools. You can streamline this:
- **Always Allow** — Save patterns for tools you trust (e.g., `Read`, `Bash(command:git *)`)
- **Presets** — Enable read-only, git-safe, or full-auto bundles from Settings

### Seed Sample Data

To explore Stagent with example data before creating your own:
1. Navigate to **Settings** → **Data Management**
2. Click **Seed Sample Data**
3. This creates sample projects, tasks, and workflows to explore

## Development

For contributors building Stagent from source:

```bash
git clone https://github.com/manavsehgal/stagent.git
cd stagent && npm install

# Set up credentials
cat > .env.local <<'EOF'
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
EOF

# Start dev server
npm run dev
```

### Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build:cli` | Build CLI to `dist/cli.js` |
| `npm test` | Run unit tests |
| `npm run test:coverage` | Coverage report |
| `npm run test:e2e` | E2E integration tests |

## What's Next

- [Personal Use Guide](./journeys/personal-use.md) — Solo productivity walkthrough
- [Work Use Guide](./journeys/work-use.md) — Team operations walkthrough
- [Feature Reference](./index.md) — Browse all features by section
