---
title: "Power User Guide"
category: "user-journey"
persona: "devops-engineer"
difficulty: "advanced"
estimatedTime: "24 minutes"
sections: ["Profiles", "Workflows", "Schedules", "Monitor"]
tags: ["workflows", "profiles", "automation", "autonomous-loops", "monitoring", "keyboard-shortcuts"]
lastUpdated: "2026-03-21"
---

# Power User Guide

Meet Sam, a DevOps engineer who automates everything. Sam has been using Stagent for basic task execution and is ready to unlock its full potential -- agent profiles for specialized behavior, multi-step workflows for complex pipelines, autonomous execution loops, and real-time monitoring. This journey covers the advanced automation layer that turns Stagent into a hands-off operations engine.

## Prerequisites

- Stagent installed and running locally (`npm run dev`)
- An Anthropic API key configured in `.env.local`
- Familiarity with basic Stagent concepts (projects, tasks, inbox) -- see [Personal Use Guide](./personal-use.md)
- At least one project with several completed tasks (agents learn from past context)

## Journey Steps

### Step 1: Master the Command Palette

Sam starts every session with the keyboard. The Command Palette is the fastest way to navigate, search, and execute actions without reaching for the mouse.

![Command palette in empty state showing available commands](../screengrabs/command-palette-empty.png)

1. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open the Command Palette
2. Without typing anything, review the **recent items** and **suggested actions** shown by default
3. Type a partial name to filter across projects, tasks, workflows, pages, and actions
4. Press `Enter` to execute the highlighted action immediately

> **Tip:** Power users rarely click sidebar links. Learn these keyboard shortcuts: `Cmd+K` for the palette, `Escape` to close any pane, and arrow keys for list navigation. Speed compounds across hundreds of daily interactions.

### Step 2: Explore Agent Profiles

Before building workflows, Sam reviews the available agent profiles. Each profile configures an agent's behavior, system prompt, and tool permissions for a specific role.

![Agent profiles list showing available behavioral profiles](../screengrabs/profiles-list.png)

1. Click **Profiles** in the sidebar under the **Manage** group (or use `Cmd+K` and type "Profiles")
2. Review the **profile cards** -- each displays the profile name, description, and capability summary
3. Note the four built-in profiles:
   - **General** -- balanced, all-purpose agent behavior
   - **Code Reviewer** -- focused on code quality, security, and best practices
   - **Researcher** -- optimized for information gathering and synthesis
   - **Document Writer** -- tuned for long-form content generation
4. Click on a profile to view its full configuration including system prompt and tool permissions

> **Tip:** Agent profiles are the behavioral layer of Stagent. Assigning the right profile to a task dramatically improves output quality. A code review task assigned to the Researcher profile will produce analysis, not actionable review comments.

### Step 3: Navigate to Workflows

Sam is ready to build a multi-step automation. Workflows chain multiple tasks into a pipeline where each step can depend on the output of previous steps.

![Workflows list showing existing workflow definitions](../screengrabs/workflows-list.png)

1. Click **Workflows** in the sidebar under the **Work** group
2. Review existing workflows in the list view
3. Each workflow card shows the step count, last run status, and trigger configuration
4. Click **Create Workflow** to start building a new pipeline

> **Tip:** Workflows are templates, not one-shot executions. Once defined, a workflow can be triggered manually, by schedule, or by another workflow's completion.

### Step 4: Design a Multi-Step Workflow

Sam builds a "Deploy & Verify" workflow that runs tests, deploys to staging, and verifies the deployment -- three steps, each depending on the previous one succeeding.

![Workflow creation form with steps and configuration](../screengrabs/workflows-create-form-filled.png)

1. Enter a **Workflow Name** such as "Deploy & Verify Pipeline"
2. Add a **Description** explaining the pipeline purpose and expected behavior
3. Configure **Step 1**: "Run Test Suite"
   - Set the agent profile to **Code Reviewer**
   - Define the task description: "Run the full test suite and report any failures"
4. Configure **Step 2**: "Deploy to Staging"
   - Set the agent profile to **General**
   - Define: "Deploy the current main branch to the staging environment"
   - Set dependency on Step 1 (only runs if tests pass)
5. Configure **Step 3**: "Verify Deployment"
   - Set the agent profile to **Researcher**
   - Define: "Verify the staging deployment by checking all critical endpoints and reporting status"
   - Set dependency on Step 2
6. Click **Create Workflow** to save the pipeline

> **Tip:** Each step in a workflow can use a different agent profile. Match the profile to the step's purpose -- Code Reviewer for testing, General for execution, Researcher for verification. This specialization improves reliability.

### Step 5: Review Workflow Configuration

After creating the workflow, Sam inspects the detail view to verify step ordering, dependencies, and profile assignments before running it.

![Workflow detail view showing steps and dependency graph](../screengrabs/workflows-detail.png)

1. Click on the **Deploy & Verify Pipeline** workflow to open the detail view
2. Verify the **step sequence** and dependency chain
3. Confirm each step has the correct **agent profile** assigned
4. Review the **trigger configuration** (manual, scheduled, or event-based)
5. Check the **estimated execution time** based on step complexity

> **Tip:** The workflow detail view shows the dependency graph visually. Look for any steps that could run in parallel (no dependency between them) -- Stagent will execute independent steps concurrently to save time.

### Step 6: Execute and Monitor a Workflow Run

Sam triggers the workflow manually for the first time and watches it execute in real time through the monitoring interface.

![Workflow runs showing execution history and status](../screengrabs/workflows-runs.png)

