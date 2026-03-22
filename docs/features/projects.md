---
title: "Projects"
category: "feature-reference"
section: "projects"
route: "/projects"
tags: [projects, workspaces, tasks, working-directory, organization]
features: ["project-management", "detail-view-redesign"]
screengrabCount: 2
lastUpdated: "2026-03-21"
---

# Projects

Projects are workspaces that group related tasks, workflows, and documents under a shared context. Each project can specify a working directory, enabling agents to execute file-system-aware tasks within the correct folder on your machine.

## Screenshots

![Projects list view](../screengrabs/projects-list.png)
*Project cards showing name, status, and description for each workspace*

![Project detail view](../screengrabs/projects-detail.png)
*Project detail page with associated tasks, workflows, and documents*

## Key Features

### Project Workspaces
Each project acts as a container for related work. Tasks, workflows, and documents associated with a project share context, making it easy to organize complex initiatives with multiple agent activities.

### Project Cards
The project list displays cards with the project name, current status, and a brief description. Cards are interactive — click to navigate to the project detail page.

### Project Detail Page
The detail page shows everything associated with a project: its tasks (with status), linked workflows, and attached documents. This is your single-pane view of all activity within a project.

### Working Directory
Each project can specify a local file-system path as its working directory. When agents execute tasks for this project, they resolve file operations relative to this directory. This enables safe, scoped file access without giving agents free rein over your machine.

### Create Project Dialog
The creation dialog collects a project name, description, and optional working directory. Projects can be created empty and populated with tasks and documents later.

## How To

### Create a New Project
1. Navigate to `/projects` and click "New Project."
2. Enter a name and description for the project.
3. Optionally set a working directory (e.g., `/Users/you/code/my-repo`).
4. Click "Create" to add the project.

### View Project Details
1. Click any project card on the projects list page.
2. The detail page shows all associated tasks, workflows, and documents.
3. Click any linked item to navigate directly to its detail view.

### Associate Tasks with a Project
1. When creating or editing a task, select a project from the project dropdown.
2. The task will appear in the project's detail page under associated tasks.
3. The agent executing the task will use the project's working directory as its base path.

### Manage Project Status
1. Open the project detail page.
2. Update the project status as work progresses (e.g., Active, Completed, Archived).
3. Status changes are reflected on the project card in the list view.

## Related
- [Dashboard Kanban](./dashboard-kanban.md)
- [Workflows](./workflows.md)
- [Documents](./documents.md)
