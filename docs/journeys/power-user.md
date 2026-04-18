---
title: "Power User Guide"
category: "user-journey"
persona: "power-user"
difficulty: "advanced"
estimatedTime: "30 minutes"
sections: ["dashboard-kanban", "profiles", "chat", "workflows", "tables", "schedules", "monitoring", "settings"]
tags: ["advanced", "automation", "workflows", "profiles", "tables", "schedules", "monitoring", "bulk-operations", "ollama", "episodic-memory", "nlp-scheduling"]
lastUpdated: "2026-04-16"
---

# Power User Guide

Meet Sam, a DevOps engineer who automates everything that can be automated. Sam has already completed the Personal Use Guide and runs ainative daily as an AI business operating system. Now Sam is ready to go deeper: specialized agent profiles, multi-step workflow pipelines, NLP-driven scheduling, Ollama local models, episodic memory, bulk operations, and real-time monitoring. This guide covers the advanced automation layer that puts entire business processes on autopilot.

## Prerequisites

- ainative installed and running locally (`npm run dev`)
- An Anthropic API key configured in `.env.local`
- Familiarity with basic ainative concepts (see [Personal Use Guide](./personal-use.md))
- At least one project with several completed tasks (agents learn from past context)

## Journey Steps

### Step 1: Master Keyboard Navigation

Sam refuses to reach for the mouse when a keystroke will do. The Command Palette is the nerve center of keyboard-driven navigation.

![Command palette overlay showing available commands and navigation](../screengrabs/command-palette-empty.png)

1. Press **Cmd+K** to open the Command Palette
2. Without typing anything, scan the **recent items** and **suggested actions**
3. Type a partial name to filter across projects, tasks, workflows, schedules, and pages
4. Use **arrow keys** to highlight an item and press **Enter** to navigate or execute

> **Tip:** Power users open the palette dozens of times per session -- muscle memory for Cmd+K pays for itself on day one.

### Step 2: Explore Agent Profiles

Before building any automation, Sam reviews the available agent profiles. The catalog now includes business-function profiles alongside technical ones.

![Agent profiles grid showing available behavioral profiles](../screengrabs/profiles-list.png)

1. Click **Profiles** in the sidebar under the **Compose** group
2. Browse profile cards -- each displays the name, description, runtime badges, and capabilities
3. Switch between **Work** and **Personal** tabs
4. Note the business-function profiles: Marketing Strategist, Sales Researcher, Customer Support Agent, Financial Analyst, Content Creator, and Operations Coordinator
5. Click any profile card to open its full detail page

> **Tip:** Think of profiles as IAM roles -- purpose-fit and least privilege. A Financial Analyst profile produces structured reports with proper methodology; the General profile produces softer summaries.

### Step 3: Deep-Dive into Profile Configuration

![Profile detail page showing capabilities, tools, and full configuration](../screengrabs/profiles-detail.png)

1. Click a profile card to open the detail page
2. Read the **system prompt** section
3. Review the **capabilities** list and **tool permissions**
4. Check runtime compatibility badges to see which providers the profile supports
5. Note that profiles work across all five runtimes (Claude SDK, Codex, Anthropic Direct, OpenAI Direct, Ollama)

### Step 4: Connect Ollama for Local Models

Sam wants to run privacy-sensitive tasks on local models with zero API cost.

![Settings Providers and Runtimes section with runtime configuration](../screengrabs/settings-auth.png)

