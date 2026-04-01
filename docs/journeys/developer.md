---
title: "Developer Guide"
category: "user-journey"
persona: "developer"
difficulty: "advanced"
estimatedTime: "28 minutes"
sections: ["settings", "environment", "chat", "monitoring", "profiles", "workflows", "schedules"]
tags: ["advanced", "developer", "settings", "environment", "cli", "api", "monitoring", "profiles"]
lastUpdated: "2026-03-22"
---

# Developer Guide

Meet Riley, a platform engineer responsible for setting up, securing, and extending Stagent for a development team. Riley needs to configure authentication, enforce budget guardrails, define permission presets, manage data lifecycle, explore the environment control plane, understand the chat streaming architecture, monitor agent execution, inspect workflows and schedules, and script batch operations via the CLI. This journey covers the infrastructure and configuration layer that keeps the AI business operating system secure, observable, and performant.

## Prerequisites

- Stagent cloned from the repository and dependencies installed (`npm install`)
- Node.js 20+ and npm available on the system
- An Anthropic API key (for API key auth) or Claude Max subscription (for OAuth)
- Familiarity with terminal/CLI workflows and REST APIs
- Basic understanding of Stagent concepts (see [Personal Use Guide](./personal-use.md))

## Journey Steps

### Step 1: Configure Authentication

Riley starts at the Settings page -- the central hub for all system-level configuration. The first priority is getting authentication right, because every agent execution depends on a valid provider connection.

![Settings page showing auth, runtime, and configuration sections](../screengrabs/settings-list.png)

1. Click **Settings** in the sidebar under the **Configure** group
2. Locate the **Authentication** section at the top of the page
3. Choose between two authentication methods:
   - **OAuth** (default, recommended for Claude Max subscribers): Uses your Max subscription tokens with no separate API billing
   - **API Key**: Uses the `ANTHROPIC_API_KEY` from `.env.local`, billed per token
4. If using OAuth, click **Connect** to initiate the browser-based OAuth flow
5. If using API Key, verify the key is set in `.env.local` and click **Test Connection**
6. Confirm the connection status indicator shows **Connected**

> **Tip:** OAuth is the default for a reason -- it avoids per-token charges on your Anthropic account. If both OAuth and an API key are present, the SDK subprocess environment must be carefully managed to prevent the key from leaking into OAuth sessions. Stagent handles this automatically by stripping `ANTHROPIC_API_KEY` from the child process env when OAuth mode is active.

### Step 2: Set Up Budget Guardrails

With authentication in place, Riley configures spending limits. Budget controls are critical when multiple team members run agents concurrently -- a single runaway loop can burn through a monthly allocation in minutes.

![Budget guardrails section with spend cap configuration](../screengrabs/settings-budget.png)

1. Scroll to the **Budget** section in Settings (or click the section anchor)
2. Set a **Monthly Spend Cap** appropriate for the team (e.g., $50 for development, $500 for production)
3. Configure **Alert Thresholds** at 50%, 75%, and 90% of the budget
4. Choose the alert delivery method (inbox notification, browser notification, or both)
5. Enable **Hard Stop** to halt all agent execution when the cap is exceeded (recommended for non-production environments)
6. Review the current spend-to-date displayed alongside the cap

> **Tip:** Budget guardrails are enforced at the usage-metering-ledger level -- every token consumed by every provider (Anthropic and OpenAI) is metered into the ledger before the response streams back. The Cost & Usage dashboard (covered in the [Work Use Guide](./work-use.md)) visualizes spend against these limits in real time.

### Step 3: Configure Permission Presets

Riley defines the governance layer that controls what tools agents can invoke and under what conditions. Permission presets establish the baseline trust posture for the entire workspace.

![Permission presets with risk badges and toggle controls](../screengrabs/settings-presets.png)

1. Scroll to the **Permissions** section in Settings
2. Review the three built-in presets, each tagged with a risk badge:
   - **Restrictive** (Low Risk): Agents ask before every tool use -- safest, highest friction
   - **Balanced** (Medium Risk): Read operations are pre-approved, writes require human approval
   - **Autonomous** (High Risk): Most operations pre-approved, only destructive actions require approval
3. Select a preset as the workspace default by clicking its radio button
4. Optionally toggle individual tool permissions to customize beyond the preset (e.g., always allow file reads, always ask for shell commands)
5. Observe how per-tool overrides are highlighted when they diverge from the active preset

> **Tip:** Permission presets interact with the "Always Allow" button in the Inbox. When a user approves a tool with "Always Allow," that approval is persisted in the settings table and survives across sessions. The preset sets the floor; individual approvals can only escalate, never reduce, the trust level.

### Step 4: Manage Data and Storage

