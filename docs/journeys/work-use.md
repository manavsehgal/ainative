---
title: "Work Use Guide"
category: "user-journey"
persona: "work"
difficulty: "intermediate"
estimatedTime: "30 minutes"
sections: ["projects", "chat", "documents", "workflows", "schedules", "cost-usage", "inbox-notifications"]
tags: ["intermediate", "team", "documents", "workflows", "schedules", "costs", "inbox"]
lastUpdated: "2026-03-22"
---

# Work Use Guide

Meet Jordan, a team lead running a cross-functional product team on Stagent. Jordan uses AI agents to manage multiple workstreams — uploading reference documents, orchestrating multi-step business processes, scheduling recurring automations, tracking spend, and triaging permission requests. This guide walks through a full working session -- from organizing projects to clearing the inbox at end of day.

## Prerequisites

- Stagent installed and running locally (`npm run dev`)
- An Anthropic API key configured in `.env.local`
- At least one project already created (see [Personal Use Guide](./personal-use.md) if starting fresh)
- A document to upload (PDF, text file, image, Word doc, or spreadsheet)

## Journey Steps

### Step 1: Organize Team Projects

Jordan starts the morning by reviewing the team's active projects. The projects list provides a quick snapshot of every workstream -- status indicators, task counts, and last activity -- so Jordan can decide where to focus first.

![Projects list showing team workstreams with status and task counts](../screengrabs/projects-list.png)

1. Click **Projects** in the sidebar under the **Work** group
2. Scan the project cards for status badges, task counts, and recent activity timestamps
3. Click **Create Project** to set up a new workstream -- enter a descriptive name like "Q2 2026 Product Planning," a detailed description covering scope and stakeholders, and a working directory pointing to the shared team repository
4. Click **Create Project** to save

> **Tip:** Include team conventions in the project description -- for example, "All output should follow our RFC template format." Agents reference this description when executing tasks, so richer context produces better results.

### Step 2: Drill Into Project Details

Jordan clicks into the planning project to check on task progress and verify that agents are producing quality output. The project detail page shows all tasks scoped to that workstream, along with project metadata.

![Project detail page showing tasks, metadata, and progress](../screengrabs/projects-detail.png)

1. Click on a project card from the projects list to open its detail page
2. Review the **task list** -- each task shows its status, assigned agent profile, and last update
3. Check completed tasks and verify their output quality
4. Reassign or edit any tasks that need course correction
5. Use the project description and working directory fields to confirm agents have the right context

> **Tip:** Project-scoped views filter out noise from other workstreams. Use them when you need to focus on a single initiative without distractions from the rest of the workspace.

### Step 3: Query Workspace Status via Chat

Rather than clicking through every page, Jordan opens Chat to ask a quick question about project status. Chat pulls context from projects, tasks, and documents to give informed, conversational answers with clickable links back to the relevant items.

![Active chat conversation with messages and Quick Access navigation pills](../screengrabs/chat-conversation.png)

1. Click **Chat** in the sidebar under the **Work** group
2. Type a question such as "What is the status of the Q2 planning project?"
3. Review the AI response -- notice the **Quick Access pills** that link to specific projects, tasks, or documents mentioned in the answer
4. Click a Quick Access pill to jump directly to the referenced item
5. Use the **conversation sidebar** on the left to revisit previous chat sessions or start a new one

> **Tip:** Chat is the fastest way to get a cross-cutting status overview. Instead of navigating five different pages, ask one question and follow the entity links in the response. Previous conversations are saved so you can pick up where you left off.

### Step 4: Upload and Manage Documents

Jordan needs to upload reference documents -- a product requirements doc and competitive analysis -- that agents will consult during planning tasks. The documents section manages all files across the workspace.

![Documents table view with file type icons and metadata columns](../screengrabs/documents-list.png)

1. Click **Documents** in the sidebar under the **Manage** group
2. Review existing documents in the **table view** -- columns show file name, type, size, project association, and upload date
3. Click the **Upload** button in the page header
4. Select one or more files from the file picker (supports PDF, text, images, Word documents, and spreadsheets)
5. Assign the documents to the appropriate project
6. Click **Upload** to process and store the files