1. Install Ollama from [ollama.com](https://ollama.com) and pull a model: `ollama pull llama3`
2. Open **Settings** and scroll to the **Ollama** section
3. Click **Test Connection** -- the status shows "Connected" with a list of available models
4. Once connected, Ollama models appear in runtime selectors across the workspace

> **Tip:** Ollama executions are tracked at $0 in the cost dashboard. Sam uses Ollama for routine tasks (code formatting, simple summaries) and reserves Claude or GPT for complex reasoning. This habit cuts monthly spend significantly.

### Step 5: Optimize Chat with Model Selection

![Chat interface showing model selection and conversation controls](../screengrabs/chat-list.png)

1. Navigate to **Chat** and click the **model selector** in the input area
2. Review models with cost tier indicators ($ to $$$)
3. Select **Haiku ($)** for quick factual queries
4. Switch to **Opus ($$$)** for complex reasoning
5. If Ollama is connected, local models appear at $0

> **Tip:** Sam's rule of thumb: factual recall = Haiku, thinking = Opus, privacy-sensitive = Ollama. This habit reduces monthly chat spend by 80%.

### Step 6: Use NLP Scheduling

Sam creates schedules by describing them in plain English instead of writing cron expressions.

![New schedule form filled — Daily Standup Summary with weekday 9am cron](../screengrabs/schedules-create-form-filled.png)

1. Navigate to **Schedules** and click **Create Schedule**
2. In the interval field, type natural language: "every weekday at 10pm," "every 6 hours during business hours," or "twice daily at 9am and 5pm"
3. A **preview** appears showing exactly how the system parsed the input
4. Select **Heartbeat** type to add intelligence -- the agent evaluates a checklist before acting
5. Add checklist items specific to your automation needs
6. Save the schedule and click on it to open the **detail sheet** -- review firing history, next run time, and pause/resume controls

![Schedule detail sheet with firing history and autonomous loop controls](../screengrabs/schedules-detail.png)

> **Tip:** NLP scheduling removes the friction of cron syntax. If the preview does not match your intent, rephrase and it re-parses instantly.

### Step 7: Build a Multi-Step Workflow

Sam customizes a workflow for a "Deploy & Verify" pipeline with specialized profiles at each step.

![New workflow form with delay step — ML Pipeline Orchestrator with 3-step sequence](../screengrabs/workflows-create-form-delay.png)

1. From the Workflows page, click **Create Workflow** (or customize a blueprint)
2. Add steps with different agent profiles at each stage -- notice the **delay step** option for inserting timed pauses between steps (e.g., a 2-hour cooldown between deploy and verification)
3. Use the business-function profiles for non-technical steps (e.g., Content Creator for documentation, Operations Coordinator for runbook updates)
4. Save the workflow

### Step 8: Inspect Workflow Execution

![Workflow detail page showing steps, dependency graph, and execution status](../screengrabs/workflows-detail.png)

1. Click on a workflow to open the detail view
2. Review the **step sequence** and dependency chain
3. Check each step's **status indicator**
4. Click completed steps to read their full output
5. Use the **Run Workflow** button to trigger a new execution

### Step 9: Add Formula Columns and Charts to Tables

Sam tracks deployment metrics in a table and wants computed columns and visual dashboards without leaving ainative.

![Tables detail view with charts tab showing data visualizations](../screengrabs/tables-detail-charts.png)

1. Open a table from the **Tables** page
2. Click **Add Column** and select **Formula** as the column type
3. Write a formula referencing other columns (e.g., `duration_hours / deploy_count` for average deploy time)
4. Switch to the **Charts** tab to add visualizations -- bar, line, or pie charts built from the table data
5. Configure chart axes and filters to highlight the metrics that matter

> **Tip:** Formula columns recalculate automatically when source data changes. Combined with workflow triggers, a table can fire a workflow step whenever a metric crosses a threshold -- for example, triggering a rollback review when error rate exceeds 5%.

### Step 10: Attach Workflow Triggers to Table Events

Sam connects a table to the workflow engine so that row changes automatically kick off automation.

1. Open a table and navigate to the **Triggers** tab
2. Click **Add Trigger** and select the event type: row created, row updated, or column value changed
3. Map the trigger to an existing workflow
4. Configure field mappings so the workflow receives the changed row data as context
5. Save the trigger -- new rows or edits now fire the connected workflow automatically

> **Tip:** Table triggers turn spreadsheets into event-driven automation surfaces. Sam uses them to auto-run incident postmortems whenever an incident row status changes to "Resolved."

### Step 11: Create Tasks with AI Assist

Sam uses AI Assist to turn a rough task idea into a fully specified, workflow-ready plan.

![AI Assist returned — improved description, complexity analysis, and Swarm pattern recommendation](../screengrabs/tasks-create-form-ai-assist.png)

1. From the Dashboard, click **Create Task**
2. Enter a rough title and description -- for example, "API Security Audit" with a one-line description
3. Click **AI Assist** -- the system analyzes the task and returns an improved description, complexity rating, recommended execution pattern (e.g., Swarm), and a checkpoint flag
4. Review the **breakdown** -- for complex tasks, AI Assist generates a multi-step workflow with per-step descriptions

![AI Assist breakdown — 6-step security audit workflow with per-step descriptions](../screengrabs/tasks-create-form-ai-breakdown.png)

5. Click **Apply** to replace the original description with the AI-improved version, or **Convert to Workflow** to generate a full workflow from the breakdown
6. The resulting workflow lands on the confirmation page, ready for review and customization

![Task form after clicking Apply — improved description replaces original](../screengrabs/tasks-create-form-ai-applied.png)

> **Tip:** AI Assist is the bridge between "I have a vague idea" and "I have a production-ready plan." For complex tasks, it recommends the Swarm pattern where multiple agents tackle sub-steps in parallel -- this is how multi-agent swarm execution works in practice.

### Step 12: Batch-Manage Tasks on the Kanban

Sam cleans up the task board using bulk select mode.

![Kanban board in bulk select mode with checkboxes and bulk action toolbar](../screengrabs/tasks-bulk-select.png)

1. Navigate to the **Dashboard** kanban board
2. Click **Select** to enter bulk select mode
3. Check boxes on multiple task cards across columns
4. Use the bulk action toolbar to queue, move, or delete selected tasks
5. Confirm and exit select mode

> **Tip:** After a weekend of autonomous heartbeat runs, Sam's first Monday task is always a bulk cleanup.

### Step 13: Schedule Automated Prompt Loops

![Schedules list showing active schedules and firing status](../screengrabs/schedules-list.png)

1. Click on a schedule to open its detail sheet
2. Review the **firing history** with timestamps and outcomes (including suppressed heartbeat runs)
3. Check the **next firing time**
4. Verify stop conditions and delivery channels
5. Toggle **Pause/Resume** as needed

### Step 14: Leverage Episodic Memory

Sam notices agents are re-researching the same topics. Episodic memory lets agents retain factual knowledge across executions.

![Agent monitoring dashboard with execution logs](../screengrabs/monitor-list.png)

1. Run several tasks with the same profile on related topics
2. Open **Monitor** to observe that the agent extracted memory entries during execution
3. Memory entries persist -- the agent recalls facts from previous tasks in future executions
4. Memories have confidence scores that decay over time, keeping the context window focused on current knowledge
5. Visit the memory browser (accessible from the profile detail page) to inspect, edit, or delete stored memories

> **Tip:** Episodic memory means a Financial Analyst profile that researches a company once can recall that research in future tasks without re-doing the work. It builds institutional knowledge automatically.

### Step 15: Watch Agent Execution in Real-Time

![Agent monitoring dashboard showing real-time execution logs](../screengrabs/monitor-list.png)

1. Click **Monitor** in the sidebar
2. Review the execution log showing all recent agent activity
3. Filter by project, workflow, or agent profile
4. Click entries to expand full execution traces -- tool calls, outputs, token counts, timing
5. Watch for error patterns

> **Tip:** The Monitor is Sam's operational dashboard. When something goes wrong in an autonomous loop at 3am, the execution traces are the fastest path to diagnosis.

### Step 16: Use Chat Suggested Prompts and Skill Composition

![/ popover Skills tab with composition status indicator](../screengrabs/chat-skills-tab.png)

1. Navigate to **Chat** and notice the **suggested prompt tabs** (Explore, Create, Debug, Automate)
2. Click the **Create** tab to see prompts for creating tasks, workflows, and schedules
3. Click a suggested prompt to populate the input
4. Type **/** to open the slash popover -- browse four tabs: **Actions**, **Skills**, **Tools**, and **Entities**

![/ popover with four tabs: Actions, Skills, Tools, Entities](../screengrabs/chat-slash-popover.png)

5. Switch to the **Skills** tab — click **+ Add** to stack a second skill onto the conversation (e.g., a research skill plus a code-review skill running concurrently)
6. If the new skill clashes with an active one, review the **conflict dialog** and decide which to keep — the engine's heuristic surfaces overlapping tools or contradictory instructions
7. Watch the "N of M active" indicator; once you approach the runtime's `maxActiveSkills` cap, prompt-budget eviction automatically trims the oldest low-priority skill
8. For a faster start, try **Start from template** or `/new-from-template` to open a conversation pre-primed from a workflow blueprint — the blueprint's optional `chatPrompt` provides the opening context

> **Tip:** Skill composition only engages on runtimes where `supportsSkillComposition` is true. On other runtimes the Skills tab stays read-only with a hint, and the chat behaves as a single-skill session.

### Step 17: Chain Everything Together

Sam connects the dots: profiles define *how*, workflows define *what*, schedules define *when*, Ollama handles the *cheap stuff*, episodic memory provides the *knowledge*, and delivery channels deliver the *results*.

![Workflows list showing automation pipelines ready for scheduling](../screengrabs/workflows-list.png)

1. Review workflows and identify which should run on a schedule
2. Create heartbeat schedules with appropriate checklists
3. Assign business-function profiles to each step
4. Route privacy-sensitive steps to Ollama, complex reasoning to Claude
5. Attach Slack or Telegram channels for delivery
6. Enable episodic memory for profiles that handle recurring topics
7. Set up the Monitor as your oversight layer

> **Tip:** Sam's automation philosophy: start small, observe, then expand. Run a workflow manually three times before scheduling it. Trust builds incrementally -- and so should autonomy.

### Step 18: What's Next

Sam's workspace is a fully autonomous operations engine. The next step is going deeper into the platform layer.

- [Developer Guide](./developer.md) -- Configure authentication, runtime settings, channel gateway architecture, and CLI tooling
- [Work Use Guide](./work-use.md) -- Explore team collaboration features, document management, and cost governance
- [Personal Use Guide](./personal-use.md) -- Review the basics if you need a refresher
