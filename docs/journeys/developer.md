---
title: "Developer Guide"
category: "user-journey"
persona: "developer"
difficulty: "advanced"
estimatedTime: "30 minutes"
sections: ["settings", "environment", "chat", "monitoring", "profiles", "workflows", "tables", "schedules", "delivery-channels"]
tags: ["advanced", "developer", "settings", "environment", "cli", "api", "monitoring", "profiles", "ollama", "channels", "handoffs", "memory", "tables"]
lastUpdated: "2026-04-16"
---

# Developer Guide

Meet Riley, a platform engineer responsible for setting up, securing, and extending `ainative-business` for a development team. Riley needs to configure authentication, connect Ollama for local models, set up delivery channels for Slack and Telegram, enforce budget guardrails, define permission presets, explore the environment control plane, understand the chat streaming and channel gateway architecture, monitor agent execution including async handoffs and episodic memory, and script batch operations via the CLI. This journey covers the infrastructure and configuration layer that keeps the AI business operating system secure, observable, and performant.

## Prerequisites

- `ainative-business` cloned from the repository and dependencies installed (`npm install`)
- Node.js 20+ and npm available on the system
- An Anthropic API key (for API key auth) or Claude Max subscription (for OAuth)
- Familiarity with terminal/CLI workflows and REST APIs
- Basic understanding of `ainative-business` concepts (see [Personal Use Guide](./personal-use.md))

## Journey Steps

### Step 1: Configure Authentication

Riley starts at the Settings page. The first priority is getting authentication right.

![Settings page showing auth, runtime, and configuration sections](../screengrabs/settings-list.png)

![Settings page scrolled to show the full layout — every subsection visible at once](../screengrabs/settings-full.png)

1. Click **Settings** in the sidebar under the **Configure** group
2. Choose between **OAuth** (default, recommended for Claude Max subscribers) and **API Key** (billed per token)
3. Click **Test Connection** to verify provider connectivity
4. For the Codex runtime, configure the App Server endpoint
5. Confirm all connection status indicators show **Connected**

> **Tip:** OAuth is the default for a reason -- it avoids per-token charges on your Anthropic account.

### Step 2: Connect Ollama for Local Runtime

Riley sets up Ollama as the fifth runtime adapter for private, zero-cost execution.

![Settings Providers and Runtimes section with authentication and runtime config](../screengrabs/settings-auth.png)

