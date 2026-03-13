ALTER TABLE tasks ADD COLUMN workflow_id TEXT REFERENCES workflows(id);
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN schedule_id TEXT REFERENCES schedules(id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON tasks(workflow_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tasks_schedule_id ON tasks(schedule_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS usage_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT REFERENCES tasks(id),
  workflow_id TEXT REFERENCES workflows(id),
  schedule_id TEXT REFERENCES schedules(id),
  project_id TEXT REFERENCES projects(id),
  activity_type TEXT NOT NULL,
  runtime_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT,
  status TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_micros INTEGER,
  pricing_version TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_usage_ledger_task_id ON usage_ledger(task_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_usage_ledger_activity_type ON usage_ledger(activity_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_usage_ledger_runtime_id ON usage_ledger(runtime_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_usage_ledger_provider_model ON usage_ledger(provider_id, model_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_usage_ledger_finished_at ON usage_ledger(finished_at);
