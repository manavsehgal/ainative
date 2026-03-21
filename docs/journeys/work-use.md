---
title: "Work Use Guide"
category: "user-journey"
persona: "team-lead"
difficulty: "intermediate"
estimatedTime: "24 minutes"
sections: ["Projects", "Documents", "Schedules", "Costs", "Inbox"]
tags: ["team", "documents", "schedules", "cost-management", "trust-tiers", "inbox"]
lastUpdated: "2026-03-21"
---

# Work Use Guide

Meet Jordan, a team lead managing a cross-functional product team. Jordan needs to organize work across multiple contributors, provide agents with project context through documents, set up recurring automated reports, keep an eye on API costs, and handle permission requests from running agents. This journey covers the core workflow for team-oriented use of Stagent.

## Prerequisites

- Stagent installed and running locally (`npm run dev`)
- An Anthropic API key configured in `.env.local`
- At least one project already created (see [Personal Use Guide](./personal-use.md) if starting fresh)
- A document to upload (PDF, text file, or image -- any format works)

## Journey Steps

### Step 1: Review the Projects List

Jordan starts the day by reviewing the team's active projects. The projects list provides a bird's-eye view of all workstreams with status indicators and task counts.

![Projects list showing multiple team projects](../screengrabs/projects-list.png)

1. Click **Projects** in the sidebar under the **Work** group
2. Scan the project cards for status, task count, and last activity
3. Identify which projects need attention today based on their progress indicators

> **Tip:** Projects with tasks in a "waiting" state often need human input. Check those first to unblock agent execution.

### Step 2: Create a Team Project

Jordan sets up a new project for the upcoming quarterly planning cycle. A well-structured project gives agents the context they need to produce relevant output.

![Project creation form filled with team project details](../screengrabs/projects-create-form-filled.png)

1. Click **Create Project** from the projects list
2. Enter a **Project Name** such as "Q2 2026 Product Planning"
3. Write a detailed **Description** covering scope, stakeholders, and deliverables
4. Set the **Working Directory** to the shared team repository path
5. Click **Create Project** to save

> **Tip:** Include team conventions in the project description -- for example, "All output should follow our RFC template format." Agents reference this description when executing tasks.

### Step 3: Navigate to Documents

Jordan needs to upload reference documents that agents can use for context during task execution. The documents section manages all files associated with the workspace.

![Documents list view with filter bar and file entries](../screengrabs/documents-list.png)

1. Click **Documents** in the sidebar under the **Manage** group
2. Review existing documents in the list view
3. Use the **FilterBar** at the top to narrow by file type, project, or upload date
4. Toggle between **List** and **Grid** views using the view switcher

> **Tip:** The FilterBar supports multiple simultaneous filters. Combine file type and project filters to quickly find specific documents in a large workspace.

### Step 4: Upload Project Documents

Jordan uploads the product requirements document and competitive analysis that agents will reference during planning tasks.

![Document upload form with file selection and metadata](../screengrabs/documents-upload-form.png)

1. Click the **Upload** button in the documents header
2. Select one or more files from the file picker (supports PDF, text, images, Office documents, and spreadsheets)
3. Assign the documents to the **Q2 2026 Product Planning** project
4. Add optional tags for easier filtering later
5. Click **Upload** to process and store the files

> **Tip:** Stagent automatically extracts text from uploaded documents. PDFs, Word docs, and even images (via OCR) are processed so agents can search and reference their contents during task execution.

### Step 5: Set Up a Scheduled Report

Jordan wants a weekly status summary generated automatically every Monday morning. Schedules let you configure recurring agent tasks that run on autopilot.

![Schedule creation form with interval and task configuration](../screengrabs/schedules-create-form-filled.png)

1. Click **Schedules** in the sidebar under the **Manage** group
2. Click **Create Schedule** to open the form
3. Enter a **Name** such as "Weekly Status Report"
4. Set the **Interval** to "every Monday at 9am" (natural language is supported)
5. Configure the **Task Template** -- title, description, project, and agent profile
6. Enable the schedule toggle and click **Create**

> **Tip:** The interval parser understands natural language like "every weekday at 9am", "every 2 hours", or "daily at 5pm". You do not need to write cron expressions.

### Step 6: Monitor API Costs

With multiple agents running tasks and scheduled jobs, Jordan checks the cost dashboard to ensure the team stays within budget. Governed AI means keeping spend visible and controlled.

![Cost and usage dashboard showing API spend breakdown](../screengrabs/cost-usage-list.png)

