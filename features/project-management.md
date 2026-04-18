---
title: Project Management
status: completed
priority: P1
milestone: mvp
source: ideas/mvp-vision.md
dependencies: [database-schema, app-shell]
---

# Project Management

## Description

CRUD interface for creating, viewing, editing, and archiving projects. Projects are the top-level organizational unit — they group related tasks and workflows. The project list view lives at `/projects` and provides a card-based overview with status indicators, task counts, and quick actions.

This is a straightforward data management feature that establishes the CRUD patterns (API routes + Server Components) that other features follow.

## User Story

As a user, I want to create and manage projects so that I can organize my AI agent tasks into logical groups with clear status tracking.

## Technical Approach

- **API routes**: REST endpoints at `src/app/api/projects/` for CRUD operations
  - `GET /api/projects` — list all projects with task counts
  - `POST /api/projects` — create a new project
  - `GET /api/projects/[id]` — get project details
  - `PATCH /api/projects/[id]` — update project name, description, status
  - `DELETE /api/projects/[id]` — soft delete or archive
- **Server Components**: Project list page fetches directly from the database (no API call needed for initial render)
- **Client Components**: Create/edit dialogs use shadcn/ui Dialog, Form, Input components
- **Data model**: Uses `projects` table from database-schema (id, name, description, status, timestamps)
- **Project status**: `active` | `paused` | `completed`

### UI Components

- `ProjectCard` — displays project name, description, status badge, task count, last updated
- `ProjectCreateDialog` — form for name + description
- `ProjectEditDialog` — edit name, description, status
- Project list with filtering by status

## Acceptance Criteria

- [ ] Users can create a new project with name and optional description
- [ ] Projects page shows all projects as cards with status badges and task counts
- [ ] Users can edit project name, description, and status
- [ ] Users can archive/complete a project
- [ ] Project detail view shows associated tasks (placeholder list — full kanban is in `task-board`)
- [ ] API routes return proper status codes and error messages

## Scope Boundaries

**Included:**
- Project CRUD (create, read, update, archive)
- Project list view with cards
- Project detail view (basic)
- API routes for project operations
- Status management (active, paused, completed)

**Excluded:**
- Task management within projects (see `task-board`)
- Workflow management within projects (see `workflow-engine`)
- AI-guided project creation (see `task-definition-ai`)
- Project templates or duplication

## References

- Source: `ideas/mvp-vision.md` — Project & Task Definition section
- Source: `ideas/tech-stack-ainative.md` — Schema Design (projects table)
- Related features: `task-board` (tasks belong to projects), `database-schema` (provides the table)
