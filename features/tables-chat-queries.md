---
title: Tables Chat Queries
status: completed
priority: P1
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-data-layer, tables-agent-integration]
---

# Tables Chat Queries

## Description

Enable natural language queries against user tables from the chat interface. Users can ask questions like "show me all customers added this week" or "what's the average deal value by stage", and the chat agent translates the question into a structured query, executes it, and renders results inline. Also supports creating tables from natural language descriptions.

## User Story

As a user, I want to ask questions about my tables in natural language through chat so that I can get insights without building complex filters manually.

## Technical Approach

### NL Query Engine

New file: `src/lib/tables/nl-query-engine.ts`

Flow:
1. Load target table's column_schema (names, types, select options)
2. Construct system prompt with schema context
3. LLM generates structured query JSON (not raw SQL) matching the query-builder format
4. Validate generated query against column_schema (reject hallucinated column names)
5. Execute via existing query-builder.ts
6. Format results as markdown table for chat display

System prompt template:
```
You have a table "{tableName}" with these columns:
- name (text, required)
- status (select, options: active/churned/lead)
- mrr (number, currency format)
- created_date (date)

Translate the user's question into a structured query. Return JSON only:
{ "filters": [...], "sorting": [...], "aggregation": {...}, "limit": N }
```

### Chat Integration

- `@table:TableName` mention syntax in chat input — triggers table context loading
- `/table` command in chat command popover with subcommands:
  - `/table list` — list all tables
  - `/table query "..."` — natural language query
  - `/table create "..."` — create table from description
- Table results render inline as collapsible formatted tables
- "Open in Tables" link button below results

### Inline Table Rendering

New component: `src/components/chat/chat-table-result.tsx`
- Renders query results as a compact table within chat messages
- Collapsible if > 10 rows (show first 5, expand to see all)
- Column headers with type icons
- Number formatting (currency, percent)
- "Open in Tables" and "Export" action buttons below

### "Create from Chat" Tool

Agent tool `create_table_from_description`:
- Input: natural language description ("a table to track job applications")
- LLM generates column schema from description
- Creates table via existing create_table tool
- Returns confirmation with table link

## Acceptance Criteria

- [ ] `@table:TableName` mention loads table context into chat
- [ ] `/table query "..."` translates NL to structured query and executes
- [ ] Query results render as inline formatted table in chat message
- [ ] Results are collapsible (expand/collapse for > 10 rows)
- [ ] "Open in Tables" link navigates to table spreadsheet view
- [ ] NL queries support: filtering, sorting, aggregation, date ranges
- [ ] Hallucinated column names rejected with helpful error ("column 'revenue' not found, did you mean 'mrr'?")
- [ ] `/table create "..."` generates column schema and creates table
- [ ] `/table list` shows all tables with row counts
- [ ] Number columns formatted correctly in inline results (currency, percent)
- [ ] Chat command popover shows `/table` with subcommand help

## Scope Boundaries

**Included:**
- NL-to-structured-query translation
- @table mention syntax
- /table command with list/query/create subcommands
- Inline table result rendering in chat
- Create table from NL description

**Excluded:**
- Chart generation from queries (see tables-agent-charts)
- Cross-table joins via NL (see tables-cross-joins)
- Streaming/real-time query results
- Query history/favorites

## References

- Pattern: `src/components/chat/chat-command-popover.tsx` — command registration
- Pattern: `src/lib/chat/tools/` — chat tool definitions
- Related: tables-agent-integration (base agent tools)
- Related: tables-data-layer (query-builder.ts)
