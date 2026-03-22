---
title: "Personal Use Guide"
category: "user-journey"
persona: "personal"
difficulty: "beginner"
estimatedTime: "28 minutes"
sections: ["home-workspace", "dashboard-kanban", "projects", "chat", "playbook"]
tags: ["beginner", "solo", "tasks", "kanban", "chat", "playbook"]
lastUpdated: "2026-03-22"
---

# Personal Use Guide

Meet Alex, a solo developer who just discovered Stagent. Alex has a side project -- a personal portfolio website -- that needs planning and execution help, but has never used an AI agent workspace before. Over the next 28 minutes, Alex will explore the workspace, chat with AI, create a project, manage tasks on a kanban board, and discover the built-in documentation hub. By the end, Alex will have a fully organized project ready for AI-assisted execution.

## Prerequisites

- Stagent installed and running locally (`npm run dev`)
- A browser pointed at `http://localhost:3000`
- A project idea in mind (we will use a "Portfolio Website" as our example)

## Journey Steps

### Step 1: Explore the Home Page

Alex opens Stagent for the first time. The home page greets with a sidebar on the left showing every section of the workspace -- Work, Manage, and Configure groups -- and the main content area displays an activity overview with navigation cards for quick access to key features.

![Home page with sidebar expanded showing navigation and activity overview](../screengrabs/home-list.png)

1. Open Stagent at `http://localhost:3000` to land on the home page
2. Scan the **sidebar** on the left -- notice the three groups: Work (Dashboard, Projects, Chat), Manage (Workflows, Documents, Schedules), and Configure (Settings, Environment)
3. Review the **navigation cards** in the main area that provide shortcuts to frequently used sections
4. Note the **activity feed** showing recent workspace events -- it will be sparse on a fresh install, but will fill up as you work

> **Tip:** The sidebar stays visible across every page. It is your primary way to move between sections. You can collapse it for more screen space by clicking the toggle at the top.

### Step 2: Discover Below-the-Fold Content

Alex scrolls down the home page and discovers additional context -- workspace statistics, recent task activity, and summary metrics. This below-the-fold section gives a quick health check of the entire workspace without navigating away.

![Home page scrolled down showing stats and recent activity](../screengrabs/home-below-fold.png)

1. Scroll down past the navigation cards on the home page
2. Review the **workspace statistics** section showing task counts, project summaries, and completion rates
3. Check the **recent activity** timeline for the latest actions across all projects
4. Use these metrics as a daily check-in point to understand what needs attention

> **Tip:** The home page is designed as a morning dashboard. Start each session here to get an instant summary of your workspace before diving into specific tasks.

### Step 3: Navigate with the Command Palette

Before diving deeper, Alex learns the fastest way to get around Stagent -- the Command Palette. One keyboard shortcut opens a search overlay that can jump to any page, project, or task in the workspace.

![Command palette overlay showing search results](../screengrabs/command-palette-search.png)

1. Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to open the Command Palette
2. Start typing a keyword like "dashboard" or "projects" to filter results
3. Use **arrow keys** to highlight a result, then press **Enter** to navigate there
4. Press **Escape** to dismiss the palette without selecting anything

> **Tip:** The Command Palette searches across pages, projects, tasks, and workflows. As your workspace grows with more content, this becomes the fastest way to find anything. Memorize Cmd+K -- you will use it constantly.

### Step 4: Ask AI a Quick Question via Chat

Before setting up a formal project, Alex tries the Chat feature to brainstorm ideas. Chat provides a conversational interface with AI -- no tasks or projects required. It is a great starting point for exploring ideas before committing to structured work.

![Chat empty state with suggested prompt categories and conversation sidebar](../screengrabs/chat-list.png)

1. Click **Chat** in the sidebar under the **Work** group
2. Notice the **empty state** with a welcoming hero heading and suggested prompt categories
3. Browse the **suggested prompt tabs** -- they offer pre-built conversation starters organized by topic (Explore, Create, Analyze, etc.)
4. Type a question like "What pages should a developer portfolio website include?" and press Enter
5. Review the AI response and notice any **Quick Access pills** that link to related entities

