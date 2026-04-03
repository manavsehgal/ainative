---
title: Tables Natural Language Creation
status: completed
priority: P3
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-chat-queries]
---

# Tables Natural Language Creation

## Description

Create complete tables from natural language descriptions. Users describe what they want ("a table to track my job applications with company, position, salary range, and status") and the agent generates an optimal column schema with appropriate types, creates the table, and optionally populates it with sample data.

## User Story

As a user, I want to describe a table in plain English and have it created for me so that I don't need to manually define columns and types.

## Technical Approach

- Enhance existing `create_table_from_description` chat tool
- LLM infers: column names, types, constraints, select options, computed columns
- Uses template library as reference for similar schemas
- Optional: "populate with 5 sample rows" flag
- Returns created table with link to open in editor

## Acceptance Criteria

- [ ] "Create a table for..." in chat generates column schema
- [ ] Schema inference includes appropriate types (not all text)
- [ ] Select columns get reasonable option sets
- [ ] Optional sample data generation
- [ ] Created table opens in spreadsheet editor

## Scope Boundaries

**Included:** NL-to-schema generation, sample data, chat integration
**Excluded:** Complex multi-table creation, schema refinement dialog

## References

- Related: tables-chat-queries (chat tool infrastructure)
- Related: tables-template-gallery (template matching for schema hints)
