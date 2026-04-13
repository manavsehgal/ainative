-- Historical migration: app_instances table (removed in 0025).
-- Kept for Drizzle journal compatibility.
CREATE TABLE IF NOT EXISTS app_instances (
  id TEXT PRIMARY KEY NOT NULL,
  app_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  project_id TEXT,
  manifest_json TEXT NOT NULL,
  ui_schema_json TEXT NOT NULL,
  resource_map_json TEXT DEFAULT '{}' NOT NULL,
  status TEXT DEFAULT 'installing' NOT NULL,
  source_type TEXT DEFAULT 'builtin' NOT NULL,
  bootstrap_error TEXT,
  installed_at INTEGER NOT NULL,
  bootstrapped_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_instances_app_id ON app_instances(app_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_app_instances_project_id ON app_instances(project_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_app_instances_status ON app_instances(status);