1. Click **Costs & Usage** in the sidebar under the **Configure** group
2. Review the **total spend** for the current billing period
3. Examine the **per-project breakdown** to see which workstreams consume the most tokens
4. Check the **per-model breakdown** for cost distribution across different Claude models
5. Note any spending trends that might require budget adjustments

> **Tip:** If costs are climbing faster than expected, check for tasks with very large document contexts or autonomous loops with high iteration counts. Both are common sources of unexpected spend.

### Step 7: Check the Inbox

Jordan's agents have been running tasks in the background, and some have hit permission boundaries. The Inbox is Stagent's human-in-the-loop control center -- where agents pause and wait for approval before taking sensitive actions.

![Inbox showing pending notifications and permission requests](../screengrabs/inbox-list.png)

1. Click **Inbox** in the sidebar under the **Work** group
2. Review the notification list -- each entry represents an agent requesting human input
3. Notifications are sorted by urgency, with permission requests at the top
4. Scan the **summary** column to understand what each agent needs

> **Tip:** A badge on the Inbox sidebar item shows the count of unread notifications. Check this regularly when agents are actively running.

### Step 8: Handle a Permission Request

One of Jordan's agents needs permission to execute a shell command as part of a deployment task. Stagent's trust tier system ensures agents cannot take dangerous actions without explicit approval.

![Inbox action view showing permission approval dialog](../screengrabs/journey-inbox-action.png)

1. Click on a **permission request** notification to expand it
2. Review the **action details** -- what the agent wants to do, which tool it needs, and the specific arguments
3. Choose **Approve** to let the agent proceed, or **Deny** to block the action
4. Optionally add a note explaining your decision for the audit log

> **Tip:** When you approve a one-time action, the agent continues immediately. For actions you trust repeatedly, use the "Always Allow" option to grant standing permission (see Step 9).

### Step 9: Understand Trust Tiers

Jordan wants to reduce notification noise for routine actions. The trust tier system lets you pre-authorize categories of tool usage so agents can work more autonomously within safe boundaries.

![Trust tier popover showing permission levels](../screengrabs/trust-tier-popover.png)

1. When approving a permission request, notice the **Trust Tier** indicator
2. Click the trust tier badge to see the permission hierarchy:
   - **Ask Every Time** -- agent pauses for each invocation (most restrictive)
   - **Ask Once Per Session** -- approve once and it applies for the current execution
   - **Always Allow** -- standing permission for this tool across all future executions
3. Adjust the tier based on the risk level of the action
4. Higher trust tiers reduce interruptions but require careful consideration

> **Tip:** Start with restrictive tiers and gradually open up as you build confidence in agent behavior. You can always tighten permissions later from the Settings page.

### Step 10: Review Project-Specific Tasks

Jordan checks in on the planning project to see how agent-generated tasks are progressing and whether any need manual adjustment.

![Projects list with task counts and status indicators](../screengrabs/projects-list.png)

1. Navigate to **Projects** and click on the **Q2 2026 Product Planning** project
2. Review the task list within the project context
3. Check for tasks that agents have completed and verify their output quality
4. Reassign or update any tasks that need course correction

> **Tip:** Project-scoped views filter out noise from other workstreams. Use them when you need to focus on a single initiative.

### Step 11: Revisit Schedules for Verification

After the first scheduled run completes, Jordan checks back to verify the automation is working as expected.

![Schedules list showing active and completed schedule entries](../screengrabs/schedules-list.png)

1. Return to **Schedules** in the sidebar
2. Find the "Weekly Status Report" schedule entry
3. Check the **Last Run** and **Next Run** timestamps
4. Click on the schedule to review the history of generated tasks
5. Adjust the interval or task template if the output needs refinement

> **Tip:** Schedules create real tasks each time they fire. You can find the generated tasks on the Dashboard, filtered by the schedule's project.

### Step 12: End-of-Day Inbox Sweep

Jordan finishes the day by clearing the inbox of any remaining notifications. A clean inbox means no agents are blocked and all permissions are resolved.

![Inbox with notification entries and action buttons](../screengrabs/inbox-list.png)

1. Return to the **Inbox** for a final sweep
2. Process any remaining permission requests or status notifications
3. Archive resolved notifications to keep the inbox clean
4. Confirm that no agents are blocked waiting for input

> **Tip:** A zero-notification inbox at the end of the day means your agents have everything they need to work overnight. Pair this with scheduled tasks for maximum asynchronous productivity.

## What's Next

- [Power User Guide](./power-user.md) -- Build multi-step workflows and autonomous agent loops
- [Developer Guide](./developer.md) -- Configure authentication, runtime settings, and CLI tooling
- [Personal Use Guide](./personal-use.md) -- Review the basics of project and task creation
