-- Workflow Intelligence Stack — Phase 2: Execution learning
CREATE TABLE IF NOT EXISTS workflow_execution_stats (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  step_count INTEGER NOT NULL,
  avg_docs_per_step REAL,
  avg_cost_per_step_micros INTEGER,
  avg_duration_per_step_ms INTEGER,
  success_rate REAL,
  common_failures TEXT,
  runtime_breakdown TEXT,
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