1. From the workflow detail view, click **Run Workflow**
2. Confirm the execution parameters and click **Start**
3. Watch the step status indicators update as each step begins and completes
4. Click on individual steps to view their agent logs in real time
5. If a step fails, review the error output and decide whether to retry or abort

> **Tip:** Workflow runs create real tasks for each step. You can find these tasks on the Dashboard, and their full agent logs are available in the Monitor section.

### Step 7: Set Up an Autonomous Schedule

Sam wants the deploy pipeline to run automatically every evening. Combining workflows with schedules creates fully autonomous operation loops.

![Schedules list showing configured recurring jobs](../screengrabs/schedules-list.png)

1. Navigate to **Schedules** in the sidebar
2. Click **Create Schedule**
3. Enter a **Name** such as "Nightly Deploy Pipeline"
4. Set the **Interval** to "every day at 10pm"
5. Link the schedule to the **Deploy & Verify Pipeline** workflow
6. Configure **stop conditions** -- maximum iterations, timeout, or failure threshold
7. Enable the schedule and click **Create**

> **Tip:** Autonomous loops support four stop conditions: max iterations, time limit, consecutive failures, and manual pause. Always set at least one to prevent runaway execution. A nightly deploy with max 1 iteration and a 30-minute timeout is a safe starting point.

### Step 8: Configure Autonomous Loop Parameters

Sam fine-tunes the autonomous execution settings to ensure the loop behaves predictably and stays within safety boundaries.

![Schedules list with active autonomous loop configuration](../screengrabs/schedules-list.png)

1. Click on the **Nightly Deploy Pipeline** schedule to edit
2. Review the **Stop Conditions** section:
   - **Max Iterations**: Set to 1 for nightly runs (each night = one iteration)
   - **Timeout**: Set to 30 minutes per iteration
   - **Failure Threshold**: Set to 1 (stop after first failure for investigation)
3. Enable **Iteration Context** so each run can reference the previous run's output
4. Toggle **Pause/Resume** controls for manual intervention capability
5. Save the updated configuration

> **Tip:** Iteration context is powerful for improvement loops. Each run sees what the previous run produced, enabling agents to self-correct. For deploy pipelines, this means a failed verification can inform the next deployment attempt.

### Step 9: Monitor Agent Execution

With workflows and schedules running, Sam checks the Monitor section for a unified view of all agent activity across the workspace.

![Monitor showing real-time agent execution logs](../screengrabs/monitor-list.png)

1. Click **Monitor** in the sidebar under the **Manage** group
2. Review the **execution log** showing all recent agent activity
3. Filter by **project**, **workflow**, or **agent profile** to focus on specific activity
4. Click on any log entry to view the full execution trace including tool calls, outputs, and timing
5. Watch for **error patterns** that might indicate configuration issues

> **Tip:** The Monitor is your operational dashboard. Bookmark it for quick access. When something goes wrong in an autonomous loop, the monitor's execution traces are the fastest way to diagnose the issue.

### Step 10: Use Keyboard Shortcuts for Rapid Navigation

Sam demonstrates the keyboard-first workflow that makes power use practical. Efficient navigation across sections is critical when managing multiple workflows and schedules.

![Command palette showing search across all entities](../screengrabs/command-palette-empty.png)

1. Press `Cmd+K` and type "monitor" to jump to the Monitor section
2. Press `Escape` to close any open detail pane
3. Press `Cmd+K` and type the name of a specific workflow to jump directly to it
4. Use `Tab` and `Shift+Tab` to navigate between interactive elements on any page
5. Press `Enter` on focused cards or buttons to activate them

> **Tip:** Combine the Command Palette with section-specific keyboard navigation for a fully keyboard-driven workflow. Power users can manage an entire fleet of autonomous agents without touching the mouse.

### Step 11: Review Profile-Workflow Integration

Sam circles back to verify that the right agent profiles are producing the right outputs across workflow steps. Profile-workflow alignment is the key to reliable automation.

![Profiles list showing behavioral configuration for each agent type](../screengrabs/profiles-list.png)

1. Navigate to **Profiles** and review which profiles are used across your workflows
2. Check that the **Code Reviewer** profile is handling all testing and review steps
3. Verify that the **Researcher** profile is assigned to verification and analysis steps
4. Consider whether any workflow steps would benefit from a profile change
5. Note any patterns where a custom profile might improve output quality

> **Tip:** If you find yourself frequently adjusting agent output from a specific profile, that is a signal to refine the profile's system prompt. Small prompt improvements compound across every workflow execution.

### Step 12: Validate End-to-End Automation

Sam performs a final check across all automation surfaces to confirm everything is connected and running as expected.

![Monitor showing execution traces across workflows](../screengrabs/monitor-list.png)

1. Check **Schedules** for any failed or paused entries
2. Check **Monitor** for error-level log entries in the last 24 hours
3. Verify that workflow runs are completing within expected time bounds
4. Confirm that autonomous loops have not hit their stop conditions unexpectedly
5. Review the **Inbox** for any pending permission requests that might be blocking execution

> **Tip:** A healthy automation setup has zero pending inbox items, all schedules showing recent successful runs, and monitor logs free of repeated errors. Aim for this state before leaving agents to run overnight.

## What's Next

- [Developer Guide](./developer.md) -- Configure authentication, runtime settings, and CLI tooling
- [Work Use Guide](./work-use.md) -- Learn team collaboration features and document management
- [Personal Use Guide](./personal-use.md) -- Review the basics if you need a refresher