> **Tip:** Chat is perfect for quick brainstorming sessions. You do not need to create a project first -- just ask a question. The conversation history stays in the sidebar so you can return to it later.

### Step 5: Create a New Project

Inspired by the chat brainstorm, Alex decides to formalize the portfolio idea into a project. Projects in Stagent are containers that group related tasks, documents, and agent activity together.

![Projects list view showing project cards](../screengrabs/projects-list.png)

1. Click **Projects** in the sidebar under the **Work** group
2. Review the projects list -- it may show existing projects or an empty state on a fresh install
3. Click the **Create Project** button in the top-right corner
4. Enter a **Project Name** such as "Portfolio Website"
5. Add a **Description**: "Personal developer portfolio with project showcase, blog, and contact form"
6. Click **Create** to save the project

> **Tip:** You can also reach the Projects page instantly by pressing Cmd+K and typing "projects." Give your project a clear, descriptive name -- it will appear throughout the workspace whenever you filter tasks or assign work.

### Step 6: Open the Dashboard Kanban Board

With a project created, Alex heads to the Dashboard to start organizing work. The Dashboard is the central task management hub, and it defaults to a kanban board view with columns for each task status.

![Dashboard kanban board with task cards organized across status columns](../screengrabs/dashboard-list.png)

1. Click **Dashboard** in the sidebar under the **Work** group
2. Review the kanban board layout with columns like **Planned**, **In Progress**, **Completed**, and others
3. Notice the **view controls** in the header area -- the board view is selected by default
4. If you have existing tasks, observe how they are sorted into columns by their current status

> **Tip:** The kanban board gives you a visual pipeline of your work. Each column represents a stage in the task lifecycle. At a glance, you can see what is planned, what is active, and what is done.

### Step 7: Switch to Table View

Alex discovers that the Dashboard supports multiple view modes. The table view offers a denser, spreadsheet-like layout that is useful when you want to scan many tasks at once or sort by specific columns.

![Dashboard table view with sortable columns and density options](../screengrabs/dashboard-table.png)

1. Click the **Table** view toggle in the Dashboard header to switch from kanban to table layout
2. Review the columns: title, status, priority, project, and other metadata
3. Click any **column header** to sort tasks by that field
4. Experiment with the **density controls** if available -- compact mode fits more rows on screen

> **Tip:** Table view shines when you have many tasks and need to quickly sort, scan, or compare them. Switch back to the board view anytime for the visual kanban layout. Both views show the same data -- pick whichever fits your current workflow.

### Step 8: Create a New Task

Alex switches back to the kanban board and creates the first task for the portfolio project. Tasks are the atomic units of work in Stagent -- each one represents a specific deliverable that can be tracked and, optionally, executed by an AI agent.

![Dashboard kanban board for creating a new task](../screengrabs/dashboard-list.png)

1. Click the **Create Task** button in the Dashboard header
2. Enter a **Title**: "Design hero section with intro and call-to-action"
3. Write a **Description** with enough detail to be useful: "Create a responsive hero section for the portfolio home page. Include a headline, short bio paragraph, a professional photo placeholder, and a primary CTA button linking to the projects section."
4. Assign the task to the **Portfolio Website** project using the project dropdown
5. Set **Priority** to High and leave **Status** as Planned
6. Click **Create** to add the task to the board

> **Tip:** Write task descriptions as if you are briefing a colleague. The more specific you are about requirements and expected outcomes, the more useful the task becomes -- both for your own reference and for AI agent execution later.

### Step 9: Quick-Edit a Task from the Kanban Board

After creating a few tasks, Alex realizes one needs a priority change. Instead of opening the full detail view, Alex uses the quick-edit dialog available directly from the kanban card. This saves time for small adjustments.

![Task edit dialog opened from a kanban card](../screengrabs/dashboard-card-edit.png)

1. Hover over a task card on the kanban board
2. Click the **edit icon** (pencil) that appears on the card
3. The **edit dialog** opens with the task fields pre-filled
4. Change the **Priority** from Medium to High, or update the title and description
5. Click **Save** to apply the changes -- the card updates immediately on the board