1. Install Ollama from [ollama.com](https://ollama.com) and pull models: `ollama pull llama3 && ollama pull qwen3`
2. Scroll to the **Ollama** section in Settings, then open the **Runtime** subsection to fine-tune adapter timeouts, max turns, and per-runtime defaults

![Settings Runtime subsection with per-runtime timeout and turn-limit controls](../screengrabs/settings-runtime.png)

3. Verify the URL (default: `http://localhost:11434`)
4. Click **Test Connection** -- the status shows connected with all available models listed
5. Models now appear as runtime options across tasks, schedules, workflows, and chat

> **Tip:** Ollama follows the same `AgentRuntimeAdapter` interface as all other runtimes. It uses NDJSON streaming for token delivery and is fully integrated with the smart router, usage ledger ($0 cost tracking), and profile system. The smart router can auto-select Ollama for tasks that match privacy or cost preferences.

### Step 3: Configure Delivery Channels

Riley sets up Slack and Telegram as delivery channels for schedule notifications and bidirectional chat.

![Settings Delivery Channels section](../screengrabs/settings-channels.png)

1. Scroll to **Delivery Channels** in Settings
2. Click **+ Add Channel** and select **Slack**
3. Enter the webhook URL, bot token (xoxb-), signing secret, and channel ID
4. Click **Create Channel** then **Test** to verify delivery
5. Toggle **Chat** on for bidirectional mode
6. Add a second channel for **Telegram** with bot token and chat ID
7. Test and enable Chat mode
8. Add a **Webhook** channel for custom integrations (outbound only)

> **Tip:** The channel gateway architecture is straightforward: for local development, `ainative-business` includes a built-in poller that checks Slack (`conversations.history` API) and Telegram (`getUpdates` API) every 5 seconds. No public URL or webhook registration needed. The poller only polls channels with both Chat and Active toggles on. Channel conversations flow through the same chat engine as web conversations, including tool access and permission handling.

### Step 4: Set Up Budget Guardrails

![Budget guardrails section with spend cap configuration](../screengrabs/settings-budget.png)

1. Scroll to the **Budget** section in Settings
2. Set a **Monthly Spend Cap** appropriate for the team
3. Configure alert thresholds at 50%, 75%, and 90%
4. Enable **Hard Stop** to halt agent execution when the cap is exceeded
5. Review current spend-to-date

> **Tip:** Ollama executions are tracked at $0, so routing routine tasks to local models directly reduces spend against the budget cap.

### Step 5: Configure Permission Presets

![Permission presets with risk badges and toggle controls](../screengrabs/settings-presets.png)

1. Scroll to the **Permissions** section
2. Review the three presets with risk badges (Read Only, Git Safe, Full Auto)
3. Select a preset as the workspace default

![Settings Permissions subsection with per-tool grants and revoke controls](../screengrabs/settings-permissions.png)

4. For per-tool grants beyond the presets, expand the **Permissions** subsection — each previously approved "Always Allow" decision is listed and can be revoked individually
5. Optionally toggle individual tool permissions for fine-grained control

### Step 6: Manage Data and Storage

![Data management section in Settings](../screengrabs/settings-data.png)

1. Scroll to **Data Management**
2. Review database location (`~/.ainative/ainative.db`) and storage usage
3. Use **Clear Data** cautiously -- it removes all workspace content while preserving settings
4. Use **Populate Sample Data** for demos or testing

### Step 6a: Take a Database Snapshot Backup

Riley wants a point-in-time backup before running a risky migration or a destructive clear.

![Settings snapshots card with create/restore/download controls](../screengrabs/settings-snapshots.png)

1. Scroll to the **Snapshots** card inside **Data Management**
2. Click **Create Snapshot** — `ainative-business` copies the SQLite database (with WAL checkpoint) into a named, timestamped snapshot file stored alongside the live DB
3. Give the snapshot a descriptive label ("before-v2-migration", "post-sample-seed") so future-you can find it
4. To restore, pick a snapshot from the list and click **Restore** — the live DB is atomically swapped with the snapshot contents
5. To archive off-host, click **Download** to get a `.sqlite` file you can stash in your backup system

> **Tip:** Snapshots are the fastest safety net for experiments that touch tables, workflows, or schedules. Always take one before clearing data or trying an unfamiliar migration path.

### Step 7: Explore the Environment Dashboard

Riley switches to the Environment page to understand the control plane.

![Environment dashboard showing Claude Code and Codex CLI configurations](../screengrabs/environment-list.png)

1. Click **Environment** in the sidebar
2. Review detected tools (Claude Code, Codex CLI, Ollama), their versions, and config file locations
3. Inspect project configurations with working directories and detected frameworks
4. Check health scores for each detected environment
5. Use **Refresh** to re-run the environment scanner

> **Tip:** The environment scanner reads config files and caches results. The cache invalidates automatically when file timestamps change.

### Step 8: Understand the Chat and Channel Architecture

Riley traces the request lifecycle from input to streamed response across both web and channel interfaces.

![Chat interface with conversation thread and streamed response](../screengrabs/chat-detail.png)

1. Open **Chat** and start a conversation
2. Trace the API flow: `POST /api/chat` (SSE stream), `GET/POST/DELETE /api/chat/conversations`, `GET /api/models`
3. Observe the SSE stream in the browser Network tab
4. Note that channel conversations (Slack/Telegram) flow through the same chat engine:
   - Inbound: poller reads messages from Slack/Telegram -> creates/continues conversation -> sends response via channel API
   - Turn locking prevents concurrent processing of the same conversation
   - Permission requests are surfaced in the channel itself ("approve" / "deny" replies)

### Step 9: Monitor Agent Execution and Handoffs

![Agent monitoring dashboard with execution logs](../screengrabs/monitor-list.png)

1. Click **Monitor** in the sidebar
2. Scan the execution log for recent entries
3. Filter by status to surface errors
4. Expand entries to see tool calls, outputs, timing, and token usage
5. Look for **handoff traces** -- when agents use `send_handoff` to delegate work, the monitor shows the handoff chain with governance checks (chain depth limits, self-handoff prevention)
6. Verify permission checks appear in traces: approved actions proceed, denied actions show rejection reasons

> **Tip:** The async handoff system uses an `agent_messages` table as a message bus. Governance gates are enforced at the API level -- chain depth limits and self-handoff prevention cannot be bypassed by the agent.

### Step 10: Inspect Episodic Memory

Riley reviews the episodic memory system that gives agents persistent knowledge.

![Profile detail showing capabilities](../screengrabs/profiles-detail.png)

1. Open a **Profile** detail page
2. The memory browser shows knowledge entries the agent has accumulated across task executions
3. Each memory has a confidence score and a timestamp -- confidence decays over time
4. Entries are relevance-filtered during retrieval: only memories relevant to the current task context are injected
5. Review the memory API endpoints:
   - `GET /api/memory` -- list memories with optional profile and relevance filters
   - `POST /api/memory` -- create a memory entry manually
   - `DELETE /api/memory/[id]` -- remove a specific memory
6. Memories are stored in the `agent_memory` table, distinct from the behavioral `learned_context` table

> **Tip:** Episodic memory captures *facts* (company research, discovered configurations, market data). Learned context captures *behaviors* (preferred code patterns, formatting conventions). Both systems work together but serve different purposes.

### Step 10b: Author a Custom Agent Profile

Riley wants to ship a new behavioral profile (`api-contract-reviewer`) that other team members can use. Profile authoring is form-driven — no YAML editing required for the common case.

![Create profile form with empty name, description, and capabilities fields](../screengrabs/profiles-create-form-empty.png)

1. Open **Profiles** in the sidebar under the **Compose** group and click **Create Profile**
2. Enter a **Name** (`api-contract-reviewer`), **Description**, and pick **Capabilities** the profile should have access to (read_file, run_shell, search, etc.)
3. Optionally write a **System Prompt** and pin **Tools** the profile should default to

![Create profile form with all fields filled in for an api-contract-reviewer profile](../screengrabs/profiles-create-form-filled.png)

4. Click **Create** — the profile registers immediately and is available in the chat profile selector and the task assignment dropdown
5. Optionally test the profile by chatting with it: `@api-contract-reviewer review this file…`

> **Tip:** Profiles authored in the UI persist as JSON under `~/.ainative/profiles/`. To version-control or share a profile across machines, copy the JSON file to a teammate's profiles folder — the registry hot-reloads on first use.

### Step 11: Inspect Workflow Runs

![Workflow detail page showing steps and execution status](../screengrabs/workflows-detail.png)

1. Select a workflow run to review step-by-step execution
2. Check context propagation between steps
3. Review total duration and aggregate token usage
4. Note handoff steps where one agent delegated to another mid-workflow

### Step 12: Explore the Tables API and Agent Tools

Riley reviews the tables subsystem -- 12 agent tools that let AI agents create, query, and mutate structured data via chat or task execution.

1. Review the tables API routes:
   - `GET/POST /api/tables` -- list and create tables
   - `GET/PATCH/DELETE /api/tables/[id]` -- single table CRUD
   - `GET/POST /api/tables/[id]/charts` -- chart management per table
   - `GET/POST /api/tables/[id]/triggers` -- workflow triggers attached to table events
2. Inspect the 12 agent tools registered for tables: `create_table`, `list_tables`, `get_table`, `update_table`, `delete_table`, `add_row`, `update_row`, `delete_row`, `query_table`, `add_column`, `create_chart`, `create_trigger`
3. Test from Chat: ask "Create a table called Deploy Log with columns: service, version, status, deployed_at" and verify the agent calls the `create_table` tool
4. Verify that table mutations from agent tools appear in the web UI in real time
5. Check that workflow triggers fire correctly when an agent adds or updates a row via tool call

> **Tip:** The tables agent tools enable a powerful pattern: agents can build and populate structured datasets during task execution, then other agents or workflows can query those tables for downstream decisions. This turns tables into a shared knowledge layer between agents.

### Step 13: Review Schedule Configuration

![Schedules list showing active and configured schedules](../screengrabs/schedules-list.png)

1. Select a schedule to open its detail sheet
2. Review configuration: prompt, interval, heartbeat checklist, delivery channels
3. Check firing history including suppressed heartbeat runs
4. Verify the NLP-parsed interval matches the intended cadence

> **Tip:** The scheduler engine runs via the Next.js `instrumentation.ts` register hook. The interval parser supports both natural language and standard cron expressions.

### Step 14: Build and Test the CLI

Riley builds the CLI for scripted operations and CI/CD integration.

![Settings page for CLI configuration reference](../screengrabs/settings-list.png)

1. Build the CLI: `npm run build:cli`
2. Verify: `node dist/cli.js --help`
3. Test CRUD operations: `node dist/cli.js projects list`, `node dist/cli.js tasks create --title "CLI test"`
4. Verify CLI-created entities appear in the web UI (shared SQLite database)

### Step 14a: Understand the Runtime Capability Matrix

Riley wants to know why some features show up on one runtime but not another. The answer lives in the runtime capability matrix.

1. Open `src/lib/agents/runtime/catalog.ts` — each runtime adapter declares flags like `supportsSkillComposition`, `maxActiveSkills`, `hasNativeSkills`, `stagentInjectsSkills`, and `autoLoadsInstructions`
2. The Chat Skills tab reads `supportsSkillComposition` to decide whether to enable multi-skill activation and "N of M active" reporting
3. The SKILL.md injector reads `stagentInjectsSkills` to avoid duplicating context on runtimes (like Codex App Server and Claude Agent SDK) that load instructions natively
4. When you wire a new feature that touches system prompts or skills, consult the matrix before deciding whether `ainative-business` should inject something or trust the runtime to do so

> **Tip:** The MCP task-tools boundary also validates the runtime ID now (runtime-validation-hardening). Malformed `runtimeId` values are rejected at the boundary with a clean error, rather than crashing the dispatcher.

### Step 14b: Observe the Upgrade Detection Poller

![Instance section showing dev mode status and upgrade detection gate](../screengrabs/settings-instance.png)

1. Scroll to the **Instance** section in Settings to see the dev mode status and upgrade detection gate
2. The hourly scheduler runs `git fetch` against the upstream remote and compares `HEAD` to `origin/main`
3. When upstream is ahead, the sidebar shows an **Upgrade available** badge and the Instance card reports the commits-behind count
4. Three consecutive poll failures escalate to a persistent inbox notification (three-strike dedup prevents notification floods)
5. The upgrade session uses the `upgrade-assistant` profile, which allowlists **AskUserQuestion** — the assistant can ask direct questions mid-merge without hitting a generic permission prompt

> **Tip:** The Instance card also shows bootstrap status. In dev mode (indicated by `AINATIVE_DEV_MODE=true` or the `.git/ainative-dev-mode` sentinel), auto-upgrade machinery is skipped to avoid interfering with contributor workflows.

### Step 15: Verify Platform Health

Riley performs a final platform health check.

![Environment dashboard for final health verification](../screengrabs/environment-list.png)

1. **Authentication**: Verify connection status for all configured providers (Claude, Codex, Ollama)
2. **Budget**: Confirm monthly cap and alert thresholds are set
3. **Permissions**: Execute a test task and verify approval prompts match the active preset
4. **Delivery Channels**: Verify Slack and Telegram channels show green "ok" test status with Chat enabled
5. **Environment**: Check green health scores on all detected tools
6. **Chat**: Send a test message and verify SSE stream completes; send a message from Slack/Telegram to verify bidirectional flow
7. **Monitor**: Scan for error-level entries from the last hour
8. **Profiles**: Confirm all profiles loaded with correct provider compatibility (including Ollama)
9. **Schedules**: Verify active schedules show correct next-firing times and delivery channels
10. **CLI**: Run `node dist/cli.js --help` to confirm the build is current

> **Tip:** Run this checklist after any significant configuration change, `ainative-business` version update, or Node.js upgrade.

## What's Next

- [Personal Use Guide](./personal-use.md) -- Review basic project and task creation workflows
- [Work Use Guide](./work-use.md) -- Learn team collaboration, documents, cost tracking, and scheduling
- [Power User Guide](./power-user.md) -- Build advanced workflows, autonomous loops, and multi-agent swarms