> **Tip:** Stagent automatically extracts text from uploaded documents. PDFs, Word files, and even images are processed so agents can search and reference their contents during task execution -- no manual copy-paste needed.

### Step 5: Switch Document Views

Jordan switches to the grid view for a visual overview of all uploaded files. The grid layout surfaces thumbnail previews and makes it easy to spot file types at a glance.

![Documents grid view with card layout showing file previews](../screengrabs/documents-grid.png)

1. Click the **grid toggle** in the documents page header to switch from table to grid view
2. Browse document cards -- each card shows the file name, type icon, size, and project association
3. Click any card to open its detail sheet with full metadata and a preview of extracted text
4. Toggle back to **table view** when you need to sort or filter by specific columns

> **Tip:** Grid view works well for visual scanning when you have a mix of file types. Table view is better for precise filtering and sorting across large document libraries.

### Step 6: Browse Workflow Blueprints

Jordan wants to set up a structured review process for the planning project. The blueprint gallery offers pre-built workflow templates for common team processes -- no need to build from scratch.

![Workflow blueprint gallery showing template cards for team processes](../screengrabs/workflows-blueprints.png)

1. Click **Workflows** in the sidebar under the **Manage** group
2. Navigate to the **Blueprints** tab to open the template gallery
3. Browse the available blueprint cards -- each describes the workflow's purpose, step count, and recommended agent profiles
4. Click a blueprint that matches your needs (e.g., "Research & Report" or "Code Review Pipeline")
5. Customize the template by adjusting step descriptions, agent assignments, and project scope
6. Click **Create Workflow** to instantiate it

> **Tip:** Blueprints are starting points, not rigid templates. After creating a workflow from a blueprint, you can add, remove, or reorder steps to match your team's specific process.

### Step 7: Review Active Workflows

After launching several workflows, Jordan checks back to see which ones have completed, which are still running, and whether any steps need attention.

![Workflows list with tabs showing status and step progress](../screengrabs/workflows-list.png)

1. Return to the **Workflows** page and select the **All** or **Runs** tab
2. Scan the workflow list -- each entry shows its name, status, step progress, and last activity
3. Click on a running workflow to see step-by-step execution details
4. Check for any steps marked as "waiting" that may need input or approval
5. Review completed workflows to verify their output quality

> **Tip:** Workflows with steps in a "waiting" state often need human input or a permission approval. Cross-reference with the Inbox to see if an agent is blocked on a tool permission request.

### Step 8: Schedule Recurring Automations

Jordan wants a weekly status summary generated every Monday morning without manual intervention. Schedules let you configure recurring agent tasks that run on autopilot.

![Schedules list showing active schedules with frequency and next firing time](../screengrabs/schedules-list.png)

1. Click **Schedules** in the sidebar under the **Manage** group
2. Click **Create Schedule** to open the creation form
3. Enter a **Name** such as "Weekly Status Report"
4. Set the **Interval** using natural language -- "every Monday at 9am," "every weekday at 5pm," or "every 2 hours"
5. Configure the **Task Template** with a title, description, target project, and agent profile
6. Enable the schedule toggle and click **Create**

> **Tip:** The interval parser understands plain English. You do not need to write cron expressions -- just describe the cadence in natural language and Stagent translates it.

### Step 9: Monitor Spending and Budgets

With multiple agents running tasks and scheduled jobs throughout the week, Jordan checks the cost dashboard to ensure the team stays within budget. Visible spend is governed spend.

![Cost and Usage dashboard showing spend metrics and budget gauges](../screengrabs/cost-usage-list.png)

1. Click **Costs & Usage** in the sidebar under the **Configure** group
2. Review the **total spend** for the current billing period at the top of the page
3. Check the **budget gauge** to see how close the team is to the configured spend cap
4. Examine the **per-project breakdown** to identify which workstreams consume the most tokens
5. Review the **per-model breakdown** to understand cost distribution across different AI models

> **Tip:** If costs are climbing faster than expected, check for tasks with very large document contexts or autonomous loops with high iteration counts. Both are common sources of unexpected token consumption.

### Step 10: Analyze Cost Breakdown

