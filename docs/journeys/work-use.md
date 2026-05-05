---
title: "Work Use Guide"
category: "user-journey"
persona: "work"
difficulty: "intermediate"
estimatedTime: "30 minutes"
sections: ["projects", "chat", "documents", "tables", "workflows", "schedules", "cost-usage", "inbox-notifications", "delivery-channels"]
tags: ["intermediate", "team", "documents", "tables", "workflows", "schedules", "costs", "inbox", "channels", "handoffs"]
lastUpdated: "2026-04-16"
---

# Work Use Guide

Meet Jordan, a team lead running a cross-functional product team on `ainative-business`. Jordan uses AI agents to manage multiple workstreams -- uploading reference documents, orchestrating multi-step business processes, scheduling recurring automations, tracking spend, triaging permission requests, and receiving notifications across Slack and Telegram. This guide walks through a full working session -- from organizing projects to clearing the inbox at end of day.

## Prerequisites

- `ainative-business` installed and running locally (`npm run dev`)
- An Anthropic API key configured in `.env.local`
- At least one project already created (see [Personal Use Guide](./personal-use.md) if starting fresh)
- A document to upload (PDF, text file, image, Word doc, or spreadsheet)

## Journey Steps

### Step 1: Organize Team Projects

Jordan starts the morning by reviewing the team's active projects.

![Projects list showing team workstreams with status and task counts](../screengrabs/projects-list.png)

1. Click **Projects** in the sidebar under the **Compose** group
2. Scan the project cards for status badges, task counts, and recent activity timestamps
3. Click **Create Project** to set up a new workstream -- enter a descriptive name, description covering scope, and a working directory
4. Click **Create Project** to save

> **Tip:** Include team conventions in the project description. Agents reference this description when executing tasks, so richer context produces better results.

### Step 2: Drill Into Project Details

Jordan clicks into a project to check on task progress.

![Project detail page showing tasks, metadata, and progress](../screengrabs/projects-detail.png)

1. Click on a project card to open its detail page
2. Review the **task list** -- each task shows its status, assigned agent profile, and last update
3. Check completed tasks and verify their output quality
4. Reassign or edit any tasks that need course correction

### Step 3: Query Workspace Status via Chat

Rather than clicking through every page, Jordan asks Chat for a quick status update.

![Chat interface with conversation thread and Quick Access navigation](../screengrabs/chat-detail.png)

1. Click **Chat** in the sidebar
2. Type a question such as "What is the status of the Q2 planning project?"
3. Review the response -- notice **Quick Access pills** linking to specific items
4. Click a pill to jump directly to the referenced entity
5. Use **@** mentions to pull specific entities into the conversation -- type `@` to browse tasks, projects, documents, and workflows without leaving the composer

![@ mentions popover for referencing workspace entities in chat](../screengrabs/chat-mentions-popover.png)

> **Tip:** Chat is the fastest way to get a cross-cutting status overview. Ask one question and follow the entity links.

### Step 4: Upload and Manage Documents

Jordan uploads reference documents that agents will consult during planning tasks.

![Documents table view with file type icons and metadata columns](../screengrabs/documents-list.png)

1. Click **Documents** in the sidebar
2. Click **Upload** to open the upload dialog

![Document upload form with file picker and project selector](../screengrabs/documents-upload-form.png)

3. Select files (supports PDF, text, images, Word, and spreadsheets) and assign them to a project
4. Click **Upload** to process and store the files

> **Tip:** `ainative-business` automatically extracts text from uploaded documents so agents can reference their contents during task execution.

### Step 5: Switch Document Views and Inspect a File

Jordan switches to grid view for a visual overview, then opens a document to verify the extracted content is accurate.

![Documents grid view with card layout showing file previews](../screengrabs/documents-grid.png)

1. Click the **grid toggle** in the documents page header
2. Browse document cards with file name, type icon, and project association
3. Click any document to open the **detail sheet** showing the full extracted text, metadata, and per-file processing status

![Document detail sheet with extracted text preview and metadata fields](../screengrabs/documents-detail.png)

4. Toggle back to **table view** when you need to sort or filter

### Step 6: Create a Table from a Template

Jordan needs a structured tracker for the team's quarterly OKRs. Instead of building one from scratch, the template gallery has a ready-made option.

