---
title: Tables Agent Integration
status: completed
priority: P1
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-data-layer, tables-spreadsheet-editor]
---

# Tables Agent Integration

## Description

Enable ainative's agent primitives (tasks, workflows, schedules, chat) to create, read, query, and write table data programmatically. Adds agent tools for table operations, a table context builder for injecting table data into agent prompts, junction tables for linking tables to tasks/workflows/schedules, and a TablePickerSheet for user selection.

## User Story

As a user, I want to attach tables to tasks and workflows so that agents can read and update my structured data as part of their work — like populating a CRM tracker from research or updating a sprint board.

## Technical Approach

### Agent Tools

New file: `src/lib/chat/tools/table-tools.ts` — follows pattern of existing chat tools.

| Tool | Purpose | Input |
|------|---------|-------|
| `list_tables` | List tables, filter by project | projectId? |
| `get_table_schema` | Get column definitions | tableId |
| `query_table` | Filter/sort/paginate rows | tableId, filters[], sorting[], limit, offset |
| `aggregate_table` | COUNT, SUM, AVG, MIN, MAX | tableId, column, operation, filters? |
| `search_table` | Full-text search across text columns | tableId, query |
| `add_rows` | Batch insert (up to 100) | tableId, rows[] |
| `update_row` | Update by row ID | tableId, rowId, data |
| `delete_rows` | Delete by ID list | tableId, rowIds[] |
| `create_table` | Create from column schema | name, projectId, columns[] |
| `import_document_as_table` | Import CSV/XLSX | documentId, name?, projectId? |
| `list_table_templates` | Browse templates | category? |
| `create_table_from_template` | Clone template | templateId, name, projectId |

### Table Context Builder

New file: `src/lib/tables/context-builder.ts` — mirrors `src/lib/documents/context-builder.ts`.

- `buildTableContext(taskId)` — queries task_table_inputs, formats table schema + sample rows (first 20) as markdown
- `buildWorkflowTableContext(parentTaskId)` — parent task's tables available to children
- `buildPoolTableContext(workflowId, stepId)` — workflow_table_inputs for step

Context format:
```
[Table: Customer Tracker (142 rows)]
Columns: name (text), email (email), status (select: active/churned), mrr (number)
Sample data (first 5 rows):
| name | email | status | mrr |
| Acme Corp | info@acme.com | active | $12,400 |
...
Use the query_table tool for filtered access.
```

### Junction Tables

Already defined in tables-data-layer:
- `task_table_inputs` — links tables to tasks
- `workflow_table_inputs` — links tables to workflow steps (with optional stepId)
- `schedule_table_inputs` — links tables to schedules

### TablePickerSheet

New file: `src/components/tables/table-picker-sheet.tsx` — mirrors DocumentPickerSheet.

- Multi-select with checkbox interface
- Grouped by project
- Search by table name
- Shows column count, row count per table
- Used in: task detail, workflow step form, schedule form

### UI Indicators

- Rows created/modified by agents show Bot icon in row number cell
- Tooltip: "Created by [Profile Name] via [Task Title]"
- Table list shows "Agent" source badge for agent-created tables
- Agent-modified cells since last user visit get subtle left-border indicator (2px border-primary/30)

### Integration with Existing Agents

1. **claude-agent.ts** — extend `buildTaskQueryContext()` to call `buildTableContext(taskId)`
2. **workflow engine.ts** — extend `executeChildTask()` to call `buildWorkflowTableContext()` and `buildPoolTableContext()`
3. **Chat tools registry** — register table tools alongside document tools
4. **Task detail page** — add "Tables" section with TablePickerSheet
5. **Workflow form** — add table picker per step alongside document picker
6. **Schedule form** — add table picker alongside document picker

## Acceptance Criteria

- [ ] All 12 agent tools defined and registered in chat tool registry
- [ ] query_table supports all filter operators (eq, neq, gt, gte, lt, lte, contains, in, etc.)
- [ ] aggregate_table returns correct results for COUNT, SUM, AVG, MIN, MAX
- [ ] add_rows validates data against column schema, rejects invalid rows
- [ ] Table context injected into agent system prompt when task has linked tables
- [ ] Workflow steps receive parent task's tables + pool tables
- [ ] TablePickerSheet allows multi-select with project grouping
- [ ] Task detail page shows "Tables" section with picker
- [ ] Workflow step form has table picker alongside document picker
- [ ] Agent-created rows tracked with created_by = "agent:{profileId}"
- [ ] Agent-modified rows show Bot icon indicator in spreadsheet view
- [ ] create_table and create_table_from_template work from chat context

## Scope Boundaries

**Included:**
- 12 agent tools for full table CRUD + query
- Table context builder (task, workflow parent, workflow pool)
- TablePickerSheet component
- Integration with claude-agent.ts, workflow engine, chat tools
- Agent attribution on rows

**Excluded:**
- Natural language query translation (see tables-chat-queries)
- Chart generation from agent (see tables-agent-charts)
- Trigger-based automation (see tables-workflow-triggers)
- Real-time notification when agent modifies table

## References

- Pattern: `src/lib/chat/tools/` — existing chat tool definitions
- Pattern: `src/lib/documents/context-builder.ts` — context builder pattern
- Pattern: `src/components/shared/document-picker-sheet.tsx` — picker pattern
- Pattern: `src/lib/agents/claude-agent.ts` lines 342-411 — buildTaskQueryContext
- Pattern: `src/lib/workflows/engine.ts` lines 720-797 — executeChildTask document injection
