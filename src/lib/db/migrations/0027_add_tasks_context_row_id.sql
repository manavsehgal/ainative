-- Add nullable context_row_id column to tasks for linking row-triggered tasks
-- back to their originating user_table_rows row. Engine population is deferred
-- to the row-trigger-blueprint-execution feature; for Phase 4 this column is
-- read by InboxKit's draft loader and seeded manually for smoke fixtures.
ALTER TABLE tasks ADD COLUMN context_row_id TEXT;
