---
title: "Developer Guide"
category: "user-journey"
persona: "platform-engineer"
difficulty: "advanced"
estimatedTime: "20 minutes"
sections: ["Settings", "Monitor", "Profiles", "CLI"]
tags: ["settings", "authentication", "runtime", "permissions", "cli", "configuration"]
lastUpdated: "2026-03-21"
---

# Developer Guide

Meet Riley, a platform engineer responsible for setting up and maintaining the Stagent installation for a development team. Riley needs to configure authentication, set up provider runtimes, define permission presets, manage data, monitor agent behavior, and use the CLI for scripted operations. This journey covers the infrastructure and configuration layer that keeps Stagent secure and performant.

## Prerequisites

- Stagent cloned from the repository and dependencies installed (`npm install`)
- Node.js 20+ and npm available on the system
- An Anthropic API key (for API key auth) or Claude Max subscription (for OAuth)
- Familiarity with terminal/CLI workflows
- Basic understanding of Stagent concepts (see [Personal Use Guide](./personal-use.md))

## Journey Steps

### Step 1: Open the Settings Page

Riley starts by configuring the platform. The Settings page is the central hub for all system-level configuration -- authentication, providers, permissions, budgets, and data management.

![Settings page showing configuration sections](../screengrabs/settings-list.png)

1. Click **Settings** in the sidebar under the **Configure** group
2. Review the available settings sections organized into logical groups
3. Note the key sections: **Authentication**, **Runtime**, **Permissions**, **Budget**, and **Data Management**

> **Tip:** Settings changes take effect immediately. There is no "save and restart" cycle -- Stagent picks up configuration changes on the next agent execution.

### Step 2: Configure Authentication

Riley sets up the authentication method that agents will use to communicate with the Anthropic API. This is the most critical configuration step.

![Settings page with auth configuration](../screengrabs/settings-list.png)

1. Navigate to the **Authentication** section in Settings
2. Choose between two authentication methods:
   - **OAuth** (recommended for Claude Max subscribers): Uses your Max subscription tokens, no separate API billing
   - **API Key**: Uses the `ANTHROPIC_API_KEY` from `.env.local`, billed per token
3. If using OAuth, click **Connect** to initiate the OAuth flow in your browser
4. If using API Key, verify the key is set in `.env.local` and click **Test Connection**
5. Confirm the connection status shows **Connected**

> **Tip:** OAuth is the default and recommended method. It uses your Claude Max subscription so you do not incur per-token API charges. API Key mode is useful for CI/CD environments or when OAuth is not available. Be aware that if both are configured, the SDK environment must be carefully managed to avoid unexpected billing (see MEMORY.md for the env isolation lesson).

### Step 3: Set Up Budget Controls

Riley configures spending limits to prevent runaway costs. Budget controls are especially important when multiple team members are running agents concurrently.

![Budget settings showing spend limits and alerts](../screengrabs/settings-budget.png)

1. Navigate to the **Budget** section in Settings
2. Set a **Monthly Budget Limit** appropriate for the team (e.g., $50 for development, $500 for production)
3. Configure **Alert Thresholds** at 50%, 75%, and 90% of the budget
4. Choose the alert notification method (inbox notification, email, or both)
5. Enable **Hard Stop** if you want agents to halt when the budget is exceeded (recommended for non-production)

> **Tip:** Start with a conservative budget and increase it as you understand your team's usage patterns. The Cost & Usage dashboard (covered in the [Work Use Guide](./work-use.md)) helps you track actual spend against these limits.

### Step 4: Configure Permission Presets

Riley defines permission presets that control what tools agents can use and under what conditions. This is the governance layer that makes Stagent safe for team use.

![Permission presets showing tool access tiers](../screengrabs/settings-presets.png)

1. Navigate to the **Permissions** section in Settings
2. Review the default permission presets:
   - **Restrictive**: Agents ask before every tool use (safest, highest friction)
   - **Balanced**: Common read operations are pre-approved, writes require approval
   - **Autonomous**: Most operations pre-approved, only destructive actions require approval
3. Select a preset as the workspace default
4. Customize individual tool permissions if needed (e.g., always allow file reads, always ask for shell commands)
5. Save the configuration

> **Tip:** Permission presets interact with per-task trust tier overrides. The preset sets the baseline, and individual approvals from the Inbox can escalate specific tools to "Always Allow." Start with Balanced for most teams.

### Step 5: Manage Data and Storage

Riley reviews the data management settings to understand storage usage, configure cleanup policies, and manage the SQLite database.

![Data management settings showing storage and cleanup options](../screengrabs/settings-data.png)

1. Navigate to the **Data Management** section in Settings
2. Review the **database location** (default: `~/.stagent/stagent.db`)
3. Check **storage usage** for the database, uploaded documents, and agent logs
4. Configure **log retention** policies (e.g., keep logs for 30 days, auto-archive completed tasks after 90 days)
5. Use the **Clear Data** option cautiously -- it removes all tasks, projects, and logs (settings are preserved)

