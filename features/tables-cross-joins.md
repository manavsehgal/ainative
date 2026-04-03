---
title: Tables Cross-Table Joins
status: completed
priority: P2
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-computed-columns]
---

# Tables Cross-Table Joins

## Description

Enable relationships between user tables and create joined views that combine data from multiple tables. Users can define one-to-one, one-to-many, and many-to-many relationships, then create read-only virtual views that display joined data. Relation columns in the spreadsheet editor become comboboxes that search the related table.

## User Story

As a user, I want to link my Customers table to my Orders table so that I can see customer details alongside order data and look up related records inline.

## Technical Approach

### Relationship Definition

Uses `user_table_relationships` table (already in schema):
- from_table_id + from_column_name → to_table_id + to_column_name
- relationship_type: one_to_one, one_to_many, many_to_many
- config JSON: display columns for lookups

### Relation Columns

Column type `relation` stores related row IDs:
- One-to-one/many-to-one: single UUID string in row data
- Many-to-many: JSON array of UUID strings

### Relation Combobox

In spreadsheet editor, relation columns render as:
- Display: target row's display column value (e.g., customer name)
- Edit: Combobox that searches related table rows, shows display column
- Multiple: tag-style multi-select for many-to-many

### Joined Views

- "New View" button on table detail → join builder
- Visual join builder: select table A, table B, join column, join type (inner/left/right)
- Saved as `user_table_views` with join definition in config JSON
- Rendered as read-only DataTable with columns from both tables
- Resolution: two-step query (primary rows → batch fetch related rows)

## Acceptance Criteria

- [ ] Define relationship between two tables via column config or relationship builder
- [ ] Relation column renders as combobox searching target table
- [ ] Display value shows target's display column (not UUID)
- [ ] Many-to-many renders as tag-style multi-select
- [ ] Create joined view combining columns from two tables
- [ ] Join types: inner, left, right
- [ ] Joined view is read-only
- [ ] Broken references (deleted target rows) shown as "(deleted)" placeholder
- [ ] Relationship CRUD via API

## Scope Boundaries

**Included:**
- Relationship definition and CRUD
- Relation column combobox in spreadsheet
- Joined views (read-only)
- Broken reference detection

**Excluded:**
- Cascading deletes across relationships
- Graph visualization of table relationships
- Three-way joins

## References

- Related: tables-spreadsheet-editor (relation column rendering)
- Related: tables-computed-columns (cross-table formula extension point)
