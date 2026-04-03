---
title: Tables Export
status: completed
priority: P3
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-spreadsheet-editor]
---

# Tables Export

## Description

Export table data to common formats (CSV, XLSX, JSON) for use in external tools. Supports full table export and filtered export (only rows matching current view filters). Available from the spreadsheet editor toolbar and via agent tools.

## User Story

As a user, I want to export my table data to CSV or Excel so that I can share it with colleagues or import it into other tools.

## Technical Approach

- Export button in spreadsheet toolbar with format selector (CSV, XLSX, JSON)
- Server-side generation via API endpoint: GET `/api/tables/[id]/export?format=csv`
- XLSX generation via ExcelJS (already installed)
- CSV via simple string builder
- JSON as array of objects
- Respects current view filters if applied
- Agent tool: `export_table` for programmatic export

## Acceptance Criteria

- [ ] Export to CSV with proper escaping (commas, quotes, newlines)
- [ ] Export to XLSX with typed columns (numbers as numbers, dates as dates)
- [ ] Export to JSON as array of row objects
- [ ] Filtered export respects current view filters
- [ ] Download triggers via browser download API
- [ ] Agent tool returns file path for export

## Scope Boundaries

**Included:** CSV, XLSX, JSON export; filtered export; agent tool
**Excluded:** PDF export, scheduled exports, export to cloud storage

## References

- Pattern: `src/lib/documents/processors/spreadsheet.ts` — ExcelJS usage
- Related: tables-spreadsheet-editor (export trigger point)