> **Tip:** The SQLite database runs in WAL (Write-Ahead Logging) mode for concurrent read performance. For large teams, monitor the database size periodically. Agent logs are typically the largest consumer of storage.

### Step 6: Monitor Agent Execution

With the platform configured, Riley checks the Monitor section to verify that agents are executing correctly under the new settings.

![Monitor showing agent execution logs and traces](../screengrabs/monitor-list.png)

1. Click **Monitor** in the sidebar under the **Manage** group
2. Review recent agent execution entries
3. Look for any **error-level** entries that might indicate configuration problems
4. Click on an execution entry to view the full trace:
   - **Tool calls**: What tools the agent invoked and their arguments
   - **Outputs**: What each tool returned
   - **Timing**: How long each step took
   - **Token usage**: Input and output token counts per step
5. Verify that permission checks are working as expected (approved actions should proceed, denied actions should halt)

> **Tip:** The Monitor is your diagnostic tool. When an agent behaves unexpectedly, the execution trace shows exactly what happened. Check tool call arguments first -- incorrect arguments are the most common cause of unexpected behavior.

### Step 7: Review Agent Profiles

Riley reviews the available agent profiles to understand how they interact with the permission system and to ensure appropriate defaults for the team.

![Agent profiles showing behavioral configurations](../screengrabs/profiles-list.png)

1. Click **Profiles** in the sidebar under the **Manage** group
2. Review each profile's **tool permissions** -- some profiles have narrower tool access by design
3. Verify that the **Code Reviewer** profile has read-only file access (it should not modify code)
4. Confirm that the **Document Writer** profile has write access to the output directory
5. Check that the **Researcher** profile has web access enabled if your workflow requires it

> **Tip:** Agent profiles and permission presets work together. The profile defines what tools are available, and the permission preset defines the approval level for each tool. A restrictive preset with a broad profile still requires approval -- the narrower of the two wins.

### Step 8: Build and Test the CLI

Riley builds the CLI for scripted operations, CI/CD integration, and terminal-based workflows. The CLI provides all Stagent functionality without the web interface.

![Settings page for reference on CLI configuration](../screengrabs/settings-list.png)

1. Build the CLI from the project root:
   ```bash
   npm run build:cli
   ```
2. Verify the build succeeded:
   ```bash
   node dist/cli.js --help
   ```
3. Test basic operations:
   ```bash
   # List all projects
   node dist/cli.js projects list

   # Create a task
   node dist/cli.js tasks create --title "CLI test task" --project <project-id>

   # Execute a task
   node dist/cli.js tasks execute <task-id>
   ```
4. Review the CLI output format and verify it matches the web UI state

> **Tip:** The CLI uses the same SQLite database as the web interface. Changes made via CLI are immediately visible in the web UI and vice versa. This makes the CLI ideal for scripting -- create tasks in bulk, trigger workflows, or export data.

### Step 9: Script Batch Operations with the CLI

Riley creates a shell script to bootstrap a new project with predefined tasks -- a common pattern for onboarding new team members or starting new initiatives.

![Monitor showing execution results from CLI-triggered tasks](../screengrabs/monitor-list.png)

1. Create a shell script that uses the CLI to:
   ```bash
   # Create a project
   PROJECT_ID=$(node dist/cli.js projects create \
     --name "New Initiative" \
     --description "Bootstrapped project with standard tasks" \
     --working-directory ~/Developer/new-initiative)

   # Create standard tasks
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
   ```
2. Run the script and verify the project and tasks appear in the web UI
3. Check the Monitor for any execution issues

> **Tip:** CLI scripts are version-controllable. Store your project bootstrap scripts alongside your code so any team member can replicate the workspace setup. This is infrastructure-as-code for your AI agent workspace.

### Step 10: Verify Platform Health

Riley performs a final platform health check to ensure everything is configured correctly and running smoothly before handing the workspace over to the team.

![Monitor showing clean execution logs](../screengrabs/monitor-list.png)

1. **Authentication**: Verify connection status in Settings (green indicator)
2. **Budget**: Confirm limits are set and alerts are configured
3. **Permissions**: Test that the preset works by executing a task and checking the Inbox for appropriate permission prompts
4. **Database**: Verify the database is accessible and WAL mode is enabled
5. **CLI**: Run `node dist/cli.js --help` to confirm the build is current
6. **Monitor**: Check for any error-level entries in the last hour
7. **Profiles**: Confirm all four profiles are loaded and accessible

> **Tip:** Run this health check after any significant configuration change or Stagent version update. A healthy platform has: authenticated provider connection, budget limits set, default permission preset chosen, CLI built and accessible, and a clean Monitor with no recent errors.

## What's Next

- [Personal Use Guide](./personal-use.md) -- Review basic project and task creation workflows
- [Work Use Guide](./work-use.md) -- Learn team collaboration, documents, and scheduling
- [Power User Guide](./power-user.md) -- Build advanced workflows and autonomous agent loops
