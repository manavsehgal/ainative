---
title: "Power User Guide"
category: "user-journey"
persona: "power-user"
difficulty: "advanced"
estimatedTime: "30 minutes"
sections: ["dashboard-kanban", "profiles", "chat", "workflows", "schedules", "monitoring"]
tags: ["advanced", "automation", "workflows", "profiles", "schedules", "monitoring", "bulk-operations"]
lastUpdated: "2026-03-22"
---

# Power User Guide

Meet Sam, a DevOps engineer who automates everything that can be automated -- and most things that people assume cannot. Sam has already completed the Personal Use Guide and runs Stagent daily as an AI business operating system. Now Sam is ready to go deeper: specialized agent profiles, multi-step workflow pipelines, scheduled autonomous loops, bulk operations, and real-time monitoring. This guide covers the advanced automation layer that puts entire business processes on autopilot.

## Prerequisites

- Stagent installed and running locally (`npm run dev`)
- An Anthropic API key configured in `.env.local`
- Familiarity with basic Stagent concepts (projects, tasks, inbox) -- see [Personal Use Guide](./personal-use.md)
- At least one project with several completed tasks (agents learn from past context)

## Journey Steps

### Step 1: Master Keyboard Navigation

Sam refuses to reach for the mouse when a keystroke will do. The Command Palette is the nerve center of keyboard-driven navigation -- it searches across every entity in the workspace and launches actions instantly.

![Command palette overlay showing available commands and navigation](../screengrabs/command-palette-empty.png)

1. Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to open the Command Palette
2. Without typing anything, scan the **recent items** and **suggested actions** that appear by default
3. Type a partial name -- "deploy," "nightly," "code review" -- to filter across projects, tasks, workflows, schedules, and pages
4. Use **arrow keys** to highlight an item and press **Enter** to navigate or execute immediately
5. Press **Escape** to dismiss the palette and return focus to the current page

> **Tip:** The Command Palette is contextual. It surfaces results from every section of Stagent, so you never need to remember which sidebar group a feature lives under. Power users open the palette dozens of times per session -- muscle memory for Cmd+K pays for itself on day one.

### Step 2: Explore Agent Profiles

Before building any automation, Sam reviews the available agent profiles. Each profile shapes an agent's personality, system prompt, and tool permissions for a specific role -- assigning the right profile to the right task is the single biggest lever for output quality.

![Agent profiles grid showing available behavioral profiles with work and personal tabs](../screengrabs/profiles-list.png)

1. Open the Command Palette and type **"Profiles"**, or click **Profiles** in the sidebar under the **Manage** group
2. Browse the **profile cards** in the grid -- each displays the profile name, a short description, and a capability summary
3. Switch between the **Work** and **Personal** tabs to see profiles organized by context
4. Note the built-in profiles:
   - **General** -- balanced, all-purpose agent behavior
   - **Code Reviewer** -- focused on code quality, security, and best practices
   - **Researcher** -- optimized for information gathering and synthesis
   - **Document Writer** -- tuned for long-form content generation
5. Click any profile card to open its full detail page

> **Tip:** Think of profiles the way you think of IAM roles -- least privilege, purpose-fit. A task assigned to the Code Reviewer profile will produce actionable review comments with line references. The same task on the General profile will produce a softer, less specific summary.

### Step 3: Deep-Dive into Profile Configuration

Sam opens a profile detail page to understand exactly what an agent will do when assigned this profile. The detail view exposes the system prompt, tool permissions, and capability badges that govern agent behavior.

![Profile detail page showing capabilities, tools, and full configuration](../screengrabs/profiles-detail.png)

1. From the profiles grid, click a profile card (e.g., **Code Reviewer**) to open the detail page
2. Read the **system prompt** section -- this is the instruction set the agent receives before every task
3. Review the **capabilities** list to see which tools and actions the profile permits
4. Check the **tool permissions** section for any tools that are explicitly allowed or denied
5. Use the back button or Command Palette to return to the profiles grid

