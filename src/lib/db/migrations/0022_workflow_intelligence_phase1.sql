-- Workflow Intelligence Stack — Phase 1 schema changes
-- Feature 1: Per-task budget cap storage
ALTER TABLE tasks ADD COLUMN max_budget_usd REAL;
-- Feature 2: Per-workflow runtime selection
ALTER TABLE workflows ADD COLUMN runtime_id TEXT;
