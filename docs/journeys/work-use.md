---
title: "Work Use Guide"
category: "user-journey"
persona: "work"
difficulty: "intermediate"
estimatedTime: "25 minutes"
sections: ["projects", "documents", "schedules", "cost-usage", "inbox-notifications"]
tags: ["team", "documents", "automation", "budgets", "oversight"]
lastUpdated: "2026-03-17"
---

# Work Use Guide

You're using Stagent for professional work — managing multiple projects, organizing reference documents, scheduling recurring agent tasks, tracking costs, and maintaining oversight through approvals. This guide covers the workflow patterns that matter most in a work context.

## Prerequisites
- Stagent running and connected to an AI provider (see [Getting Started](../getting-started.md))
- At least one project created (see [Personal Use Guide](./personal-use.md))

## Journey Steps

### Step 1: Organize Multiple Projects

Work usually involves juggling several projects simultaneously. Create a project for each.

![Project cards with task counts and status](../screengrabs/projects-list.png)

1. Navigate to **Projects**
2. Create separate projects for each workstream (e.g., "API Refactor", "Documentation Sprint", "Security Audit")
3. Set **Working Directories** for code-related projects so agents know where to operate
4. Each project card shows task counts and completion progress at a glance

> **Tip:** Working directories are critical for code tasks. Without one, agents operate in Stagent's own directory instead of your codebase.

### Step 2: Upload Reference Documents

Give your agents context by uploading reference materials.

![Documents table view](../screengrabs/documents-list.png)

1. Navigate to **Documents**
2. Click **Upload** or drag files onto the page
3. Upload relevant files: specifications, design docs, API references, spreadsheets
4. Stagent automatically extracts text from your documents (PDF, Word, Excel, etc.)
5. Link documents to the appropriate project

![Documents grid view with previews](../screengrabs/documents-grid.png)

> **Tip:** When you link a document to a task, its extracted text is automatically injected into the agent's prompt. The agent can reference your spec or design doc without you copying text manually.

### Step 3: Create Tasks with Document Context

Now create tasks that leverage your uploaded documents.

1. Navigate to **Dashboard** and click **New Task**
2. Enter a title like "Review API spec and identify breaking changes"
3. In the **Documents** section, attach the relevant API specification
4. Select the appropriate project
5. Choose a specialist profile (e.g., "Code Reviewer")
6. Click **Create** and then **Execute**

The agent receives the document's extracted text as part of its context, so it can analyze your spec without you pasting anything.

### Step 4: Schedule Recurring Automations

Some tasks should run automatically — daily reports, weekly code scans, periodic cleanup.

![Schedules management page](../screengrabs/schedules-list.png)

1. Navigate to **Schedules** and click **New Schedule**
2. Enter a name like "Daily Security Scan"
3. Write the prompt: "Scan the codebase for common security vulnerabilities and report findings"
4. Set the interval to `1d` (daily) or `0 9 * * 1-5` (weekdays at 9am)
5. Choose **Recurring** mode
6. Select the project and an appropriate agent profile
7. Optionally set a **max firings** limit (e.g., 20 for a month of weekdays)
8. Click **Create**

> **Tip:** Each schedule firing creates a child task on the Dashboard, so all results, logs, and costs are tracked just like manual tasks.

### Step 5: Monitor Costs and Set Budgets

Work usage adds up. Stay on top of spending.

![Cost & Usage dashboard](../screengrabs/cost-usage-list.png)

1. Navigate to **Cost & Usage**
2. Review the **summary cards** for total spend and token consumption
3. Check the **provider breakdown** to see costs per runtime
4. Look at the **trend view** to spot spending patterns

Now set a budget:
1. Navigate to **Settings** → **Budgets**
2. Create a global budget or per-project budgets
3. Set a monthly limit and warning threshold
4. Choose whether to **warn** (notification) or **block** (stop execution) at the limit

> **Tip:** Per-project budgets are useful when different projects have different cost tolerances. A research project might have a higher budget than a simple documentation task.

### Step 6: Handle Approvals Efficiently

With multiple projects and schedules running, approval volume increases. Manage it efficiently.

![Inbox with approval requests](../screengrabs/inbox-list.png)

1. Navigate to **Inbox** to see all pending approvals
2. For tools you trust, use **Always Allow** to save patterns
3. Apply a **Permission Preset** (Settings → Tool Permissions):
   - **Read Only** — for research-only agents
   - **Git Safe** — for agents that need to work with version control
   - **Full Auto** — for trusted agents that need maximum autonomy
4. Ambient approvals appear on any page, so you don't have to switch to Inbox for every request

> **Tip:** Start with Read Only and escalate to Git Safe as you build confidence. Full Auto should only be used for well-tested profiles on low-risk tasks.

### Step 7: Drill Into Project Detail

Check how a specific project is doing.

![Project detail with task list](../screengrabs/projects-detail.png)

1. Navigate to **Projects** and click a project card
2. Review the **task list** with status badges
3. Check the **status distribution** chart
4. See the **14-day sparkline** for activity trends
5. Create new tasks directly from the project context

### Step 8: Review Scheduled Task Results

Check what your automated tasks have produced.

1. Navigate to **Dashboard** and filter by the project with scheduled tasks
2. Look for child tasks created by your schedule (they appear in the regular kanban columns)
3. Open completed tasks to review agent output
4. If a scheduled task failed, investigate in **Monitor** and adjust the schedule or prompt

## What's Next
- [Power User Guide](./power-user.md) — custom profiles, workflow blueprints, autonomous loops
- [Schedules](../features/schedules.md) — advanced scheduling options
- [Cost & Usage](../features/cost-usage.md) — detailed spending analysis
- [Documents](../features/documents.md) — advanced document management
