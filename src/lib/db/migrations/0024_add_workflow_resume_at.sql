-- Workflow Step Delays — Track A.2
-- Adds resume_at timestamp column to workflows for schedule-based delay resumption.
-- When a workflow pauses at a delay step, it writes resume_at = now + delayDuration.
-- The scheduler tick queries WHERE status='paused' AND resume_at <= now() to find due workflows.
-- Partial index keeps the query cheap: only paused workflows with a pending resume are indexed.

ALTER TABLE workflows ADD COLUMN resume_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_workflows_resume_at
  ON workflows(resume_at)
  WHERE resume_at IS NOT NULL;
