---
title: "Workflows"
category: "feature-reference"
section: "workflows"
route: "/workflows"
tags: [workflows, patterns, sequence, parallel, swarm, autonomous, templates, multi-step, blueprints]
features: ["workflow-engine", "workflow-blueprints", "ai-assist-workflow-creation", "workflow-context-batching", "business-function-profiles"]
screengrabCount: 3
lastUpdated: "2026-03-31"
---

# Workflows

Workflows let you orchestrate multi-step agent operations using six built-in patterns. From simple sequences to parallel research fans and multi-agent swarms, workflows encode repeatable processes that agents execute with human checkpoints where you need them. The blueprint gallery includes both technical and business-function templates.

## Screenshots

![Workflows list view](../screengrabs/workflows-list.png)
*Workflow cards showing name, pattern type, step count, and status*

![Workflow detail view](../screengrabs/workflows-detail.png)
*Workflow detail page with step-by-step breakdown and execution status*

![Workflow blueprints gallery](../screengrabs/workflows-blueprints.png)
*Workflow blueprints gallery with pre-built workflow templates*

## Key Features

### Six Pattern Types
Workflows support six orchestration patterns:
- **Sequence** -- Steps execute one after another in order.
- **Planner-Executor** -- A planning step generates a plan, then an executor step carries it out.
- **Checkpoint** -- Inserts a human-in-the-loop approval gate between steps.
- **Autonomous Loop** -- Repeats a step until a stop condition is met (max iterations, goal reached, error threshold, or timeout).
- **Parallel Research** -- Fans out multiple steps to run concurrently, then merges results.
- **Multi-Agent Swarm** -- Multiple agent profiles collaborate on a shared objective with dynamic handoffs.

### Workflow Blueprints
The blueprint gallery offers pre-built workflow templates for common patterns:
- **Technical blueprints** -- code review pipelines, deploy-and-verify, research synthesis, documentation generation
- **Business-function blueprints** -- lead research pipeline, content marketing pipeline, customer support triage, financial reporting, business daily briefing

Click any blueprint to preview its steps, then create a workflow pre-populated with the template configuration. Customize steps, profiles, and runtimes to match your specific process.

### Tabs: All, Templates, Runs
The workflow page organizes content into three tabs. "All" shows every workflow. "Templates" shows reusable patterns you can instantiate. "Runs" shows active and historical executions with their current status.

### Workflow Cards
Each workflow card displays the name, pattern type, step count, and current status. Click a card to open the detail view.

### Workflow Detail Page
The detail view shows the full step-by-step breakdown of a workflow, including each step's name, instructions, assigned agent profile, runtime, and execution status. For running workflows, you can see which step is currently active.

### Step Builder
The creation form includes a step builder where you define each step with a name and instructions. Each step can be assigned a specific agent profile and runtime, enabling mixed-agent workflows where different profiles handle different steps.

### AI-Assisted Workflow Creation
The AI Assist feature can analyze a task and recommend converting it into a workflow with appropriate steps, patterns, and profile assignments.

## How To

### Create a New Workflow
1. Navigate to `/workflows` and click "New Workflow."
2. Enter a name and select a pattern type (e.g., Sequence, Checkpoint).
3. Optionally link the workflow to a project.
4. Use the step builder to add steps -- each step needs a name and instructions.
5. Assign an agent profile and runtime to each step as needed.
6. Click "Create" to save the workflow.

### Use a Blueprint
1. Go to the "Blueprints" tab on the workflows page.
2. Click a blueprint card to preview its configuration.
3. Click "Use Blueprint" to create a new workflow instance from it.
4. Modify any steps or parameters as needed, then save.

### Run a Workflow
1. Open the workflow detail page by clicking its card.
2. Click "Run" to start execution.
3. For Checkpoint patterns, you will be prompted to approve at each gate.
4. Monitor progress in real time on the detail page or in the Runs tab.

### Monitor Workflow Runs
1. Navigate to the "Runs" tab to see all active and completed executions.
2. Click a run to see step-by-step progress and any agent output.
3. Failed steps display error details to help with debugging.

## Related
- [Dashboard Kanban](./dashboard-kanban.md)
- [Projects](./projects.md)
- [Profiles](./profiles.md)
- [Schedules](./schedules.md)
- [Agent Intelligence](./agent-intelligence.md)
