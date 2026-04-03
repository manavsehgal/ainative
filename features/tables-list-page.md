---
title: Tables List Page
status: completed
priority: P0
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-data-layer]
---

# Tables List Page

## Description

The main `/tables` route — a browsable list of all user-defined tables with filtering, search, and quick actions. Follows the established PageShell + DataTable + DetailPane pattern used by Documents, Workflows, and Schedules pages. Includes sidebar navigation, table creation via a Sheet form, and a link to the template gallery.

## User Story

As a user, I want to see all my tables in one place with search and filtering so that I can quickly find, open, or manage any table I've created.

## Technical Approach

### Route: `/tables`

- `src/app/tables/page.tsx` — Server Component (force-dynamic), fetches tables with project joins
- `src/app/tables/layout.tsx` — Standard layout if needed

### Components

- `src/components/tables/table-browser.tsx` — Client orchestrator managing search, filters, view mode, selection state. Mirrors `document-browser.tsx` pattern.
- `src/components/tables/table-detail-pane.tsx` — DetailPane content showing table metadata (column count, row count, project, source, description, quick actions: Open, Edit, Delete)
- `src/components/tables/table-create-sheet.tsx` — Sheet form (sm:max-w-lg) with fields: name, description, project selector, initial column builder (inline list with name + type selector + delete button, "Add Column" button)

### Layout (ASCII)

```
PageShell (title="Tables", actions=[Templates, + New])
  ├── FilterBar
  │     ├── Input (search by name)
  │     ├── Select (project filter)
  │     └── Select (source filter: manual/imported/agent/template)
  ├── DataTable
  │     └── Columns: Name, Project, Columns, Rows, Source, Updated
  ├── DetailPane (?detail=id)
  │     └── Metadata + quick actions
  ├── TableCreateSheet (triggered by "+ New")
  └── EmptyState (when no tables)
```

### Sidebar

Add "Tables" to Work group in `src/components/shared/app-sidebar.tsx` after "Documents", icon: `Table2` from lucide-react.

### DataTable Columns

| Column | Accessor | Width | Hidden On |
|--------|----------|-------|-----------|
| Name | name | flex | — |
| Project | projectName | 140 | mobile |
| Columns | columnCount | 80 | mobile |
| Rows | row_count | 80 | — |
| Source | source | 100 | tablet |
| Updated | updated_at | 120 | mobile |

### States

- **Empty:** EmptyState with Table2 icon, "No tables yet", description: "Create a table manually, import from a document, or start from a template", actions: [Create Table] [Browse Templates]
- **Loading:** Skeleton rows in DataTable
- **Error:** ErrorState with retry
- **Populated:** DataTable with sorting, row click opens DetailPane

## Acceptance Criteria

- [ ] `/tables` route renders with PageShell, FilterBar, DataTable
- [ ] "Tables" appears in sidebar Work group between Documents and Schedules
- [ ] Search filters tables by name (case-insensitive)
- [ ] Project filter shows all projects in a Select dropdown
- [ ] Source filter options: All, Manual, Imported, Agent, Template
- [ ] DataTable rows show name, project, column count, row count, source badge, relative updated time
- [ ] Row click opens DetailPane with metadata and quick actions (Open, Edit, Delete)
- [ ] "+ New" button opens TableCreateSheet
- [ ] Create sheet validates: name required, at least 1 column
- [ ] Initial column builder supports add/remove/rename columns with type selector
- [ ] "Templates" button navigates to `/tables/templates`
- [ ] EmptyState renders when no tables exist
- [ ] Bulk selection + bulk delete works

## Scope Boundaries

**Included:**
- /tables page with full list view
- Sidebar navigation entry
- Create table sheet with column builder
- DetailPane with metadata
- Filters (search, project, source)

**Excluded:**
- Spreadsheet editor (see tables-spreadsheet-editor)
- Import flow (see tables-document-import)
- Template gallery page (see tables-template-gallery)
- Grid/card view toggle (possible future enhancement)

## References

- Pattern: `src/app/documents/page.tsx` + `src/components/documents/document-browser.tsx`
- Pattern: `src/components/shared/page-shell.tsx`
- Pattern: `src/components/projects/project-form-sheet.tsx` — Sheet form pattern
- Pattern: `src/components/shared/app-sidebar.tsx` — sidebar nav structure