Riley reviews data management to understand storage footprint, configure retention policies, and know how to reset the workspace cleanly when needed.

![Data management section in Settings](../screengrabs/settings-data.png)

1. Scroll to the **Data Management** section in Settings
2. Review the **database location** (default: `~/.stagent/stagent.db`) and its current size
3. Check **storage usage** broken down by category: database, uploaded documents (`~/.stagent/uploads/`), and agent logs
4. Configure **log retention** policies (e.g., 30-day retention, auto-archive completed tasks after 90 days)
5. Use the **Clear Data** action cautiously -- it deletes all tasks, projects, workflows, documents, and logs while preserving settings
6. Note the FK-safe deletion order: child records (agent_logs, notifications) are removed before parent records (tasks, projects)

> **Tip:** The SQLite database runs in WAL (Write-Ahead Logging) mode for concurrent read performance. Agent logs and execution traces are typically the largest consumers of disk space. If the database grows beyond a few hundred megabytes, consider archiving old logs rather than clearing everything.

### Step 5: Explore the Environment Dashboard

Riley switches to the Environment page to understand the control plane -- what development tools are installed, how they are configured, and what project configurations Stagent has detected across the filesystem.

![Environment dashboard showing Claude Code and Codex CLI configurations](../screengrabs/environment-list.png)

1. Click **Environment** in the sidebar under the **Configure** group
2. Review the **detected tools** section -- Stagent's environment scanner identifies installed CLIs (Claude Code, Codex CLI), their versions, and config file locations
3. Inspect the **project configurations** panel showing discovered projects with their working directories, detected languages, and framework versions
4. Check the **health scores** for each detected environment (green = fully configured, yellow = partial, red = missing required config)
5. Note the **sync status** indicators that show whether local project configs match the canonical templates
6. Use the **Refresh** action to re-run the environment scanner if you have just installed a new tool

> **Tip:** The environment scanner reads config files like `~/.codex/config.toml`, `.claude/settings.local.json`, and project-level `AGENTS.md` files. It caches results to avoid repeated filesystem scans. The cache is invalidated automatically when Stagent detects file modification timestamps have changed, or you can force a refresh from this dashboard.

### Step 6: Understand the Chat Architecture

Riley examines the Chat interface not as a user but as a developer, tracing the request lifecycle from input to streamed response. Understanding this architecture is essential for extending or debugging the conversational layer.

![Active chat conversation with streamed response and Quick Access pills](../screengrabs/chat-conversation.png)

1. Open the **Chat** page and start or continue a conversation
2. Trace the request flow through these API endpoints:
   - `POST /api/chat` -- Accepts a message, returns an SSE-streamed response
   - `GET /api/chat/conversations` -- Lists conversations with pagination
   - `POST /api/chat/conversations` -- Creates a new conversation
   - `GET /api/chat/conversations/[id]` -- Retrieves a conversation with full message history
   - `DELETE /api/chat/conversations/[id]` -- Deletes a conversation and its messages
   - `GET /api/chat/suggested-prompts` -- Returns categorized prompt suggestions
   - `GET /api/models` -- Dynamic model catalog with cost tier metadata
3. Observe the SSE stream in your browser's Network tab -- each chunk arrives as a `stream_event` wrapper containing a delta payload
4. Notice the **Quick Access pills** rendered below AI responses -- these are parsed from entity references (tasks, projects, documents) detected in the response text
5. Review the model selector to see how the dynamic model catalog populates available models with cost tier badges

> **Tip:** The chat engine uses the same provider-runtime-abstraction as task execution, meaning it respects the same authentication method, budget caps, and usage metering. Conversation data is stored in SQLite alongside the rest of the Stagent schema, so chat history is queryable via Drizzle ORM. The `stream_event` wrapper format was a hard-won lesson -- see the codebase commit history for the blank-response fix that added proper wrapper handling.

### Step 7: Monitor Agent Execution

With the platform configured, Riley turns to the Monitor to verify that agents are executing correctly and that permission checks, budget enforcement, and tool invocations are all behaving as expected.

![Agent monitoring dashboard with execution logs](../screengrabs/monitor-list.png)

1. Click **Monitor** in the sidebar under the **Manage** group
2. Scan the execution log for recent entries -- each row shows the agent profile, task, status, duration, and token count
3. Filter by **status** to surface any error-level entries that might indicate configuration problems
4. Click an execution entry to expand its full trace:
   - **Tool calls**: What tools the agent invoked, with full argument payloads
   - **Outputs**: What each tool returned (truncated for large payloads)
   - **Timing**: Per-step duration to identify bottlenecks
   - **Token usage**: Input and output token counts per step, rolled up into the usage ledger
