---
title: Tables Versioning
status: completed
priority: P3
milestone: post-mvp
source: ideas/tables-brainstorm
dependencies: [tables-spreadsheet-editor]
---

# Tables Versioning

## Description

Row-level change history with the ability to view previous versions and rollback individual rows. Tracks who changed what and when, providing a full audit trail for both user and agent modifications.

## User Story

As a user, I want to see the history of changes to my table rows and undo mistakes so that I can confidently edit data knowing I can always recover.

## Technical Approach

- New table `user_table_row_history`: row_id, table_id, previous_data JSON, changed_by, changed_at, change_type (update/delete)
- Trigger on row update/delete: snapshot previous state to history
- History panel in spreadsheet (slide-out showing timeline per row)
- Rollback action: restore previous_data to current row
- Diff view: highlight changed fields between versions

## Acceptance Criteria

- [ ] Row updates create history snapshot with previous data
- [ ] Row deletes create history snapshot
- [ ] History panel shows timeline per row with who/when/what
- [ ] Diff view highlights changed fields
- [ ] Rollback restores row to selected previous version
- [ ] History tracks both user and agent modifications
- [ ] History retention configurable (default: 30 days)

## Scope Boundaries

**Included:** Row-level history, diff view, rollback, retention policy
**Excluded:** Column schema versioning, table-level snapshots, branching/merging

## References

- Pattern: `src/lib/agents/learned-context.ts` — versioning with changeType pattern
- Related: tables-spreadsheet-editor (history panel integration)
