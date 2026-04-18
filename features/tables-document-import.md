---
title: Tables Document Import
status: completed
priority: P0
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-data-layer, tables-spreadsheet-editor]
---

# Tables Document Import

## Description

Import tabular data from existing documents (CSV, XLSX, TSV) into user tables via a multi-step wizard. Integrates with the existing DocumentPickerSheet for file selection, adds server-side structured data extraction (reusing ExcelJS), column type auto-detection, and a column mapping UI for user confirmation before import.

The import can create a new table or append to an existing one. Each import is tracked in `user_table_imports` for audit purposes, including error details for skipped rows.

## User Story

As a user, I want to import data from a CSV or spreadsheet document into a table so that I can work with my existing data in ainative's structured table format without manual re-entry.

## Technical Approach

### Import Flow (4 steps)

1. **Select document** — DocumentPickerSheet filtered to tabular mime types (text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/tab-separated-values)
2. **Preview + detect** — Server extracts structured rows via ExcelJS, auto-detects column types from first N rows
3. **Map columns** — User reviews/edits column names, types, and can skip columns. For existing tables: map source columns to target columns
4. **Confirm + import** — Batch insert with progress, error reporting for skipped rows

### Components

- `src/components/tables/table-import-wizard.tsx` — Multi-step Sheet wizard
  - Step 1: DocumentPickerSheet integration (filtered by mime type)
  - Step 2: Preview table (first 10 rows) + auto-detected schema
  - Step 3: Column mapping (rename, change type, skip, map to existing)
  - Step 4: Import progress + results summary
- `src/app/api/tables/[id]/import/route.ts` — POST endpoint for import execution

### Server-side Import Logic

- `src/lib/tables/import.ts` — import module
  - `extractStructuredData(documentId)` — re-reads source file via ExcelJS (not extractedText), returns headers + rows
  - `inferColumnTypes(headers, sampleRows)` — detects types from value patterns:
    - Numbers: parse as float/int, detect currency ($), percent (%)
    - Dates: common date formats (ISO, US, EU)
    - Emails: regex pattern
    - URLs: http/https prefix
    - Booleans: true/false, yes/no, 1/0
    - Default: text
  - `importRows(tableId, rows, columnMapping)` — batch insert with validation
    - Coerce types (string "42" → number 42, strip "$" from currency)
    - Skip rows that fail validation, record errors
    - Update row_count on completion
  - `createImportRecord(tableId, documentId, mapping, stats)` — audit trail

### Type Inference Rules

| Pattern | Detected Type | Config |
|---------|--------------|--------|
| All numeric (with optional $, %, commas) | number | format: currency/percent/decimal |
| ISO/US/EU date patterns | date | includeTime based on time presence |
| email@domain.tld | email | — |
| http(s)://... | url | — |
| true/false/yes/no/1/0 (consistent) | boolean | — |
| Small set of repeated values (< 10 unique, > 50% rows) | select | options from unique values |
| Everything else | text | — |

### Integration Points

- Reuses `DocumentPickerSheet` from `src/components/shared/document-picker-sheet.tsx` with mime type filter
- Reuses ExcelJS from `src/lib/documents/processors/spreadsheet.ts` for file parsing
- Creates `table_document_inputs` junction record linking document to table
- Accessible from: table list page ("Import" button), table detail page toolbar ("Import" button)

## Acceptance Criteria

- [ ] "Import" button available on table list page and table detail toolbar
- [ ] DocumentPickerSheet opens filtered to CSV/XLSX/TSV files only
- [ ] Server extracts structured rows from selected document (not just extractedText)
- [ ] Preview shows first 10 rows with auto-detected column types
- [ ] Column mapping UI allows: rename columns, change detected type, skip columns
- [ ] For existing tables: map source columns to existing target columns
- [ ] Import creates new table or appends rows to existing table
- [ ] Type coercion: strips currency symbols, parses dates, converts booleans
- [ ] Rows failing validation are skipped with error details preserved
- [ ] Import progress shown during batch insert
- [ ] Results summary: N rows imported, N rows skipped, link to open table
- [ ] Import audit record created in user_table_imports
- [ ] Document linked via table_document_inputs junction
- [ ] Large files (1000+ rows) import without timeout (batch insert in chunks of 100)

## Scope Boundaries

**Included:**
- CSV, XLSX, TSV import
- Column type auto-detection
- Column mapping UI
- Import into new table or append to existing
- Error reporting for skipped rows
- Audit trail

**Excluded:**
- Import from external APIs (deferred to P3)
- Import from JSON documents
- Scheduled/recurring imports
- Conflict resolution for duplicate rows

## References

- Pattern: `src/lib/documents/processors/spreadsheet.ts` — ExcelJS usage
- Pattern: `src/components/shared/document-picker-sheet.tsx` — picker UX
- Related: tables-data-layer (foundation)
- Related: tables-spreadsheet-editor (destination UI)