> **Tip:** Quick-edit is designed for fast adjustments without losing your place on the board. For deeper changes -- like reviewing agent logs or adding documents -- use the full detail view instead (see next step).

### Step 10: View Task Details

Alex clicks on a task card to open the full detail sheet. This sliding panel shows everything about a task: description, metadata, status history, and links to related items. It opens without leaving the Dashboard.

![Task detail sheet showing full task information](../screengrabs/dashboard-card-detail.png)

1. Click on any **task card** in the kanban board (not the edit icon -- the card itself)
2. The **detail sheet** slides in from the right side of the screen
3. Review the full **Description**, **Priority**, **Status**, **Project** assignment, and timestamps
4. Check the **Agent Profile** field -- this determines which AI behavior profile handles the task when executed
5. Press **Escape** or click outside the sheet to close it and return to the board

> **Tip:** The detail sheet is your go-to view for reviewing task context before execution. It keeps the board visible in the background, so you can quickly close the sheet and move to another card without any page navigation.

### Step 11: Track Progress on the Dashboard

With several tasks created and organized, Alex returns to the kanban board to see the big picture. The board now reflects actual project progress -- tasks spread across columns show what is planned, in flight, and completed.

![Dashboard kanban board with tasks across multiple columns](../screengrabs/dashboard-list.png)

1. Return to the **Dashboard** kanban board view if not already there
2. Review tasks across the status columns -- **Planned**, **In Progress**, **Completed**
3. Drag a task card from **Planned** to **In Progress** to simulate starting work on it
4. Use the **filter controls** in the header to narrow the view to just the Portfolio Website project
5. Notice how the column counts update as tasks move through the pipeline

> **Tip:** Make the kanban board your daily work surface. A quick scan of the columns tells you exactly where your project stands. Move cards between columns as you make progress -- this keeps your workspace honest and up to date.

### Step 12: Browse the Playbook

Alex discovers the Playbook section -- a built-in documentation hub that ships with Stagent. It contains guides, reference articles, and best practices for getting the most out of the workspace.

![Playbook documentation hub with article cards](../screengrabs/playbook-list.png)

1. Click **Playbook** in the sidebar under the **Manage** group
2. Browse the **article cards** -- each one covers a specific topic like task management, agent profiles, or workflow creation
3. Click any article card to read the full content
4. Use the Playbook as a reference whenever you encounter an unfamiliar feature or want to learn a new workflow

> **Tip:** The Playbook is especially useful when you are getting started. Before diving into advanced features like workflows or agent execution, skim the relevant Playbook articles. They are written in plain language and include practical examples.

### Step 13: Check the Home Dashboard

After a productive session, Alex returns to the home page to see how the workspace summary has changed. The home dashboard now reflects the project, tasks, and activity created during this journey.

![Home page showing updated workspace activity and statistics](../screengrabs/home-list.png)

1. Click **Home** in the sidebar or press **Cmd+K** and type "home"
2. Review the **activity feed** -- it now shows the project creation and task activity from this session
3. Check the **workspace statistics** for updated task counts and project status
4. Use this view as a daily starting point to decide what to work on next

> **Tip:** Bookmarking the home page as your browser start page for Stagent is a good habit. It gives you an instant summary every time you open the app, so you always know where you left off.

### Step 14: What's Next

Alex now has a solid foundation: a project, organized tasks on a kanban board, and familiarity with the core workspace features. Here is where to go from here:

- **[Work Use Guide](./work-use.md)** -- Scale up to team projects with documents, workflows, and scheduled tasks
- **[Power User Guide](./power-user.md)** -- Unlock advanced features like autonomous agent loops, multi-agent swarms, and workflow blueprints
- **[Developer Guide](./developer.md)** -- Configure settings, authentication, environment, and CLI tooling

The Work Use Guide is the natural next step. It builds on everything covered here and introduces collaboration-oriented features like document management, workflow automation, and cost tracking -- all the tools Alex will need as the portfolio project grows beyond a solo effort.
