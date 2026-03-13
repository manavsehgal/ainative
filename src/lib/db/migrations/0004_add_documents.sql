CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT,
  project_id TEXT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  direction TEXT DEFAULT 'input' NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'uploaded' NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_documents_task_id ON documents(task_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
