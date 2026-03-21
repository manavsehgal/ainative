---
title: "Personal Use Guide"
category: "user-journey"
persona: "solo-developer"
difficulty: "beginner"
estimatedTime: "20 minutes"
sections: ["Home", "Dashboard", "Projects"]
tags: ["getting-started", "solo", "ai-assist", "kanban", "command-palette"]
lastUpdated: "2026-03-21"
---

# Personal Use Guide

Meet Alex, a solo developer who just discovered Stagent. Alex has a side project that needs planning and execution help, but has never used an AI agent workspace before. In this journey, Alex will set up a personal project, create tasks with AI assistance, and track progress on the kanban board -- all in about 20 minutes.

## Prerequisites

- Stagent installed and running locally (`npm run dev`)
- An Anthropic API key configured in `.env.local`
- A project idea in mind (we will use a "Portfolio Website" as our example)

## Journey Steps

### Step 1: Explore the Home Screen

Alex opens Stagent for the first time and lands on the home screen. The home view provides a high-level snapshot of recent activity, active tasks, and quick-access navigation cards. This is the launchpad for everything in Stagent.

![Home screen showing activity overview and navigation cards](../screengrabs/home-list.png)

1. Open Stagent at `http://localhost:3000`
2. Review the **activity feed** showing recent task and agent updates
3. Scan the **navigation cards** for quick access to Projects, Dashboard, and other sections

> **Tip:** The home screen updates in real time. As you create projects and tasks, you will see them reflected here immediately.

### Step 2: Open the Command Palette

Before diving in, Alex learns the fastest way to navigate Stagent -- the Command Palette. This keyboard-driven search lets you jump to any page, project, or task instantly.

![Command palette with search results](../screengrabs/command-palette-search.png)

1. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open the Command Palette
2. Type a few characters to filter available actions and pages
3. Use arrow keys to highlight a result and press `Enter` to navigate
4. Press `Escape` to dismiss without selecting

> **Tip:** The Command Palette searches across projects, tasks, workflows, and navigation pages. It becomes more useful as your workspace grows.

### Step 3: Navigate to Projects

Alex decides to start by creating a project to organize all the portfolio website work. Projects in Stagent are containers that group related tasks, documents, and agent activity.

![Projects list showing existing projects](../screengrabs/projects-list.png)

1. Click **Projects** in the sidebar under the **Work** group
2. Review the projects list -- it may be empty if this is a fresh install
3. Click the **Create Project** button in the top-right corner

> **Tip:** You can also reach this page by typing "Projects" in the Command Palette.

### Step 4: Create a New Project

Alex fills in the project details for the portfolio website. The create form captures the essential information an AI agent needs to understand the project scope.

![Project creation form with fields filled in](../screengrabs/projects-create-form-filled.png)

1. Enter a **Project Name** such as "Portfolio Website"
2. Add a **Description** explaining the project goals: "Personal developer portfolio with blog, project showcase, and contact form"
3. Set the **Working Directory** to the local path where code lives (e.g., `~/Developer/portfolio`)
4. Click **Create Project** to save

> **Tip:** The working directory is important -- when agents execute tasks for this project, they will use this path as their current directory. Make sure the folder exists.

### Step 5: Open the Dashboard

With the project created, Alex heads to the Dashboard to start creating tasks. The Dashboard is the main task management view, offering both kanban and table layouts.

![Dashboard showing the kanban board with task columns](../screengrabs/dashboard-list.png)

1. Click **Dashboard** in the sidebar under the **Work** group
2. Review the kanban board layout with columns for each task status (Planned, In Progress, Completed, etc.)
3. Toggle between **Board** and **Table** views using the view switcher in the header

> **Tip:** The kanban board gives a visual overview of task progress. Drag tasks between columns to update their status.

### Step 6: Create a Task

Alex creates the first task for the portfolio project. Tasks are the atomic units of work that agents can execute.

![Task creation form with details filled in](../screengrabs/dashboard-create-form-filled.png)

1. Click the **Create Task** button
2. Enter a **Title** such as "Set up Next.js project with Tailwind CSS"
3. Write a **Description** with enough context for an AI agent: "Initialize a new Next.js 15 project with TypeScript, Tailwind CSS v4, and the app router. Include a basic layout component and home page."
4. Assign the task to the **Portfolio Website** project using the project dropdown
5. Set **Priority** to High and **Status** to Planned

> **Tip:** The more specific your task description, the better the AI agent will perform. Include technical requirements, constraints, and expected outcomes.

### Step 7: Use AI Assist for Task Refinement

Alex discovers the AI Assist feature, which helps refine task descriptions with agent-ready detail. This is one of Stagent's standout features for solo developers who want to move fast.

![AI Assist button and generated suggestions](../screengrabs/dashboard-create-form-ai-assist.png)

1. On the task creation form, click the **AI Assist** button
2. Review the AI-generated suggestions for improving the task description
3. The assistant may add acceptance criteria, break down subtasks, or clarify ambiguous requirements
4. Click **Apply** to merge the suggestions into your task description
5. Review the updated description and adjust as needed before saving

> **Tip:** AI Assist works best when you provide a clear initial description. It enhances rather than replaces your intent -- think of it as a pair-programming partner for task planning.

### Step 8: Review Task Details

After creating the task, Alex opens the detail view to verify everything looks right before execution.

![Task detail view showing full task information](../screengrabs/journey-task-detail.png)

1. Click on the task card in the kanban board to open the **Detail Pane**
2. Review the **Description**, **Priority**, **Status**, and **Project** assignment
3. Check the **Agent Profile** assignment (defaults to General if not set)
4. Note the **Created** timestamp and task ID for reference

> **Tip:** The detail pane slides in from the right without leaving the dashboard. Press `Escape` to close it and return to the board view.

### Step 9: Explore the Kanban Board

With a few tasks created, Alex explores the kanban board to understand the workflow. The board provides a visual pipeline of task lifecycle stages.

![Dashboard kanban board with tasks in various columns](../screengrabs/dashboard-list.png)

1. Create 2-3 more tasks for the portfolio project (e.g., "Design hero section", "Implement blog with MDX", "Deploy to Vercel")
2. Observe how tasks appear in the **Planned** column by default
3. Click and drag a task to **In Progress** to simulate starting work
4. Use the **Filter** controls in the header to filter by project or priority

> **Tip:** The kanban board supports filtering by project, status, and priority. When you have many tasks, filters help you focus on what matters right now.

### Step 10: Return Home and Review Progress

Alex returns to the home screen to see how the workspace has changed after creating a project and several tasks.

![Home screen with updated activity](../screengrabs/home-list.png)

1. Click **Home** in the sidebar or press `Cmd+K` and type "Home"
2. Review the updated **activity feed** showing your recent project and task creation
3. Check the **quick stats** for task counts and project status
4. Celebrate -- you have set up your first governed AI agent workspace!

> **Tip:** Make it a habit to start each session from the home screen. It gives you an instant summary of what needs attention.

## What's Next

- [Work Use Guide](./work-use.md) -- Learn how to manage team projects, documents, and scheduled tasks
- [Power User Guide](./power-user.md) -- Build advanced workflows and autonomous agent loops
- [Developer Guide](./developer.md) -- Configure settings, authentication, and CLI tooling
