---
title: "Power User Guide"
category: "user-journey"
persona: "power-user"
difficulty: "advanced"
estimatedTime: "30 minutes"
sections: ["profiles", "workflows", "schedules", "monitoring"]
tags: ["advanced", "profiles", "workflows", "blueprints", "autonomous", "swarm"]
lastUpdated: "2026-03-17"
---

# Power User Guide

You've mastered the basics and want to push Stagent further. This guide covers creating custom agent profiles, building multi-step workflows, using blueprints for common patterns, running autonomous loops, and orchestrating multi-agent swarms. These are the power tools that make complex automation possible.

## Prerequisites
- Familiarity with basic Stagent operations (see [Personal Use Guide](./personal-use.md))
- At least one project with some completed tasks
- Both Claude and/or OpenAI Codex configured (for cross-provider workflows)

## Journey Steps

### Step 1: Create a Custom Agent Profile

Built-in profiles are a starting point. Custom profiles let you define exactly how an agent should behave.

![Agent profile gallery](../screengrabs/profiles-list.png)

1. Navigate to **Profiles** and click **New Profile**
2. Give it a clear name: "TypeScript Migration Specialist"
3. Write detailed **instructions**:
   ```
   You are an expert at migrating JavaScript codebases to TypeScript.
   Focus on type safety, avoid `any` types, and preserve existing tests.
   Always check for breaking changes before modifying imports.
   ```
4. Configure **allowed tools** — grant file read/write and shell access
5. Set **max turns** to 50 (migrations need more iterations)
6. Click **Create**

> **Tip:** Good instructions are specific about what the agent should and shouldn't do. Include constraints ("avoid `any` types") alongside goals ("migrate to TypeScript").

### Step 2: Test Your Profile

Before using a profile in production, verify it behaves correctly.

1. Open your new profile's detail view
2. Click **Run Test**
3. The system runs a behavioral smoke test with sample prompts
4. Review the results — does the agent follow your instructions?
5. Iterate on the instructions if the test reveals unexpected behavior

### Step 3: Import a Community Profile

Discover profiles others have built and import them.

1. Navigate to **Profiles**
2. Click **Import from GitHub**
3. Paste a GitHub URL pointing to a profile YAML file
4. Review the imported profile's instructions and tool policy
5. Click **Import** to add it to your gallery

### Step 4: Build a Workflow from a Blueprint

Blueprints are pre-configured workflow templates. Use them to spin up common automations quickly.

![Workflow list](../screengrabs/workflows-list.png)

1. Navigate to **Workflows** and click **New Workflow**
2. Select the **Blueprints** tab
3. Browse available templates — "Code Review Pipeline", "Research Report", "Documentation Sprint"
4. Click a blueprint to preview its steps, required variables, and profile assignments
5. Fill in the **dynamic form** with your specific values (e.g., repository URL, review criteria)
6. Review the generated workflow steps
7. Click **Create Workflow**

> **Tip:** Blueprints track lineage — you can always see which template a workflow came from and how it was customized.

### Step 5: Create a Custom Multi-Step Workflow

For unique automation needs, build workflows from scratch.

1. Navigate to **Workflows** and click **New Workflow**
2. Choose a **pattern**:
   - **Sequence** — steps run in order
   - **Parallel** — 2-5 branches run concurrently, then synthesize
   - **Checkpoint** — pauses for your approval between steps
3. Add steps, each with a name, prompt, and profile assignment
4. Assign your custom "TypeScript Migration Specialist" to the relevant steps
5. Click **Create** and then **Execute**

### Step 6: Monitor Workflow Execution

Watch a multi-step workflow unfold in real time.

![Monitor with log streaming](../screengrabs/monitor-list.png)

1. Open the workflow detail view to see step-level progress
2. Each step shows: status (pending, running, completed, failed), assigned profile, and output
3. Click **Monitor** for real-time log streaming across all steps
4. For checkpoint workflows, approve each step when it pauses for your review

> **Tip:** If a step fails, you can retry just that step without restarting the entire workflow.

### Step 7: Set Up an Autonomous Loop

Autonomous loops let an agent iterate on a task until it reaches a satisfactory result.

1. Create a workflow with the **Loop** pattern
2. Write a prompt that benefits from iteration, e.g.:
   ```
   Improve test coverage for the authentication module.
   Each iteration: identify the least-covered function, write tests for it,
   and report the new coverage percentage.
   ```
3. Configure **stop conditions**:
   - Max iterations: 10
   - Time budget: 30 minutes (whichever comes first)
4. Execute the workflow

The agent runs multiple iterations, each building on the previous output. Monitor progress in the loop status view.

### Step 8: Run a Multi-Agent Swarm

Swarm orchestration uses multiple agents working together: a mayor plans the work, workers execute in parallel, and a refinery synthesizes results.

1. Create a workflow with the **Swarm** pattern
2. Define the **mayor prompt** — what should be planned
3. Set **worker concurrency** (2-5 simultaneous workers)
4. Configure the **refinery prompt** — how to synthesize worker outputs
5. Assign profiles: use "Researcher" for workers and "Document Writer" for refinery
6. Execute and watch the mayor delegate, workers execute, and refinery combine

### Step 9: Review Agent Learning

After running tasks, agents propose behavioral improvements. Review and curate them.

1. Check your **Inbox** after task or workflow completion
2. Look for **context proposals** — behavioral rules the agent wants to learn
3. Review each proposal carefully
4. **Approve** valuable patterns (e.g., "Always check for circular imports before refactoring")
5. **Reject** unhelpful ones
6. **Edit** to refine wording before approving

For workflows, proposals arrive in batches — review them all at once instead of one by one.

### Step 10: Create a Blueprint from Your Workflow

Once you've built a workflow that works well, save it as a blueprint for reuse.

1. Open a completed workflow's detail view
2. Click **Save as Blueprint**
3. Add a description and configure which values should be variables (filled in each time)
4. Your blueprint appears in the gallery for future use

> **Tip:** You can also create blueprints from YAML files or import them from GitHub URLs, making it easy to share with others.

## What's Next
- [Developer Guide](./developer.md) — CLI setup, API integration, extending profiles
- [Workflows](../features/workflows.md) — all six workflow patterns explained
- [Agent Profiles](../features/profiles.md) — advanced profile configuration
- [Agent Intelligence](../features/agent-intelligence.md) — self-improvement deep dive
