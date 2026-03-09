import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync } from "fs";

const dataDir = process.env.STAGENT_DATA_DIR || join(homedir(), ".stagent");
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, "stagent.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Bootstrap all tables (migrations may not have been applied on fresh install)
// Note: sqlite.exec() here is better-sqlite3's synchronous DDL method, not child_process
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planned' NOT NULL,
    assigned_agent TEXT,
    priority INTEGER DEFAULT 2 NOT NULL,
    result TEXT,
    session_id TEXT,
    resume_count INTEGER DEFAULT 0 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
  );

  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT,
    name TEXT NOT NULL,
    definition TEXT NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
  );

  CREATE TABLE IF NOT EXISTS agent_logs (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT,
    agent_type TEXT NOT NULL,
    event TEXT NOT NULL,
    payload TEXT,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE NO ACTION ON DELETE NO ACTION
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    read INTEGER DEFAULT 0 NOT NULL,
    tool_name TEXT,
    tool_input TEXT,
    response TEXT,
    responded_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE NO ACTION ON DELETE NO ACTION
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_agent_logs_task_id ON agent_logs(task_id);
  CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp);
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
    extracted_text TEXT,
    processed_path TEXT,
    processing_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
  CREATE INDEX IF NOT EXISTS idx_documents_task_id ON documents(task_id);
  CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
`);

export const db = drizzle(sqlite, { schema });
