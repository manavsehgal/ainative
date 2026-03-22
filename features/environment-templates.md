---
title: Environment Templates
status: completed
priority: P2
milestone: post-mvp
source: ideas/environment-onboarding-plan.md
dependencies: [environment-sync-engine]
---

# Environment Templates

## Description

Save a project's complete CLI environment configuration as a reusable template, then apply it to new projects. This is the "create-react-app for AI agent configuration" — a user who has spent weeks perfecting their Claude Code setup for a React monorepo can capture that entire configuration and apply it to their next React project in one click.

Templates store snapshots of selected artifacts (skills, MCP servers, instructions, hooks, permissions, rules) from a source project. Applying a template uses the sync engine to write artifacts to the target project directory, with checkpoint safety.

## User Story

As a developer who maintains multiple similar projects, I want to save my well-tuned Claude Code + Codex configuration as a template and apply it to new projects instantly, so I don't have to manually copy and configure environment files for every new repo.

## Technical Approach

### Data Model

New table `environment_templates` in `src/lib/db/schema.ts`:
- id (TEXT PK), name (TEXT), description (TEXT), source_project_id (TEXT FK→projects, nullable), persona (TEXT), manifest (TEXT JSON — artifact snapshots with full content), artifact_count (INTEGER), created_at (INTEGER timestamp), updated_at (INTEGER timestamp)

The manifest JSON stores: `{ artifacts: [{ category, name, relPath, content, metadata }] }` — full content snapshots, not references to live files (templates are frozen-in-time).

### Template Operations

**`src/lib/environment/templates.ts`**:
- **`captureTemplate(name, description, scanId, artifactIds[])`** — Reads full content of selected artifacts from disk, stores as manifest JSON in the template. User selects which artifacts to include.
- **`applyTemplate(templateId, targetProjectId)`** — Reads manifest, translates each artifact into a sync operation, and delegates to the sync engine (which handles checkpointing). Adapts paths for the target project's workingDirectory.
- **`listTemplates()`** / **`getTemplate(id)`** / **`deleteTemplate(id)`**
- **`exportTemplate(id)`** — Serializes template as a self-contained JSON file for sharing
- **`importTemplate(jsonFile)`** — Imports a template from an exported JSON file

### API Routes

- **`GET /api/environment/templates`** — List all templates
- **`POST /api/environment/templates`** — Create template from selected artifacts
- **`GET /api/environment/templates/[id]`** — Template detail with manifest preview
- **`POST /api/environment/templates/[id]/apply`** — Apply to target project
- **`DELETE /api/environment/templates/[id]`** — Delete template
- **`GET /api/environment/templates/[id]/export`** — Download as JSON
- **`POST /api/environment/templates/import`** — Import from JSON

### UI Components

- **`template-library.tsx`** — Grid/list of saved templates with name, description, artifact count, persona badge, source project, "Apply" and "Delete" buttons
- **`template-capture-dialog.tsx`** — Multi-step dialog: select artifacts from current scan (checkboxes grouped by category) → name + describe → save. Shows preview of what will be captured.
- **`template-apply-wizard.tsx`** — Select target project → preview what will be written → confirm → apply. Shows diffs via sync preview.
- **`template-import-export.tsx`** — Import/export controls on the template library page

## Acceptance Criteria

- [ ] User can capture a template from selected artifacts in current project scan
- [ ] Template manifest stores full artifact content (not references)
- [ ] User can apply a template to a different project
- [ ] Template application uses sync engine with automatic checkpoint
- [ ] Template library shows all saved templates with metadata
- [ ] Templates can be exported as JSON files for sharing
- [ ] Templates can be imported from JSON files
- [ ] Apply wizard shows preview diffs before writing
- [ ] Template deletion works with confirmation
- [ ] Templates handle persona correctly (claude-only template warns if applied to codex-only project)

## Scope Boundaries

**Included:**
- Template capture, storage, application, deletion
- Import/export as JSON for sharing
- Preview before application
- Checkpoint safety via sync engine

**Excluded:**
- Template marketplace or cloud sharing (local only)
- Template versioning (capture creates a new snapshot each time)
- Template inheritance or composition (each template is standalone)
- Auto-updating templates when source project changes

## References

- Source: environment onboarding plan — Feature 7
- Dependency: environment-sync-engine (handles the actual write-back)
- Related features: environment-dashboard (capture CTA), cross-project-comparison (helps identify which templates to apply)
