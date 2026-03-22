CREATE TABLE IF NOT EXISTS environment_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  manifest TEXT NOT NULL,
  scope TEXT DEFAULT 'user' NOT NULL,
  artifact_count INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_env_templates_scope ON environment_templates(scope);
