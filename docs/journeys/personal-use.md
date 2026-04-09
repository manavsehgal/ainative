---
title: "Personal Use Guide"
category: "user-journey"
persona: "personal"
difficulty: "beginner"
estimatedTime: "30 minutes"
sections: ["home-workspace", "dashboard-kanban", "projects", "chat", "tables", "schedules", "user-guide", "book"]
tags: ["beginner", "solo", "tasks", "kanban", "chat", "tables", "schedules", "delivery-channels", "book"]
lastUpdated: "2026-04-08"
---

# Personal Use Guide

Meet Alex, a solo founder who just discovered Stagent. Alex has a side project -- a personal portfolio website -- that needs planning and execution help, but has never used an AI business operating system before. Over the next 30 minutes, Alex will explore the platform, chat with AI, create a project, manage tasks on a kanban board, set up a heartbeat schedule, and discover delivery channels for Telegram notifications. By the end, Alex will have a fully organized project with proactive AI monitoring.

## Prerequisites

- Stagent installed and running locally (`npm run dev`)
- A browser pointed at `http://localhost:3000`
- A project idea in mind (we will use a "Portfolio Website" as our example)

## Journey Steps

### Step 1: Explore the Home Page

Alex opens Stagent for the first time. The home page greets with a sidebar on the left showing every section of the workspace -- Work, Manage, Learn, and Configure groups -- and the main content area displays an activity overview with stat cards and a needs attention section.

![Home page with sidebar expanded showing navigation and activity overview](../screengrabs/home-list.png)

1. Open Stagent at `http://localhost:3000` to land on the home page
2. Scan the **sidebar** on the left -- notice the four groups: Work (Dashboard, Inbox, Chat, Projects, Workflows, Documents), Manage (Monitor, Profiles, Schedules, Cost & Usage), Learn (AI Native Book, User Guide), and Configure (Environment, Settings)
3. Review the **stat cards** showing active tasks, completed today, awaiting review, active projects, and active workflows
4. Note the **needs attention** section that will surface items requiring your input as agents run

> **Tip:** The sidebar stays visible across every page. It is your primary way to move between sections. You can collapse it for more screen space by clicking the toggle at the top.

### Step 2: Discover Below-the-Fold Content

Alex scrolls down the home page and discovers additional context -- recent projects, chart visualizations, and workspace signals.

![Home page scrolled down showing stats and recent activity](../screengrabs/home-below-fold.png)

1. Scroll down past the stat cards on the home page
2. Review the **recent projects** section and any chart visualizations
3. Use these metrics as a daily check-in point to understand what needs attention

> **Tip:** The home page is designed as a morning dashboard. Start each session here to get an instant summary of your workspace before diving into specific tasks.

### Step 3: Navigate with the Command Palette

Before diving deeper, Alex learns the fastest way to get around Stagent -- the Command Palette.

![Command palette overlay showing search results](../screengrabs/command-palette-search.png)

1. Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to open the Command Palette
2. Start typing a keyword like "dashboard" or "projects" to filter results
3. Use **arrow keys** to highlight a result, then press **Enter** to navigate there
4. Press **Escape** to dismiss the palette without selecting anything

> **Tip:** The Command Palette searches across pages, projects, tasks, and workflows. Memorize Cmd+K -- you will use it constantly.

### Step 4: Ask AI a Quick Question via Chat

Before setting up a formal project, Alex tries the Chat feature to brainstorm ideas.

![Chat empty state with suggested prompt categories and conversation sidebar](../screengrabs/chat-list.png)

1. Click **Chat** in the sidebar under the **Work** group
2. Notice the **Tool Catalog** with a welcoming hero heading and suggested prompt categories (Explore, Create, Debug, Automate)
3. Browse the **Smart Picks** row for personalized suggestions
4. Type a question like "What pages should a developer portfolio website include?" and press Enter
5. Review the AI response

> **Tip:** Chat is perfect for quick brainstorming sessions. You do not need to create a project first -- just ask a question. The conversation history stays in the sidebar so you can return to it later.

