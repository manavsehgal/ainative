---
title: Tables Workflow Triggers
status: completed
priority: P2
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-agent-integration]
---

# Tables Workflow Triggers

## Description

Configure automated triggers that fire workflows or tasks when table data changes. Supports row insertion triggers and conditional triggers (e.g., "when status column changes to 'approved', run invoice workflow"). Enables event-driven automation on structured data.

## User Story

As a user, I want to set up a trigger so that when a new row is added to my "Leads" table, a research workflow automatically runs to enrich the lead data.

## Technical Approach

### Trigger Schema

New table `user_table_triggers` (extends the 12 tables from data-layer):
```
id TEXT PK, table_id FK→user_tables, name TEXT,
trigger_event TEXT (row_added | row_updated | row_deleted),
condition TEXT (JSON: column conditions, null = always fire),
action_type TEXT (run_workflow | create_task),
action_config TEXT (JSON: workflowId or task template),
status TEXT (active | paused), fire_count INTEGER DEFAULT 0,
last_fired_at INTEGER, created_at INTEGER, updated_at INTEGER
```

### Trigger Evaluation

On row insert/update via API routes:
1. Query active triggers for the table
2. Evaluate condition against row data (reuse query-builder filter logic)
3. For matching triggers: create task or start workflow with row data as context
4. Update fire_count and last_fired_at

### Condition Format

Same filter format as query_table:
```json
{
  "column": "status",
  "operator": "eq",
  "value": "approved"
}
```

### UI

- "Triggers" tab on table detail page
- Trigger configuration Sheet: event type, conditions, action (select workflow/task)
- Trigger list showing name, event, condition summary, status, fire count
- Enable/pause toggle per trigger

## Acceptance Criteria

- [ ] Create trigger with event type + conditions + action
- [ ] row_added trigger fires on new row insert
- [ ] row_updated trigger fires on row update (with optional column condition)
- [ ] Conditional triggers only fire when condition matches
- [ ] Trigger creates task or starts workflow with row data as context
- [ ] Trigger status: active/paused with toggle
- [ ] Fire count and last fired timestamp tracked
- [ ] Trigger configuration Sheet with event/condition/action
- [ ] Triggers tab on table detail page

## Scope Boundaries

**Included:**
- Row insert/update/delete triggers
- Conditional evaluation using filter syntax
- Workflow and task actions
- Trigger management UI

**Excluded:**
- Rate limiting / debouncing triggers
- Cross-table triggers
- Scheduled/batched trigger evaluation
- Webhook triggers (external)

## References

- Pattern: `src/lib/schedules/scheduler.ts` — event-driven execution pattern
- Related: tables-agent-integration (agent execution infrastructure)
- Related: tables-data-layer (row mutation API where triggers are evaluated)
