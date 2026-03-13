ALTER TABLE tasks ADD COLUMN agent_profile TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tasks_agent_profile ON tasks(agent_profile);