![Template gallery showing pre-built table templates](../screengrabs/tables-templates.png)

1. Click **Tables** in the sidebar under the **Compose** group
2. Click **Create Table** and browse the **Template Gallery**
3. Select a template that fits the use case (e.g., "OKR Tracker" or "Sprint Board")
4. Review the pre-configured columns and customize as needed
5. Click **Create** to generate the table with the template structure

> **Tip:** Templates include pre-set column types and formulas. They save setup time and ensure the team starts with a proven structure.

### Step 7: Import Document Data into a Table

Jordan has a CSV export from the previous quarter's performance review. Importing it into a table takes seconds.

![Empty create-table dialog before any fields are filled](../screengrabs/tables-create-form-empty.png)

![Create table dialog with fields filled in](../screengrabs/tables-create-form-filled.png)

1. From the **Tables** page, click **Create Table**
2. Choose **Import** and select the CSV or XLSX file
3. Review the column mapping -- `ainative-business` auto-detects column types from the data
4. Assign the table to the relevant project
5. Click **Create** to import the data into a fully editable spreadsheet view
6. Click into the table to open the **Data tab** with a spreadsheet-style editor -- edit cells inline, add rows, and review content

![Table detail Data tab with spreadsheet editor and row content](../screengrabs/tables-detail.png)

> **Tip:** Imported tables retain all their data as editable rows. You can add formula columns, charts, and workflow triggers on top of imported data.

### Step 8: Browse Workflow Blueprints

Jordan wants to set up a structured review process. The blueprint gallery now includes business-function templates alongside technical ones.

![Workflow blueprint gallery showing template cards for team processes](../screengrabs/workflows-blueprints.png)

1. Click **Workflows** in the sidebar and navigate to the **Blueprints** tab
2. Browse templates including business blueprints: lead research pipeline, content marketing pipeline, customer support triage, financial reporting, and business daily briefing
3. Click a blueprint to preview its configuration
4. Customize the template and click **Create Workflow**

> **Tip:** Business-function blueprints pair naturally with the corresponding business profiles (Marketing Strategist, Sales Researcher, Financial Analyst, etc.).

### Step 9: Review Active Workflows

![Workflows list with tabs showing status and step progress](../screengrabs/workflows-list.png)

1. Return to the **Workflows** page and select the **All** or **Runs** tab
2. Scan the workflow list for status, step progress, and last activity
3. Click on a running workflow for step-by-step details
4. Check for steps in a "waiting" state that may need approval

### Step 10: Schedule with Natural Language

Jordan schedules a weekly status summary using plain English instead of cron syntax.

![Schedules list showing active schedules with frequency and next firing time](../screengrabs/schedules-list.png)

1. Click **Schedules** and then **Create Schedule**
2. Enter a **Name** such as "Weekly Status Report"
3. Set the interval using natural language: "every Monday at 9am"
4. A preview shows exactly how the system interpreted the cadence
5. Configure the task template with a description, project, and agent profile
6. Attach a **Slack delivery channel** so the report is posted to the team channel automatically
7. Click **Create**

> **Tip:** The interval parser understands plain English. You do not need to write cron expressions.

### Step 11: Monitor Spending and Budgets

![Cost and Usage dashboard showing spend metrics and budget gauges](../screengrabs/costs-list.png)

1. Click **Cost & Usage** in the sidebar
2. Review **total spend** for the current billing period
3. Check the **budget gauge** for spend cap proximity
4. Examine per-project and per-model breakdowns

### Step 12: Analyze Cost Breakdown

![Cost and Usage page scrolled to show detailed usage breakdown table](../screengrabs/cost-usage-below-fold.png)

1. Scroll below the summary cards to the **usage breakdown table**
2. Review individual entries with task name, model, token counts, and cost
3. Sort by cost to find the most expensive operations

> **Tip:** The breakdown table is your audit trail. Trace every dollar back to a specific task.

### Step 12b: Set the Workspace Trust Tier and Watch the Analytics Dashboard

Jordan wants to keep the team's overall posture under control: trust tiers gate which tools agents can run without approval, and the analytics dashboard surfaces broader workspace activity beyond cost.

![Trust tier popover anchored to the sidebar footer](../screengrabs/trust-tier-popover.png)