### Step 5: Create a New Project

Inspired by the chat brainstorm, Alex decides to formalize the portfolio idea into a project.

![Projects list view showing project cards](../screengrabs/projects-list.png)

1. Click **Projects** in the sidebar under the **Work** group
2. Click the **Create Project** button in the top-right corner
3. Enter a **Project Name** such as "Portfolio Website"
4. Add a **Description**: "Personal developer portfolio with project showcase, blog, and contact form"
5. Click **Create** to save the project

> **Tip:** Give your project a clear, descriptive name -- it will appear throughout the workspace whenever you filter tasks or assign work.

### Step 6: Open the Dashboard Kanban Board

With a project created, Alex heads to the Dashboard to start organizing work.

![Dashboard kanban board with task cards organized across status columns](../screengrabs/dashboard-list.png)

1. Click **Dashboard** in the sidebar under the **Work** group
2. Review the kanban board layout with columns like **Planned**, **In Progress**, **Completed**, and others
3. Notice the **view controls** in the header area -- the board view is selected by default

> **Tip:** The kanban board gives you a visual pipeline of your work. Each column represents a stage in the task lifecycle.

### Step 7: Switch to Table View

Alex discovers that the Dashboard supports multiple view modes.

![Dashboard table view with sortable columns and density options](../screengrabs/dashboard-table.png)

1. Click the **Table** view toggle in the Dashboard header to switch from kanban to table layout
2. Review the columns: title, status, priority, project, and other metadata
3. Click any **column header** to sort tasks by that field

> **Tip:** Table view shines when you have many tasks and need to quickly sort or compare them. Both views show the same data.

### Step 8: Create a New Task

Alex creates the first task for the portfolio project.

![Dashboard kanban board for creating a new task](../screengrabs/dashboard-list.png)

1. Click the **Create Task** button in the Dashboard header
2. Enter a **Title**: "Design hero section with intro and call-to-action"
3. Write a **Description** with detail about requirements
4. Assign the task to the **Portfolio Website** project
5. Set **Priority** to High and leave **Status** as Planned
6. Click **Create** to add the task to the board

> **Tip:** Write task descriptions as if you are briefing a colleague. The more specific you are, the better the AI agent results will be.

### Step 9: Quick-Edit a Task from the Kanban Board

Alex uses the quick-edit dialog for a fast priority change.

![Task edit dialog opened from a kanban card](../screengrabs/dashboard-card-edit.png)

1. Hover over a task card on the kanban board
2. Click the **edit icon** (pencil) that appears on the card
3. Change the **Priority** or update the title and description
4. Click **Save** to apply the changes

### Step 10: View Task Details

Alex clicks on a task card to open the full detail sheet.

![Task edit dialog opened from a kanban card](../screengrabs/dashboard-card-edit.png)

1. Click on any **task card** in the kanban board (not the edit icon -- the card itself)
2. The **detail sheet** slides in from the right side of the screen
3. Review the full **Description**, **Priority**, **Status**, **Project** assignment, and timestamps
4. Press **Escape** or click outside the sheet to close it

### Step 11: Track Content in a Table

Alex wants to keep a structured list of portfolio pages, their status, and target launch dates. A table is perfect for this kind of lightweight tracking.

![Tables list view showing structured data tables](../screengrabs/tables-list.png)

1. Click **Tables** in the sidebar under the **Work** group
2. Click **Create Table** and enter a name: "Portfolio Pages"
3. Add columns: **Page Name** (text), **Status** (select: Draft / In Progress / Done), **Target Date** (date)
4. Start adding rows directly in the inline spreadsheet editor -- type into cells just like a regular spreadsheet
5. Use the table to track which pages are done and which still need work

> **Tip:** Tables are great for any structured tracking that does not need a full project board. Content calendars, feature lists, contact directories -- anything you would put in a spreadsheet fits naturally here.

### Step 12: Set Up a Heartbeat Schedule

