CREATE TABLE IF NOT EXISTS environment_scans (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT,
  scan_path TEXT NOT NULL,
  persona TEXT NOT NULL,
  scan_status TEXT DEFAULT 'running' NOT NULL,
  artifact_count INTEGER DEFAULT 0 NOT NULL,
  duration_ms INTEGER,
  errors TEXT,
  scanned_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_env_scans_project_id ON environment_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_env_scans_scanned_at ON environment_scans(scanned_at);

CREATE TABLE IF NOT EXISTS environment_artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  scan_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  category TEXT NOT NULL,
  scope TEXT NOT NULL,
  name TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  abs_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  preview TEXT,
  metadata TEXT,
  size_bytes INTEGER DEFAULT 0 NOT NULL,
  modified_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES environment_scans(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_env_artifacts_scan_id ON environment_artifacts(scan_id);
CREATE INDEX IF NOT EXISTS idx_env_artifacts_category ON environment_artifacts(category);
CREATE INDEX IF NOT EXISTS idx_env_artifacts_tool ON environment_artifacts(tool);
CREATE INDEX IF NOT EXISTS idx_env_artifacts_scan_tool ON environment_artifacts(scan_id, tool);
CREATE INDEX IF NOT EXISTS idx_env_artifacts_scan_category ON environment_artifacts(scan_id, category);

CREATE TABLE IF NOT EXISTS environment_checkpoints (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT,
  label TEXT NOT NULL,
  checkpoint_type TEXT NOT NULL,
  git_tag TEXT,
  git_commit_sha TEXT,
  backup_path TEXT,
  files_count INTEGER DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_env_checkpoints_project_status ON environment_checkpoints(project_id, status);

CREATE TABLE IF NOT EXISTS environment_sync_ops (
  id TEXT PRIMARY KEY NOT NULL,
  checkpoint_id TEXT NOT NULL,
  artifact_id TEXT,
  operation TEXT NOT NULL,
  target_tool TEXT NOT NULL,
  target_path TEXT NOT NULL,
  diff_preview TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  error TEXT,
  applied_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (checkpoint_id) REFERENCES environment_checkpoints(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (artifact_id) REFERENCES environment_artifacts(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_env_sync_ops_checkpoint_id ON environment_sync_ops(checkpoint_id);