5. Verify that permission checks appear in the trace -- approved actions proceed, denied actions show a "waiting for approval" state, and hard-denied actions show a rejection reason

> **Tip:** The Monitor is your primary diagnostic tool. When an agent behaves unexpectedly, check the tool call arguments first -- incorrect arguments are the most common root cause. For long-running autonomous loops, the Monitor shows iteration counts and stop-condition evaluations so you can see exactly why a loop terminated.

### Step 8: Inspect Workflow Runs

Riley drills into a workflow run to understand multi-step execution. Workflows chain tasks together with dependency ordering, and the detail page shows step-by-step progress including intermediate outputs.

![Workflow detail page showing steps and execution status](../screengrabs/workflows-detail.png)

1. Click **Workflows** in the sidebar under the **Work** group
2. Select a completed or in-progress workflow run from the list
3. Review the **step timeline** showing each task in execution order with status badges (completed, running, queued, failed)
4. Click individual steps to see their execution details -- the same trace data available in the Monitor, but scoped to this workflow
5. Check the **context propagation** between steps -- outputs from earlier steps are injected as context into later steps via the workflow-context-batching system
6. Review the **total duration** and **aggregate token usage** for the entire workflow run
7. If a step failed, inspect the error and note whether the workflow halted (fail-fast) or continued (skip-on-error)

> **Tip:** Workflows support parallel execution via fork-join patterns. When you see multiple steps at the same depth level in the timeline, those ran concurrently. The workflow engine respects the same permission presets as individual task execution, so a restrictive preset can create bottlenecks in multi-step workflows if each step requires approval.

### Step 9: Review Agent Profiles

Riley reviews the agent profile catalog to understand which behavioral configurations are available and how they map to different task types and provider capabilities.

![Agent profiles grid with work and personal tabs](../screengrabs/profiles-list.png)

1. Click **Profiles** in the sidebar under the **Manage** group
2. Review the profile grid, organized into **Work** and **Personal** tabs
3. Note the profile cards showing: name, description, provider compatibility icons (Anthropic, OpenAI), and capability badges
4. Observe that each profile declares its tool access scope -- some profiles (like Code Reviewer) have deliberately narrow access
5. Check provider compatibility: profiles that support both Anthropic and OpenAI runtimes show dual provider icons, while some are provider-specific
6. Note the profile count and verify all expected profiles are loaded (General, Code Reviewer, Researcher, Document Writer, plus any custom profiles)

> **Tip:** Agent profiles and permission presets form a two-layer governance model. The profile defines *what tools are available* to the agent, and the permission preset defines *the approval level* for each tool. A restrictive preset with a broad profile still requires approval -- the narrower of the two always wins.

### Step 10: Examine Profile Configuration

Riley opens a specific profile to understand its detailed configuration -- the system prompt, tool declarations, capability flags, and provider-specific settings that shape agent behavior.

![Profile detail page showing capabilities, tools, and configuration](../screengrabs/profiles-detail.png)

1. Click any profile card to open its detail page
2. Review the **system prompt** that shapes the agent's persona and behavioral constraints
3. Examine the **tool declarations** -- the explicit list of tools this profile can invoke
4. Check the **capability flags**: can this profile access the filesystem, run shell commands, browse the web, or generate documents?
5. Review **provider-specific settings** -- some profiles have different temperature, max tokens, or model preferences per provider
6. Note the **task assignment count** showing how many tasks currently use this profile
7. Verify that the profile's tool list aligns with your permission preset expectations

> **Tip:** Profiles are defined in `src/lib/agents/profiles/` as TypeScript modules. To create a custom profile, add a new file following the pattern of existing profiles (types.ts defines the interface, registry.ts registers profiles). Custom profiles appear automatically in the UI after a server restart. The cross-provider-profile-compatibility feature ensures profiles work consistently across Anthropic and OpenAI runtimes.

### Step 11: Inspect Schedule Configuration

Riley examines a schedule to understand how automated prompt loops are configured, when they fire, and what their execution history looks like.

![Schedule detail sheet showing configuration and firing history](../screengrabs/schedules-detail.png)

1. Click **Schedules** in the sidebar under the **Manage** group
2. Select a schedule to open its detail sheet
3. Review the **schedule configuration**: prompt text, interval (e.g., "every 4 hours," "daily at 9am"), associated project, and agent profile
4. Check the **firing history** showing past executions with timestamps, durations, and outcomes (success, failed, skipped)
5. Note the **next firing time** calculated from the interval parser
6. Review the **pause/resume** toggle -- paused schedules retain their configuration but skip firings until resumed
7. Verify that the schedule's agent profile and project assignment match your team's expectations