Alex wants Stagent to proactively check on the portfolio project every morning. A heartbeat schedule evaluates conditions before deciding whether to act -- it only creates tasks when something meaningful needs attention.

![Schedules list showing active and paused schedules](../screengrabs/schedules-list.png)

1. Click **Schedules** in the sidebar under the **Manage** group
2. Click **Create Schedule** and select type **Heartbeat**
3. Enter a **Name**: "Morning Portfolio Check"
4. Set the interval using natural language: "weekdays at 8am"
5. Add checklist items: "Are there any stale tasks older than 3 days?" and "Are there completed tasks that need review?"
6. Assign the Portfolio Website project and click **Create**

> **Tip:** Heartbeat schedules are smarter than clock-driven ones -- they suppress no-op runs. If your portfolio project has no stale tasks, the heartbeat stays quiet and costs nothing.

### Step 13: Connect Telegram for Notifications

Alex wants to receive schedule results on the go. Setting up a Telegram delivery channel takes less than two minutes.

![Settings page showing provider and runtime configuration](../screengrabs/settings-auth.png)

1. Open **Settings** from the sidebar under **Configure**
2. Scroll to the **Delivery Channels** section
3. Click **+ Add Channel** and select **Telegram**
4. Create a Telegram bot via @BotFather (send `/newbot`), copy the bot token
5. Get your Chat ID by messaging the bot and visiting the getUpdates URL
6. Enter the Bot Token and Chat ID, then click **Create Channel**
7. Click **Test** to verify -- you should see a test message in Telegram
8. Toggle **Chat** on to enable bidirectional mode -- now you can message Stagent from Telegram

> **Tip:** With Chat mode enabled, you can ask Stagent questions directly from Telegram. "What's the status of my portfolio project?" works just like the web chat.

### Step 14: Browse the User Guide

Alex discovers the built-in documentation hub.

![User Guide page with adoption tracker and journey cards](../screengrabs/user-guide-list.png)

1. Click **User Guide** in the sidebar under the **Learn** group
2. Browse the **feature adoption tracker** to see which areas you have explored
3. Check the **guided journeys** for your current skill level
4. Use the feature grid to discover areas you have not tried yet

### Step 15: Read the AI Native Book

Alex wants deeper context on how Stagent fits into the broader shift to AI-native work. The Living Book is built into the sidebar under the **Learn** group.

![AI Native Book — chapter list with reading progress](../screengrabs/book-list.png)

1. Click **AI Native Book** in the sidebar under the **Learn** group to open the chapter list
2. Scan the table of contents — chapters are organised from foundational concepts (From Hierarchy to Intelligence) through advanced topics (Autonomous Organization, The Road Ahead)
3. Pick a reading path that matches your current focus:
   - **Newcomer path** — start with the intro chapters on the AI-native blueprint and refinery
   - **Practitioner path** — jump straight to the chapters on workflow orchestration, scheduled intelligence, and human-in-the-loop
   - **Visionary path** — skip ahead to agent self-improvement, multi-agent swarms, and the governance layer
4. As you read, the book merges content updates on each upgrade — new chapters and revisions appear automatically when you pull the latest release, so the book stays in sync with the product
5. Reading progress persists per chapter, so you can dip in and out without losing your place

> **Tip:** The book treats every example project as a case study — when you see a workflow or schedule described in a chapter, try building the same thing in your own workspace to anchor the idea in muscle memory.

### Step 16: What's Next

Alex now has a solid foundation: a project, organized tasks on a kanban board, a heartbeat schedule for proactive monitoring, and Telegram notifications for staying connected on the go. Here is where to go from here:

- **[Work Use Guide](./work-use.md)** -- Scale up to team projects with documents, workflows, and multi-channel notifications
- **[Power User Guide](./power-user.md)** -- Unlock advanced features like Ollama local models, episodic memory, and NLP scheduling
- **[Developer Guide](./developer.md)** -- Configure settings, authentication, environment, and CLI tooling
