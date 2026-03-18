---
title: "Getting Started"
category: "getting-started"
lastUpdated: "2026-03-17"
---

# Getting Started

Get Stagent running in under 5 minutes. This guide covers installation, first-run configuration, and connecting to an AI provider.

## Installation

Stagent runs as an npm package — no cloning or building required.

```bash
npx stagent
```

Open [localhost:3000](http://localhost:3000) in your browser.

That's it. Stagent creates its SQLite database automatically at `~/.stagent/stagent.db` and starts a Next.js server.

## First Run

When you first open Stagent, you'll see the Home workspace with empty stat cards. Before agents can execute tasks, you need to connect at least one AI provider.

### Connect Claude (Recommended)

1. Click **Settings** in the sidebar
2. In the **Authentication** section, choose your method:
   - **OAuth** — uses your Claude Max subscription (no per-token cost)
   - **API Key** — paste your Anthropic API key (metered billing)
3. Click **Test Connection** — you should see a green status indicator

### Connect OpenAI Codex (Optional)

1. In Settings, find the **OpenAI Codex** section
2. Enter your OpenAI API key
3. Click **Test Connection** to verify

### Alternative: Environment File

For developer setups, create a `.env.local` file in Stagent's directory:

```bash
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key    # Optional
```

## Configuration

### Tool Permissions

By default, agents ask for permission before using any tool. To reduce approval friction:

1. Navigate to **Settings** → **Tool Permissions**
2. Apply a **preset**:
   - **Read Only** — file reads, glob, grep (safest)
   - **Git Safe** — adds git operations
   - **Full Auto** — adds write, edit, bash (maximum autonomy)

### Seed Sample Data

To explore Stagent with example data before creating your own:

1. Navigate to **Settings** → **Data Management**
2. Click **Seed Sample Data**
3. This creates sample projects, tasks, and workflows to explore

## Your First Task

1. Navigate to **Projects** → click **New Project** → give it a name
2. Navigate to **Dashboard** → click **New Task**
3. Enter a title and description, select your project
4. Click **Create**, then click **Execute** on the task card
5. Watch the agent work in **Monitor** and handle approvals in **Inbox**

## Next Steps

- [Personal Use Guide](./journeys/personal-use.md) — full walkthrough for solo productivity
- [Work Use Guide](./journeys/work-use.md) — documents, schedules, and budgets
- [Feature Reference](./index.md#feature-reference) — detailed docs for every section

## Development

For contributors building Stagent from source:

```bash
git clone <repo-url> && cd stagent && npm install
npm run dev            # Next.js dev server (Turbopack)
npm run build:cli      # Build CLI → dist/cli.js
npm test               # Run Vitest
npm run test:coverage  # Coverage report
npm run test:e2e       # E2E integration tests
```

See [Developer Guide](./journeys/developer.md) for the full technical walkthrough.