Jordan scrolls down to the detailed usage table for a granular view of individual cost entries -- which tasks consumed how many tokens, when, and at what price.

![Cost and Usage page scrolled to show detailed usage breakdown table](../screengrabs/cost-usage-below-fold.png)

1. Scroll below the summary cards to reach the **usage breakdown table**
2. Review individual entries showing task name, model used, token counts (input and output), and computed cost
3. Sort by cost or date to find the most expensive operations
4. Use this data to identify optimization opportunities -- tasks that could use a smaller model or tighter context windows

> **Tip:** The breakdown table is your audit trail. When a stakeholder asks "why did we spend $X this week," you can trace every dollar back to a specific task and model invocation.

### Step 11: Review Agent Notifications

Jordan's agents have been running tasks in the background, and some have hit permission boundaries or completed important milestones. The Inbox is Stagent's human-in-the-loop control center.

![Inbox notification queue with tabs and action buttons](../screengrabs/inbox-list.png)

1. Click **Inbox** in the sidebar under the **Work** group
2. Review the notification list -- each entry summarizes what an agent needs or has accomplished
3. Notifications are sorted by urgency, with permission requests at the top
4. Check the **badge count** on the Inbox sidebar item to see how many unread notifications are waiting

> **Tip:** A badge on the Inbox sidebar item shows the count of unread notifications. When agents are actively running, check this regularly to avoid leaving them blocked on a permission request.

### Step 12: Inspect Notification Details

Jordan expands a notification to see the full details of a permission request -- what the agent wants to do, which tool it needs access to, and the specific arguments it plans to use.

![Inbox with expanded notification showing full content and approval options](../screengrabs/inbox-expanded.png)

1. Click on a notification row to expand it and reveal the full content
2. For permission requests, review the **action details** -- the tool name, arguments, and why the agent needs it
3. Choose **Approve** to let the agent proceed, or **Deny** to block the action
4. For routine tools you trust, use the **Always Allow** option to grant standing permission and reduce future notification noise
5. For status notifications, read the completion summary and click through to the related task if needed

> **Tip:** When you grant "Always Allow" for a tool, the agent will never pause for that action again. Start conservative -- approve one at a time -- and gradually open up permissions as you build confidence in agent behavior. You can always tighten permissions later from the Settings page.

### Step 13: Manage Schedules

Later in the week, Jordan revisits the schedules list to verify that the Monday report ran successfully and to adjust the next firing time for an upcoming holiday.

![Schedules list with status indicators and next run timestamps](../screengrabs/schedules-list.png)

1. Return to **Schedules** in the sidebar
2. Locate the "Weekly Status Report" schedule entry
3. Check the **Last Run** and **Next Run** timestamps to confirm execution
4. Click the schedule to review its firing history and the tasks it generated
5. Edit the interval or pause the schedule if adjustments are needed

> **Tip:** Schedules create real tasks each time they fire. You can find the generated tasks in the project's task list or on the Dashboard, making it easy to review and audit automated output.

### Step 14: Review Workflow Results

At the end of the work cycle, Jordan checks completed workflows to review the deliverables agents produced and confirm they meet team standards.

![Workflows list showing completed workflow runs](../screengrabs/workflows-list.png)

1. Navigate to **Workflows** and filter for **completed** runs
2. Click on a completed workflow to open its detail view
3. Walk through each step's output -- review generated documents, analysis results, or code changes
4. Flag any steps that need revision and kick off a follow-up task if needed
5. Archive workflows that are fully reviewed and accepted

> **Tip:** Treat completed workflows as deliverables. Review them with the same rigor you would apply to a team member's work product -- agents benefit from the same feedback loop that helps humans improve.

### Step 15: What's Next

Jordan's working session covered the full breadth of Stagent's team-oriented features -- from project organization through cost governance and inbox management. To go deeper:

- [Power User Guide](./power-user.md) -- Build multi-step autonomous workflows, configure agent loops, and orchestrate multi-agent swarms
- [Developer Guide](./developer.md) -- Configure authentication, runtime settings, environment scanning, and CLI tooling
- [Personal Use Guide](./personal-use.md) -- Review the basics of project creation, task management, and single-agent execution