1. Click the **trust tier badge** in the sidebar footer to open the popover
2. Pick a posture: **Cautious** (every tool prompts), **Balanced** (default; sensitive tools prompt), **Trusted** (approve broadly), or **Custom** (per-tool overrides)
3. The chosen tier flows through to every notification in the Inbox — `Always Allow` shortcuts respect tier boundaries

![Analytics dashboard with workspace-wide metrics and trends](../screengrabs/analytics-list.png)

4. Click **Analytics** under the **Observe** group in the sidebar
5. Review workspace-wide metrics: tasks completed per day, active agents, top profiles by usage, and per-project velocity trends

> **Tip:** The trust tier is the single most important governance lever. Use **Cautious** during onboarding, then relax to **Balanced** once the team understands what tools agents typically need.

### Step 13: Review Agent Notifications and Handoffs

Jordan's agents have been running in the background. Some have generated handoff requests where one agent wants to delegate work to another.

![Inbox notification queue with tabs and action buttons](../screengrabs/inbox-list.png)

1. Click **Inbox** in the sidebar
2. Review notifications -- permission requests, agent messages, budget alerts, and **handoff approvals**
3. For handoff requests, review which agent is delegating to which and the context being passed
4. Approve or deny the handoff

> **Tip:** Agent handoffs are governed -- chain depth limits prevent infinite loops, and self-handoffs are blocked automatically.

### Step 14: Inspect Notification Details

![Inbox with expanded notification showing full content and approval options](../screengrabs/inbox-expanded.png)

1. Click a notification to expand it

![Inbox with notification fully expanded showing reasoning and full agent context](../screengrabs/inbox-fully-expanded.png)

2. For permission requests, review the tool name, arguments, and reason

![Inbox showing the Permissions tab with pending and approved tool grants](../screengrabs/inbox-permissions.png)

3. Switch to the **Permissions** tab to audit all tool grants — pending requests live here, and you can revoke prior "Always Allow" decisions
4. Choose **Approve**, **Deny**, or **Always Allow** on a pending request

![Approval action confirmation showing the approved request returning to the inbox](../screengrabs/journey-inbox-action.png)

5. For handoffs, approve to let the receiving agent begin work
6. If an agent sends an **AskUserQuestion** notification, type your answer in the inline reply field — there is no approve/deny, just a short response that lets the agent resume
7. Watch for **upgrade available** notifications and the occasional upgrade-failure alert (raised only after three consecutive poller failures, so these should be rare)

### Step 15: Configure Multi-Channel Notifications

Jordan sets up Slack so the entire team receives schedule results and important alerts.

![Settings page showing Delivery Channels configuration](../screengrabs/settings-channels.png)

1. Open **Settings** and scroll to **Delivery Channels**
2. Click **+ Add Channel** and select **Slack**
3. Enter the webhook URL, bot token, and channel ID (see the [Delivery Channels](../features/delivery-channels.md) guide for setup steps)
4. Click **Create Channel** then **Test** to verify
5. Toggle **Chat** on for bidirectional mode -- team members can ask `ainative-business` questions directly from Slack

> **Tip:** With Chat enabled on Slack, anyone in the channel can message `ainative-business` and get workspace-aware responses. This turns Slack into a team-wide AI assistant interface.

### Step 16: Manage Schedules

![Schedule detail sheet showing firing history and pause/resume controls](../screengrabs/schedules-detail.png)

1. Return to **Schedules**
2. Locate the "Weekly Status Report" schedule and click to open its **detail sheet**
3. Review the **firing history** with timestamps and outcomes -- suppressed heartbeat runs appear dimmed
4. Check **Next Run** to confirm the cadence
5. Use the **Pause/Resume** toggle when you need to temporarily silence a schedule during quiet periods
6. Edit or delete as needed

### Step 17: What's Next

Jordan's working session covered team projects, documents, business-function workflows, natural language scheduling, multi-channel notifications, agent handoff approvals, and cost governance. To go deeper:

- [Power User Guide](./power-user.md) -- Build autonomous workflows, configure Ollama local models, and use episodic memory
- [Developer Guide](./developer.md) -- Configure authentication, runtime settings, environment scanning, and CLI tooling
- [Personal Use Guide](./personal-use.md) -- Review the basics of project creation and task management