> **Tip:** When a workflow step produces unexpected output, the profile detail page is the first place to investigate. Nine times out of ten, the system prompt or tool permissions explain the behavior. Small prompt refinements compound across every execution.

### Step 4: Optimize Chat with Model Selection

Sam uses Chat strategically, switching between models based on query complexity. Model selection is the primary cost optimization lever -- the right model for the right question can cut chat costs dramatically.

![Chat model selector dropdown showing available models with cost tier indicators](../screengrabs/chat-model-selector.png)

1. Navigate to **Chat** in the sidebar under the **Work** group
2. Click the **model selector** in the input composer area to reveal the dropdown
3. Review the available models -- each displays a **cost tier indicator** ($ to $$$) alongside the model name
4. Select **Haiku ($)** for quick factual queries like "list my active schedules" or "how many tasks failed this week"
5. Switch to **Opus ($$$)** for multi-step reasoning like "analyze the error patterns across my last 10 workflow runs and suggest architectural fixes"
6. Notice the cost tier badge update as you switch between models

> **Tip:** Haiku is 10-20x cheaper per token than Opus. Sam's rule of thumb: if the answer requires recalling a fact, use Haiku. If the answer requires *thinking*, use Opus. This habit alone can reduce monthly chat spend by 80% without sacrificing quality where it matters.

### Step 5: Use Chat for Complex Queries

Sam sends a query and discovers that Chat responses include Quick Access pills -- interactive links that connect chat answers directly to the entities they reference. No more copy-pasting IDs to look up a task.

![Chat message with Quick Access entity navigation pills linking to tasks and projects](../screengrabs/chat-quick-access.png)

1. Type a complex query such as **"Which tasks in the Infrastructure project are blocked, and what's blocking them?"**
2. Read the agent's response -- it synthesizes information from across your workspace
3. Notice the **Quick Access pills** embedded in the response -- colored badges that link to specific tasks, projects, or workflows
4. Click a Quick Access pill to navigate directly to that entity's detail page
5. Use the browser back button or Command Palette to return to the chat conversation

> **Tip:** Quick Access pills turn Chat into a navigation hub. Instead of manually browsing the sidebar to find a specific task the agent mentioned, click the pill. Sam often starts a session by asking Chat "what needs my attention today?" and then clicking through the linked entities.

### Step 6: Browse Workflow Blueprints

Sam wants to build a multi-step automation pipeline but does not want to start from scratch. The Blueprint Gallery offers pre-built workflow templates designed for common DevOps patterns.

![Workflow blueprint gallery showing pre-built templates for common automation patterns](../screengrabs/workflows-blueprints.png)

1. Navigate to **Workflows** in the sidebar under the **Work** group
2. Click the **Blueprints** tab (or navigate directly to the blueprint gallery)
3. Browse the available templates -- each blueprint includes a name, description, step count, and recommended profile assignments
4. Look for templates that match your use case: deploy pipelines, code review chains, research synthesis, documentation generation
5. Click a blueprint to preview its step configuration before creating a workflow from it
6. Click **Use Blueprint** to create a new workflow pre-populated with the template's steps

> **Tip:** Blueprints encode best practices. Even if you plan to customize heavily, starting from a blueprint ensures you get the step ordering, dependency chains, and profile assignments right. Sam always starts from a blueprint and then adjusts -- it is faster than building from zero.

### Step 7: Build a Multi-Step Workflow

Sam customizes a workflow for a "Deploy & Verify" pipeline -- three steps, each depending on the previous one succeeding, each assigned to the right agent profile.

![Workflows list showing existing workflow definitions with tabs for All, Templates, and Runs](../screengrabs/workflows-list.png)

1. From the Workflows page, click **Create Workflow** (or customize a blueprint from Step 6)
2. Enter a **Workflow Name** such as "Nightly Deploy & Verify"
3. Add a description explaining the pipeline's purpose
4. Configure **Step 1 -- Run Tests**: assign the **Code Reviewer** profile, set the prompt to "Run the full test suite and report failures with root cause analysis"
5. Configure **Step 2 -- Deploy to Staging**: assign the **General** profile, set dependency on Step 1
6. Configure **Step 3 -- Verify Deployment**: assign the **Researcher** profile, set dependency on Step 2, prompt it to "Check all critical endpoints and report status"
7. Save the workflow

