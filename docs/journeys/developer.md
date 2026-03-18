---
title: "Developer Guide"
category: "user-journey"
persona: "developer"
difficulty: "advanced"
estimatedTime: "25 minutes"
sections: ["settings", "monitoring", "profiles", "dashboard-kanban"]
tags: ["developer", "CLI", "API", "technical", "configuration", "providers"]
lastUpdated: "2026-03-17"
---

# Developer Guide

You're a developer who wants to understand Stagent's technical architecture, configure both runtimes, use the CLI for deployment, and potentially extend Stagent with custom profiles and API integrations. This guide covers the technical side of the product.

## Prerequisites
- Node.js 18+ installed
- Anthropic API key and/or OpenAI API key
- Familiarity with terminal/CLI workflows

## Journey Steps

### Step 1: Install and Start Stagent

Stagent runs as an npm package — no cloning required.

1. Open your terminal and run:
   ```bash
   npx stagent
   ```
2. Stagent starts a Next.js server at `localhost:3000`
3. Open your browser to verify the home workspace loads
4. The SQLite database is created automatically at `~/.stagent/stagent.db`

> **Tip:** Stagent uses WAL mode for SQLite, enabling concurrent reads while maintaining data integrity. The database self-heals — tables are created on startup if missing.

### Step 2: Configure Dual Runtimes

Stagent supports two AI providers. Configure both for maximum flexibility.

![Settings page](../screengrabs/settings-list.png)

1. Navigate to **Settings**
2. **Claude Configuration:**
   - Choose **OAuth** for Max subscription (no per-token cost) or **API Key**
   - If using API Key, create a `.env.local` file: `ANTHROPIC_API_KEY=your-key`
   - Click **Test Connection** to verify
3. **OpenAI Codex Configuration:**
   - Enter your OpenAI API key
   - Click **Test Connection** to verify the Codex App Server is reachable
4. Both runtimes produce logs in the same Monitor stream, labeled by provider

> **Tip:** OAuth is recommended for Claude — it uses your Max subscription instead of metered API billing. For CI/CD or server deployments, API keys are more practical.

### Step 3: Understand the Project Structure

Stagent's codebase is organized around Next.js App Router conventions:

```
src/
├── app/           # Page routes (Server Components by default)
├── components/    # React components organized by feature
├── lib/
│   ├── agents/    # Runtime adapters, profiles, execution
│   ├── db/        # Schema, migrations (Drizzle + SQLite)
│   ├── workflows/ # Engine, types, blueprints
│   └── usage/     # Metering, pricing registry
```

Key architecture decisions:
- **Server Components query the database directly** — no API layer for reads
- **API routes handle mutations only** — POST/PATCH/DELETE operations
- **Fire-and-forget execution** — task dispatch returns HTTP 202 immediately
- **SSE for streaming** — agent logs stream to the browser in real time

### Step 4: Explore the API

Stagent has 51 API endpoints. Here are the most useful for integration:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tasks` | POST | Create a task |
| `/api/tasks/[id]/execute` | POST | Execute a task (202 response) |
| `/api/tasks/[id]/output` | GET | Get task execution output |
| `/api/workflows` | POST | Create a workflow |
| `/api/workflows/[id]/execute` | POST | Execute a workflow |
| `/api/profiles` | GET | List available profiles |
| `/api/logs/stream` | GET | SSE stream of agent logs |
| `/api/settings/test` | POST | Test runtime connectivity |

1. Use your browser's dev tools or `curl` to explore the API
2. All endpoints accept and return JSON
3. The SSE stream at `/api/logs/stream` is useful for building custom monitoring

### Step 5: Set Up Tool Permissions for Development

As a developer, you'll want agents to have sufficient permissions for code tasks.

1. Navigate to **Settings** → **Tool Permissions**
2. Apply the **Git Safe** preset — this allows file reads, glob, grep, and git operations
3. For trusted development tasks, apply **Full Auto** — adds write, edit, and bash
4. Individual patterns let you fine-tune: `Bash(command:npm *)` allows npm but not arbitrary shell

> **Tip:** Start with Git Safe for code review tasks, escalate to Full Auto only for agents you trust with write access to your codebase.

### Step 6: Create Developer-Oriented Tasks

Leverage agent profiles designed for development work.

![Kanban board](../screengrabs/dashboard-list.png)

1. Navigate to **Dashboard** and click **New Task**
2. Select the **Code Reviewer** profile for security and quality analysis
3. Point the task at a specific project with a working directory
4. Write a clear prompt: "Review the authentication module for OWASP Top 10 vulnerabilities"
5. Execute and monitor the results

### Step 7: Watch Agent Execution in Detail

Use the Monitor to understand exactly what an agent does.

![Monitor with log streaming](../screengrabs/monitor-list.png)

1. Navigate to **Monitor** while a task is running
2. Filter by your specific task
3. Watch each tool call: which files the agent reads, what commands it runs
4. Look for reasoning entries — they show the agent's decision-making process
5. If something goes wrong, error entries are highlighted in red

> **Tip:** Monitoring is invaluable for debugging profiles. If an agent isn't behaving as expected, the log stream shows exactly where it diverges from your instructions.

### Step 8: Extend Profiles for Your Stack

Create profiles tailored to your development stack.

1. Navigate to **Profiles** and click **New Profile**
2. Create profiles for your common tasks:
   - "Next.js Specialist" — App Router patterns, Server Components best practices
   - "Database Migration Expert" — Drizzle ORM, SQLite optimization
   - "Test Writer" — Vitest, Testing Library, coverage-focused
3. Include stack-specific instructions and constraints
4. Test each profile before using in production

### Step 9: Use Cross-Provider Workflows

Mix providers within a single workflow for best results.

1. Create a workflow with the **Sequence** pattern
2. Step 1: "Research current best practices" — assign to Claude (good at research)
3. Step 2: "Implement the changes" — assign to OpenAI Codex (good at code generation)
4. Step 3: "Review the implementation" — assign to Claude with Code Reviewer profile
5. Execute and watch both providers work together on the same goal

### Step 10: Build the CLI

If contributing to Stagent's development:

1. Clone the repository and run `npm install`
2. Build the CLI:
   ```bash
   npm run build:cli
   ```
3. Test the build:
   ```bash
   node dist/cli.js
   ```
4. Run the test suite:
   ```bash
   npm test
   npm run test:coverage
   npm run test:e2e  # Requires runtime credentials
   ```

> **Tip:** The E2E test suite covers both runtimes, 4 profiles, and 4 workflow patterns. Tests skip gracefully when runtimes aren't configured, so CI doesn't fail.

## What's Next
- [Provider Runtimes](../features/provider-runtimes.md) — deep dive into the runtime layer
- [Tool Permissions](../features/tool-permissions.md) — advanced permission management
- [Agent Intelligence](../features/agent-intelligence.md) — self-improvement and learning
- [Power User Guide](./power-user.md) — workflows, blueprints, and swarm patterns
