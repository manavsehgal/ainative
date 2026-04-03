---
title: Tables Spreadsheet Editor
status: completed
priority: P0
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-data-layer]
---

# Tables Spreadsheet Editor

## Description

The core table editing experience at `/tables/[id]` — a spreadsheet-like grid with inline cell editing, type-aware controls, keyboard navigation, and optimistic saves. This is the primary surface users interact with when working with table data. Uses a custom grid built on @tanstack/react-table (extending the existing DataTable pattern) with cell-level edit controls.

The editor renders columns with type-appropriate formatting (currency for numbers, badges for selects, checkboxes for booleans) and provides inline editing with type-specific controls (Input, DatePicker, Select, Checkbox). Changes are optimistically applied and debounce-saved to the API.

## User Story

As a user, I want to view and edit table data in a familiar spreadsheet interface with keyboard navigation so that I can work with structured data as naturally as in Excel or Google Sheets.

## Technical Approach

### Route: `/tables/[id]`

- `src/app/tables/[id]/page.tsx` — Server Component, loads table metadata + first page of rows
- Passes to client component with `tableId`, `tableName`, `columns`, `initialRows`, `totalRows`, `projectId`

### Core Components

**`src/components/tables/table-spreadsheet.tsx`** — Main spreadsheet orchestrator
- State: rows[], editingCell {rowId, colName} | null, editValue, pendingSaves Map
- Uses @tanstack/react-table for column management, sorting, selection
- Custom cell rendering layer on top of DataTable for inline editing
- Toolbar: + Column, + Row, Import, Filter, Views

**`src/components/tables/table-cell-editor.tsx`** — Cell editor factory
Returns type-appropriate edit control based on column dataType:
- `text` / `url` / `email` → Input with type validation
- `number` → Input type="number" with format-aware display (currency, percent)
- `boolean` → Checkbox (no edit mode needed — toggles directly)
- `date` → DatePicker or Input type="date"
- `select` → Select dropdown with column config options
- `relation` → Combobox searching related table rows (deferred to tables-cross-joins)
- `computed` → Read-only display with formula indicator

**`src/components/tables/table-column-header.tsx`** — Column header with:
- Type icon (Text, Hash, Calendar, CheckSquare, List, Link, Mail, Sparkles for computed)
- Column name
- Sort indicator (asc/desc/none)
- Chevron → context menu: Rename, Change Type, Sort Asc/Desc, Insert Left/Right, Hide, Delete

**`src/components/tables/table-column-sheet.tsx`** — Sheet form for add/edit column
- Fields: name, display name, data type selector, required toggle
- Type-specific config: select options builder, number format, date options
- Position selector (before/after which column)

### Interaction Model

**Cell editing:**
1. Click cell → cell enters edit mode (input replaces display text)
2. Type value → optimistic update to local state
3. Tab → confirm + move to next cell in row
4. Enter → confirm + move to cell below
5. Escape → cancel edit, revert to previous value
6. Click outside → confirm edit
7. After confirm: debounced PATCH to `/api/tables/[id]/rows/[rowId]` (300ms)

**Keyboard navigation:**
- Arrow keys move between cells (when not editing)
- Enter starts editing current cell
- F2 also starts editing (Excel convention)
- Delete/Backspace clears cell value

**Row operations:**
- "+ Add Row" button at bottom appends empty row via POST
- Row checkbox for multi-select
- Bulk actions on selection: Delete, Duplicate
- Right-click row → context menu: Edit, Duplicate, Delete, Insert Above/Below

**Column operations:**
- "+" button at end of header row opens column sheet
- Column header context menu for rename/type/sort/delete
- Drag column headers to reorder (stretch goal)

### Data Flow

```
User edits cell
  → local state update (instant)
  → 300ms debounce
  → PATCH /api/tables/[id]/rows/[rowId] { data: { columnName: newValue } }
  → on success: update row_count if new row
  → on failure: revert local state, show toast error
```

### Layout (ASCII)

```
PageShell (backHref="/tables", title=tableName, actions=[Import, ...])
  └── TableSpreadsheet
        ├── Toolbar
        │     ├── [+ Column] [+ Row]
        │     ├── [Import] [Filter ▾] [Views ▾]
        │     └── Row count indicator
        ├── Grid
        │     ├── Header row (column headers with type icons)
        │     ├── Data rows (inline editable cells)
        │     ├── Summary row (aggregates for number columns)
        │     └── Add Row button
        └── TableColumnSheet (overlay for add/edit column)
```

## Acceptance Criteria

- [ ] `/tables/[id]` renders spreadsheet grid with all columns and rows
- [ ] Column headers show type icon, name, and sort indicator
- [ ] Click cell enters edit mode with type-appropriate control
- [ ] Keyboard nav: Tab (next cell), Enter (confirm + down), Escape (cancel), Arrows (move)
- [ ] Optimistic updates — cell value changes instantly, saves debounce at 300ms
- [ ] Failed saves revert cell value and show error toast
- [ ] Add column via header "+" button opens column sheet
- [ ] Column context menu: rename, change type, sort asc/desc, insert left/right, delete
- [ ] Add row via bottom "+" button, row appears immediately
- [ ] Delete rows via checkbox selection + bulk delete
- [ ] Number columns display with format (currency: $1,234.00, percent: 45%)
- [ ] Select columns render as colored badges matching option colors
- [ ] Boolean columns render as checkboxes that toggle directly
- [ ] Date columns format as locale-appropriate dates
- [ ] URL columns render as clickable links
- [ ] Empty table (columns but no rows) shows "Add your first row" CTA
- [ ] Back button navigates to /tables
- [ ] Page title is editable (click to rename table)

## Scope Boundaries

**Included:**
- Spreadsheet grid with inline editing
- All 8 basic column types (text, number, boolean, date, select, url, email + computed read-only)
- Keyboard navigation
- Column add/edit/delete/reorder
- Row add/delete/duplicate
- Optimistic saves with debouncing

**Excluded:**
- Computed column formula evaluation (see tables-computed-columns)
- Relation column combobox (see tables-cross-joins)
- Import wizard (see tables-document-import)
- Chart generation (see tables-agent-charts)
- Column drag-to-reorder (stretch goal, can add later)
- Undo/redo (see tables-versioning)

## References

- Pattern: `src/components/data-table/data-table.tsx` — base table infrastructure
- Pattern: `src/components/data-table/data-table-column-header.tsx` — sortable headers
- Pattern: `src/components/documents/document-detail-sheet.tsx` — Sheet overlay
- Library: @tanstack/react-table (already installed)
