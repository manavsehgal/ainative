---
title: Tables Computed Columns
status: completed
priority: P1
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-spreadsheet-editor]
---

# Tables Computed Columns

## Description

Add support for computed columns that derive their value from formulas referencing other columns. Formulas use `{{column_name}}` placeholder syntax and support arithmetic, text concatenation, date differences, conditionals, and aggregates. Values are computed at read time (not stored), ensuring they always reflect current data.

## User Story

As a user, I want to add computed columns with formulas (like total = price * quantity) so that I can derive values automatically without manual calculation.

## Technical Approach

### Formula Types

| Type | Example | Output |
|------|---------|--------|
| arithmetic | `{{price}} * {{quantity}}` | number |
| text_concat | `{{first_name}} {{last_name}}` | text |
| date_diff | `daysBetween({{due_date}}, today())` | number |
| conditional | `if({{status}} == "active", "Yes", "No")` | text |
| aggregate | `sum({{amount}})` | number (across all rows) |

### Implementation

- `src/lib/tables/formula-engine.ts` — safe AST-based expression evaluator
  - Parse formula string into abstract syntax tree (recursive descent parser)
  - Replace `{{column_name}}` with row values
  - Walk AST to evaluate with operator precedence
  - Built-in functions: sum, avg, min, max, count, daysBetween, today, concat, if
  - Dependency tracking: extract referenced column names for cycle detection
  - Cycle detection: topological sort of computed columns, reject circular refs
  - SECURITY: No code execution — pure AST interpretation with allowlisted operators and functions only

- Column type `computed` in column schema:
  ```typescript
  config: {
    formula: "{{price}} * {{quantity}}",
    formulaType: "arithmetic",
    resultType: "number",
    dependencies: ["price", "quantity"]
  }
  ```

- Computed values injected at query time (not stored in row data JSON)
- Client-side evaluation for instant preview in spreadsheet editor
- Server-side validation on column save

### UI Components

- Formula editor input with column name autocomplete (`{{` triggers dropdown)
- Formula preview showing evaluated result for first row
- Error display in cells when formula is invalid (red text, tooltip with error)
- Computed column header shows Sparkles icon
- Cells are read-only (no click-to-edit, greyed background)

## Acceptance Criteria

- [ ] Add computed column type to column sheet with formula editor
- [ ] `{{column_name}}` autocomplete when typing `{{` in formula field
- [ ] Arithmetic formulas evaluate correctly (+ - * / with operator precedence)
- [ ] Text concatenation with literal strings and column references
- [ ] Conditional: if(condition, then, else) syntax
- [ ] Built-in functions: sum, avg, min, max, count, daysBetween, today, concat
- [ ] Computed values display in spreadsheet cells (read-only, greyed)
- [ ] Values update when source columns change
- [ ] Circular dependency detection rejects cyclic formulas with clear error
- [ ] Invalid formulas show error in cell with tooltip
- [ ] Formula preview shows result for first row when editing
- [ ] Aggregate formulas (sum, avg) work across all rows in column
- [ ] Safe AST-based evaluator only — no arbitrary code execution

## Scope Boundaries

**Included:**
- 5 formula types (arithmetic, text_concat, date_diff, conditional, aggregate)
- Safe AST-based expression evaluator (recursive descent parser)
- Column autocomplete in formula editor
- Cycle detection
- Client-side instant preview + server-side validation

**Excluded:**
- Cross-table formulas (see tables-cross-joins)
- Cell-level formulas (only column-level)
- Custom user-defined functions
- Formula bar like Excel (just a Sheet form field)

## References

- Related: tables-spreadsheet-editor (rendering computed cells)
- Related: tables-cross-joins (cross-table formula extension)
