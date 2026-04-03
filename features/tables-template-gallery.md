---
title: Tables Template Gallery
status: completed
priority: P1
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-data-layer]
---

# Tables Template Gallery

## Description

A browsable gallery of pre-built table templates at `/tables/templates`, organized by category (Business, Personal, PM, Finance, Content). Users can preview a template's column definitions and sample data, then clone it into their workspace with optional customization. Includes 12 system templates and the ability to save any user table as a reusable template.

## User Story

As a user, I want to browse ready-made table templates so that I can quickly start with a proven structure for common use cases like CRM tracking, sprint boards, or budget management instead of building from scratch.

## Technical Approach

### Route: `/tables/templates`

- `src/app/tables/templates/page.tsx` — Server Component, fetches templates from API
- PageShell with backHref="/tables"

### Components

- `src/components/tables/table-template-gallery.tsx` — Client component with:
  - Search input (fuzzy match on name + description)
  - Category tabs: All, Business, Personal, PM, Finance, Content
  - Card grid: 3-col desktop, 2-col tablet, 1-col mobile
  - Each card: category icon, name (bold), 1-line description, column count badge, domain badge

- `src/components/tables/table-template-preview.tsx` — Sheet overlay (sm:max-w-lg):
  - Full description
  - Column definition list (name, type icon, required indicator)
  - Sample data mini-table (3-5 rows)
  - "Use This Template" button → transitions to clone form:
    - Table name (pre-filled from template)
    - Project selector
    - Column checkboxes (deselect unwanted)
    - "Include sample data" toggle
    - Create button

### Template Icons (lucide-react mapping)

| Category | Icon |
|----------|------|
| business | Building2 |
| personal | User |
| pm | KanbanSquare |
| finance | DollarSign |
| content | PenLine |

### Clone Flow

1. POST `/api/tables` with `{ templateId, name, projectId, includeColumns, includeSampleData }`
2. Server reads template's column_schema, filters to selected columns
3. Creates user_tables record with template_id set
4. Denormalizes to user_table_columns
5. If includeSampleData: inserts template's sample_data as initial rows
6. Redirects to `/tables/[newId]`

### "Save as Template" (User Templates)

- Action in table detail page toolbar: "Save as Template"
- Creates user_table_templates record with scope='user', copying current column_schema
- Optionally captures first 5 rows as sample_data
- User templates appear in gallery alongside system templates with "My Templates" filter

## Acceptance Criteria

- [ ] `/tables/templates` renders card grid with all 12 system templates
- [ ] Category tabs filter templates (All shows all, others filter by category)
- [ ] Search filters by name and description
- [ ] Card click opens preview Sheet with column definitions and sample data
- [ ] "Use This Template" transitions to clone form in same Sheet
- [ ] Clone creates table with selected columns and optional sample data
- [ ] Clone navigates to new table's spreadsheet editor
- [ ] Template name pre-fills but is editable
- [ ] Columns are deselectable (but at least 1 must remain)
- [ ] "Save as Template" on table detail creates user-scoped template
- [ ] User templates appear in gallery with "My Templates" filter
- [ ] "Templates" button on /tables page navigates to gallery

## Scope Boundaries

**Included:**
- Template gallery page with search + category tabs
- 12 system templates with sample data
- Preview + clone flow
- Save as template from existing table
- User-scoped templates

**Excluded:**
- Template marketplace/sharing
- Template versioning
- Multi-table template bundles (e.g., CRM suite with Contacts + Deals + Activities)

## References

- Pattern: `src/components/workflows/blueprint-gallery.tsx` — card gallery layout
- Pattern: `src/components/shared/document-picker-sheet.tsx` — Sheet preview + action flow
- Related: tables-data-layer (template schema and seeding)