> **Tip:** Each step in a workflow can use a different agent profile. This is the key insight: match the profile to the step's purpose. Code Reviewer for testing, General for execution, Researcher for verification. Profile specialization across steps is what makes workflows more reliable than running a single general-purpose agent.

### Step 8: Inspect Workflow Execution

After triggering a run, Sam opens the workflow detail view to track step-by-step progress, inspect outputs, and diagnose any failures in the pipeline.

![Workflow detail page showing steps, dependency graph, and execution status](../screengrabs/workflows-detail.png)

1. Click on a workflow (e.g., "Nightly Deploy & Verify") to open the detail view
2. Review the **step sequence** and dependency chain displayed visually
3. Check each step's **status indicator** -- queued, running, completed, or failed
4. Click on a completed step to read its full output and see which tools the agent used
5. If a step failed, expand its error output to diagnose the issue
6. Use the **Run Workflow** button to trigger a new execution

> **Tip:** Independent steps (those without dependencies between them) execute concurrently. Sam designs workflows to maximize parallelism -- if two verification checks do not depend on each other, they run simultaneously and the pipeline finishes faster.

### Step 9: Batch-Manage Tasks on the Kanban

Sam switches to the Dashboard to clean up the task board. Bulk select mode lets you queue, reassign, or delete multiple tasks in a single action -- essential when autonomous workflows generate dozens of tasks overnight.

![Kanban board in bulk select mode with checkboxes and bulk action toolbar](../screengrabs/dashboard-bulk-select.png)

1. Navigate to the **Dashboard** (kanban board view)
2. Click the **Select** button in the toolbar to enter bulk select mode
3. Check the boxes on multiple task cards across any status column
4. Use the **bulk action toolbar** that appears at the top to:
   - **Queue** selected tasks for agent execution
   - **Move** selected tasks to a different status column
   - **Delete** selected tasks that are no longer needed
5. Confirm the bulk action and exit select mode

> **Tip:** After a weekend of autonomous loop runs, Sam's first Monday task is always a bulk cleanup. Enter select mode, check all the "completed" tasks that need archiving, and clear the board in one action. Keeping the kanban clean prevents cognitive overload as automation scales.

### Step 10: Schedule Automated Prompt Loops

Sam sets up a recurring schedule so the Deploy & Verify workflow runs every evening without manual intervention. Combining workflows with schedules creates fully autonomous operation loops.

![Schedules list showing configured recurring jobs with status, frequency, and next firing time](../screengrabs/schedules-list.png)

1. Navigate to **Schedules** in the sidebar under the **Manage** group
2. Click **Create Schedule**
3. Enter a **Name** such as "Nightly Deploy Pipeline"
4. Set the **Interval** using natural language: "every day at 10pm" or "every 6 hours"
5. Link the schedule to the **Nightly Deploy & Verify** workflow
6. Configure **stop conditions** to prevent runaway execution:
   - **Max iterations**: 1 per trigger (each night = one full pipeline run)
   - **Timeout**: 30 minutes per iteration
   - **Failure threshold**: 1 (pause after first failure for investigation)
7. Enable the schedule and click **Create**

> **Tip:** Always set at least one stop condition. Sam's rule: max iterations prevents infinite loops, timeout prevents hung agents, and failure threshold prevents burning tokens on a broken pipeline. All three together form a safety net for unattended operation.

### Step 11: Monitor Schedule Execution

Sam checks in on the nightly schedule to verify it fired correctly, review its execution history, and confirm the next scheduled run.

![Schedule detail sheet showing configuration, stop conditions, and firing history](../screengrabs/schedules-detail.png)

1. From the Schedules list, click on **Nightly Deploy Pipeline** to open the detail sheet
2. Review the **firing history** -- a list of past executions with timestamps and outcomes
3. Check the **next firing time** to confirm the schedule is correctly queued
4. Verify the **stop conditions** are configured as intended
5. Toggle **Pause/Resume** if you need to temporarily disable the schedule (e.g., during a maintenance window)
6. Close the detail sheet to return to the schedules list

