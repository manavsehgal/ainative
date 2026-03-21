---
title: "Workflows"
category: "feature-reference"
section: "workflows"
route: "/workflows"
tags: [workflows, patterns, sequence, parallel, swarm, autonomous, templates, multi-step]
features: ["workflow-engine", "workflow-blueprints", "ai-assist-workflow-creation", "workflow-context-batching"]
screengrabCount: 6
lastUpdated: "2026-03-21"
---

# Workflows

Workflows let you orchestrate multi-step agent operations using six built-in patterns. From simple sequences to parallel research fans and multi-agent swarms, workflows encode repeatable processes that agents execute with human checkpoints where you need them.

## Screenshots

![Workflows list view](../screengrabs/workflows-list.png)
*Workflow cards showing name, pattern type, step count, and status*

![Workflows templates tab](../screengrabs/workflows-templates.png)
*Templates tab showing reusable workflow patterns ready to instantiate*

![Workflows runs tab](../screengrabs/workflows-runs.png)
*Runs tab showing active and completed workflow executions*

![Workflow detail view](../screengrabs/workflows-detail.png)
*Workflow detail page with step-by-step breakdown and execution status*

![Create workflow form empty](../screengrabs/workflows-create-form-empty.png)
*Empty workflow creation form with pattern type selector and step builder*

![Create workflow form filled](../screengrabs/workflows-create-form-filled.png)
*Filled workflow creation form with multiple steps configured*

## Key Features

### Six Pattern Types
Workflows support six orchestration patterns:
- **Sequence** — Steps execute one after another in order.
- **Planner-Executor** — A planning step generates a plan, then an executor step carries it out.
- **Checkpoint** — Inserts a human-in-the-loop approval gate between steps.
- **Autonomous Loop** — Repeats a step until a stop condition is met (max iterations, goal reached, error threshold, or timeout).
- **Parallel Research** — Fans out multiple steps to run concurrently, then merges results.
- **Multi-Agent Swarm** — Multiple agent profiles collaborate on a shared objective with dynamic handoffs.

### Tabs: All, Templates, Runs
The workflow page organizes content into three tabs. "All" shows every workflow. "Templates" shows reusable patterns you can instantiate. "Runs" shows active and historical executions with their current status.

### Workflow Cards
Each workflow card displays the name, pattern type, step count, and current status. Click a card to open the detail view.

### Workflow Detail Page
The detail view shows the full step-by-step breakdown of a workflow, including each step's name, instructions, assigned agent profile, runtime, and execution status. For running workflows, you can see which step is currently active.

### Step Builder
The creation form includes a step builder where you define each step with a name and instructions. Each step can be assigned a specific agent profile and runtime, enabling mixed-agent workflows.

### Templates
Save workflows as templates for reuse. Templates preserve the pattern type, steps, and configuration — instantiate them later with a single click, optionally overriding specific parameters.

## How To

### Create a New Workflow
1. Navigate to `/workflows` and click "New Workflow."
2. Enter a name and select a pattern type (e.g., Sequence, Checkpoint).
3. Optionally link the workflow to a project.
4. Use the step builder to add steps — each step needs a name and instructions.
5. Assign an agent profile and runtime to each step as needed.
6. Click "Create" to save the workflow.

### Run a Workflow
1. Open the workflow detail page by clicking its card.
2. Click "Run" to start execution.
3. For Checkpoint patterns, you will be prompted to approve at each gate.
4. Monitor progress in real time on the detail page or in the Runs tab.

### Use a Template
1. Go to the "Templates" tab on the workflows page.
2. Click a template card to preview its configuration.
3. Click "Use Template" to create a new workflow instance from it.
4. Modify any steps or parameters as needed, then save.

### Monitor Workflow Runs
1. Navigate to the "Runs" tab to see all active and completed executions.
2. Click a run to see step-by-step progress and any agent output.
3. Failed steps display error details to help with debugging.

## Related
- [Dashboard Kanban](./dashboard-kanban.md)
- [Projects](./projects.md)
- [Profiles](./profiles.md)
- [Schedules](./schedules.md)
