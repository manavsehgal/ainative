---
title: "Personal Use Guide"
category: "user-journey"
persona: "personal"
difficulty: "beginner"
estimatedTime: "20 minutes"
sections: ["home-workspace", "dashboard-kanban", "projects"]
tags: ["getting started", "solo", "productivity", "first run"]
lastUpdated: "2026-03-17"
---

# Personal Use Guide

You're a solo developer, student, or creative professional who wants an AI agent to help with everyday tasks — research, writing, code review, or file management. This guide walks you through your first session with Stagent: setting up a project, creating a task, watching an agent work, and reviewing the results.

## Prerequisites
- Stagent running at `localhost:3000` (run `npx stagent` to start)
- An Anthropic API key or Claude Max subscription (configure in Settings)

## Journey Steps

### Step 1: Explore the Home Workspace

When you first open Stagent, you land on the Home workspace. This is your daily briefing — it shows active tasks, pending approvals, project health, and recent activity.

![Stagent home workspace showing stats and activity](../screengrabs/home-list.png)

1. Open your browser to **localhost:3000**
2. Take in the **stat cards** at the top — they'll be empty on your first visit
3. Notice the **sidebar** on the left with all navigation sections
4. The sidebar collapses to icons if you click the toggle — useful for more screen space

> **Tip:** The Home page updates automatically. After you start running tasks, you'll see activity appear here in real time.

### Step 2: Configure Your Connection

Before agents can run, Stagent needs to connect to an AI provider.

![Settings page with authentication options](../screengrabs/settings-list.png)

1. Click **Settings** in the sidebar
2. In the **Authentication** section, choose your method:
   - **OAuth** (recommended if you have a Claude Max subscription — no API costs)
   - **API Key** (paste your Anthropic API key)
3. Click **Test Connection** to verify it works
4. You should see a green status indicator

> **Tip:** OAuth uses your Claude Max subscription, so there's no per-token cost. API Key billing is metered.

### Step 3: Create Your First Project

Projects organize related tasks. Think of them as folders for your work.

![Project cards overview](../screengrabs/projects-list.png)

1. Click **Projects** in the sidebar
2. Click **New Project**
3. Enter a name like "Personal Tasks" and a brief description
4. Optionally set a **Working Directory** if you want agents to work with specific files
5. Click **Create**

> **Tip:** The working directory is powerful — if you point it at a code repository, agents can read and modify files in that project automatically.

### Step 4: Create a Task

Now let's give an agent something to do.

![Empty task creation form](../screengrabs/dashboard-create-form-empty.png)

1. Click **Dashboard** in the sidebar
2. Click **New Task** in the top right
3. Enter a **title** like "Research best practices for TypeScript testing"
4. Write a **description** explaining what you want the agent to do
5. Select your project from the **Project** dropdown
6. Leave the priority at **Medium** for now
7. Click **Create**

Your task appears in the **Planned** column of the kanban board.

### Step 5: Use AI Assist to Improve Your Task

Before executing, let AI refine your task description.

![AI Assist suggestions panel](../screengrabs/dashboard-create-form-ai-assist.png)

1. Create another task, but this time enter just a brief title and description
2. Click the **AI Assist** button (the sparkles icon)
3. Wait a few seconds for the AI to analyze your task
4. Review the **AI Suggestions** — improved description, subtask ideas, complexity estimate
5. Click **Apply** to use the improved description

![AI suggestions applied](../screengrabs/dashboard-create-form-ai-applied.png)

> **Tip:** AI Assist works best when you give it a clear title and even a rough description. It fills in the details you might miss.

### Step 6: Execute Your Task

Time to let an agent work on your task.

1. On the **Dashboard**, find your task in the Planned column
2. Click the task card to open its detail
3. Click **Execute** to dispatch it to an agent
4. The card moves to **Queued**, then **Running** as the agent picks it up

### Step 7: Handle Agent Approvals

While the agent works, it may need permission to use tools.

![Inbox with approval requests](../screengrabs/inbox-list.png)

1. Watch for the **unread badge** on the Inbox icon in the sidebar
2. Click **Inbox** to see pending approvals
3. The agent might request permission to run a shell command or read a file
4. Review the tool and arguments, then click **Allow Once**
5. For tools you trust (like file reads), click **Always Allow** to save the pattern

> **Tip:** "Always Allow" patterns accumulate over time. After a few sessions, your trusted tools auto-approve and the agent works more autonomously.

### Step 8: Watch the Agent Work

![Monitor with real-time log streaming](../screengrabs/monitor-list.png)

1. Click **Monitor** in the sidebar
2. Watch log entries stream in real time as the agent works
3. You'll see tool calls, results, reasoning steps, and decisions
4. Click any entry to jump to the associated task

### Step 9: Review the Results

1. When the task card moves to **Completed** on the Dashboard, click it
2. Review the agent's **output** — the final result of its work
3. If there are attached files, download them
4. If the result isn't quite right, you can create a follow-up task

### Step 10: Check Your Workspace

![Home workspace after running tasks](../screengrabs/home-list.png)

1. Return to **Home** to see your updated workspace
2. The stat cards now show your task counts
3. The activity feed shows what happened during your session
4. Sparklines show your 7-day activity trend

> **Tip:** Make Home your starting point each day. It gives you a quick overview before diving into specific tasks.

## What's Next
- [Work Use Guide](./work-use.md) — organize projects, manage documents, and schedule automations
- [Dashboard & Kanban](../features/dashboard-kanban.md) — deep dive into task management
- [Agent Profiles](../features/profiles.md) — use specialist agents for different tasks