> **Tip:** Iteration context is a powerful feature for improvement loops. When enabled, each run can reference the previous run's output. For deploy pipelines, this means a failed verification can inform the next deployment attempt -- agents learn from their own history.

### Step 12: Watch Agent Execution in Real-Time

Sam opens the Monitor section for a unified view of all agent activity across the workspace -- every task execution, workflow step, and scheduled run appears here with full trace logs.

![Agent monitoring dashboard showing real-time execution logs and activity feed](../screengrabs/monitor-list.png)

1. Click **Monitor** in the sidebar under the **Manage** group
2. Review the **execution log** showing all recent agent activity in reverse chronological order
3. Filter by **project**, **workflow**, or **agent profile** to focus on specific activity streams
4. Click on any log entry to expand the full execution trace -- tool calls, outputs, token counts, and timing
5. Watch for **error patterns** such as repeated failures on the same tool or profile
6. Use the monitor to verify that scheduled runs are completing within expected time bounds

> **Tip:** The Monitor is Sam's operational dashboard. When something goes wrong in an autonomous loop at 3am, the monitor's execution traces are the fastest path to diagnosis. Sam bookmarks this page and checks it first thing every morning.

### Step 13: Use Chat Suggested Prompts

Sam returns to Chat and discovers the suggested prompts feature -- tabbed categories of pre-written prompts that cover common operations. Instead of typing from scratch, Sam picks a prompt and edits it.

![Chat suggested prompts with Create tab selected showing categorized prompt templates](../screengrabs/chat-create-tab.png)

1. Navigate to **Chat** (or open a new conversation)
2. Below the input composer, notice the **suggested prompt tabs** -- categories like Create, Analyze, Manage, and more
3. Click the **Create** tab to see prompts related to creating new entities (tasks, workflows, schedules)
4. Click a suggested prompt to populate the input composer with pre-written text
5. Edit the prompt to match your specific needs, then send it
6. Try other tabs to discover prompts for analysis, troubleshooting, and status checks

> **Tip:** Suggested prompts are not just shortcuts -- they are examples of how to phrase requests for the best agent response. Sam reads through them to learn the phrasing patterns that produce the most useful output, then adapts those patterns for custom queries.

### Step 14: Chain Workflows and Schedules

Sam connects the dots: workflows define *what* to automate, schedules define *when* to automate, and profiles define *how* each step behaves. Chaining all three creates autonomous loops that run, learn, and improve without human intervention.

![Workflows list showing automation pipelines ready for scheduling](../screengrabs/workflows-list.png)

1. Review your existing workflows and identify which ones should run on a schedule
2. For each workflow, create a corresponding schedule with appropriate intervals and stop conditions
3. Assign specialized profiles to each workflow step for maximum output quality
4. Enable **iteration context** on schedules where the agent should learn from previous runs
5. Set up the Monitor as your oversight layer -- check it daily to catch issues early
6. Gradually increase automation scope: start with one nightly workflow, then add weekly research sweeps, then continuous monitoring loops

> **Tip:** Sam's automation philosophy: start small, observe, then expand. Run a workflow manually three times before scheduling it. Confirm the schedule fires correctly for a week before enabling iteration context. Trust builds incrementally -- and so should autonomy.

### Step 15: What's Next

Sam's Stagent workspace is now a fully autonomous operations engine -- specialized agent profiles handling different task types, multi-step workflows executing complex pipelines, schedules firing on cadence, and the Monitor providing real-time oversight. The next step is going deeper into the platform layer.

- [Developer Guide](./developer.md) -- Configure authentication methods, runtime settings, CLI tooling, and permission presets
- [Work Use Guide](./work-use.md) -- Explore team collaboration features, document management, and cost governance
- [Personal Use Guide](./personal-use.md) -- Review the basics if you need a refresher on projects, tasks, and the inbox