> **Tip:** The scheduler engine runs via the Next.js `instrumentation.ts` register hook, so it starts automatically with the dev server. The interval parser supports natural language patterns like "every 30 minutes," "daily at 9am," and "weekdays at 5pm." Schedules are stored in the `schedules` table and their execution history feeds into the same Monitor and usage ledger as manual task runs.

### Step 12: Build and Test the CLI

Riley builds the CLI for scripted operations, CI/CD integration, and terminal-first workflows. The CLI shares the same SQLite database as the web UI, so changes are instantly visible in both interfaces.

![Settings page for CLI configuration reference](../screengrabs/settings-list.png)

1. Build the CLI from the project root:
   ```bash
   npm run build:cli
   ```
2. Verify the build succeeded:
   ```bash
   node dist/cli.js --help
   ```
3. Test basic CRUD operations:
   ```bash
   # List all projects
   node dist/cli.js projects list

   # Create a task
   node dist/cli.js tasks create --title "CLI test task" --project <project-id>

   # Execute a task with a specific agent profile
   node dist/cli.js tasks execute <task-id> --profile general

   # Check execution status
   node dist/cli.js tasks get <task-id>
   ```
4. Verify that CLI-created entities appear in the web UI immediately (shared SQLite database, WAL mode)

> **Tip:** The CLI entry point is `bin/cli.ts`, compiled to `dist/cli.js`. It uses the same Drizzle ORM and data access layer as the web app, so there is zero drift between interfaces. The CLI is ideal for CI/CD pipelines -- create tasks, trigger workflows, or query execution results from shell scripts.

### Step 13: Script Batch Operations

Riley creates a shell script to bootstrap a new project with predefined tasks and a workflow -- a common pattern for onboarding new team members or standardizing project initialization.

![Agent monitoring dashboard showing batch execution results](../screengrabs/monitor-list.png)

1. Create a bootstrap script that chains CLI commands:
   ```bash
   #!/bin/bash
   set -euo pipefail

   # Create the project
   PROJECT_ID=$(node dist/cli.js projects create \
     --name "New Initiative" \
     --description "Bootstrapped project" \
     --working-directory ~/Developer/new-initiative)

   # Create standard tasks with appropriate profiles
   node dist/cli.js tasks create \
     --title "Set up repository structure" \
     --project $PROJECT_ID \
     --profile general

   node dist/cli.js tasks create \
     --title "Write initial documentation" \
     --project $PROJECT_ID \
     --profile document-writer

   node dist/cli.js tasks create \
     --title "Review security configuration" \
     --project $PROJECT_ID \
     --profile code-reviewer

   echo "Project $PROJECT_ID bootstrapped with 3 tasks"
   ```
2. Run the script and verify the project and tasks appear in the web UI
3. Check the Monitor for execution traces from any tasks you triggered
4. Version-control the script so any team member can replicate the setup

> **Tip:** CLI scripts are infrastructure-as-code for your AI agent workspace. Store bootstrap scripts alongside your project code. Combine them with the schedule system for recurring maintenance tasks -- for example, a nightly script that creates a "review open PRs" task assigned to the Code Reviewer profile.

### Step 14: Verify Platform Health

Riley performs a final platform health check before handing the workspace over to the team. This checklist covers every layer touched in this journey.

![Environment dashboard for final health verification](../screengrabs/environment-list.png)

1. **Authentication**: Verify connection status in Settings shows a green **Connected** indicator
2. **Budget**: Confirm the monthly cap is set and alert thresholds are configured at 50%, 75%, and 90%
3. **Permissions**: Execute a test task and verify the correct approval prompts appear in the Inbox based on your chosen preset
4. **Data**: Confirm the database is accessible at `~/.stagent/stagent.db` and WAL mode is enabled
5. **Environment**: Check the Environment dashboard for green health scores on all detected tools
6. **Chat**: Send a test message and verify the SSE stream completes with a coherent response
7. **Monitor**: Scan for any error-level entries from the last hour
8. **Profiles**: Confirm all expected profiles are loaded and show correct provider compatibility
9. **Schedules**: Verify any active schedules show correct next-firing times
10. **CLI**: Run `node dist/cli.js --help` to confirm the build is current

> **Tip:** Run this checklist after any significant configuration change, Stagent version update, or Node.js upgrade. A healthy platform has: authenticated provider connection, budget limits enforced, default permission preset active, environment scanner green, CLI built and current, and a clean Monitor with no recent errors.

## What's Next

- [Personal Use Guide](./personal-use.md) -- Review basic project and task creation workflows
- [Work Use Guide](./work-use.md) -- Learn team collaboration, documents, cost tracking, and scheduling
- [Power User Guide](./power-user.md) -- Build advanced workflows, autonomous loops, and multi-agent swarms
