import type Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";

const STAGENT_TABLES = [
  "projects",
  "tasks",
  "workflows",
  "agent_logs",
  "notifications",
  "settings",
  "documents",
  "schedules",
  "usage_ledger",
  "learned_context",
  "views",
  "environment_scans",
  "environment_artifacts",
  "environment_checkpoints",
  "environment_sync_ops",
  "environment_templates",
  "conversations",
  "chat_messages",
  "reading_progress",
  "bookmarks",
  "profile_test_results",
  "repo_imports",
] as const;

export function bootstrapStagentDatabase(sqlite: Database.Database): void {
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
      workflow_id TEXT,
      schedule_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'planned' NOT NULL,
      assigned_agent TEXT,
      agent_profile TEXT,
      priority INTEGER DEFAULT 2 NOT NULL,
      result TEXT,
      session_id TEXT,
      resume_count INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON UPDATE NO ACTION ON DELETE NO ACTION
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
      version INTEGER DEFAULT 1 NOT NULL,
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

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      assigned_agent TEXT,
      agent_profile TEXT,
      recurs INTEGER DEFAULT 1 NOT NULL,
      status TEXT DEFAULT 'active' NOT NULL,
      max_firings INTEGER,
      firing_count INTEGER DEFAULT 0 NOT NULL,
      expires_at INTEGER,
      last_fired_at INTEGER,
      next_fire_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
    CREATE INDEX IF NOT EXISTS idx_schedules_next_fire_at ON schedules(next_fire_at);
    CREATE INDEX IF NOT EXISTS idx_schedules_project_id ON schedules(project_id);

    CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_documents_task_id ON documents(task_id);
    CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);

    CREATE TABLE IF NOT EXISTS usage_ledger (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT,
      workflow_id TEXT,
      schedule_id TEXT,
      project_id TEXT,
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
      finished_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
    );

    CREATE INDEX IF NOT EXISTS idx_usage_ledger_task_id ON usage_ledger(task_id);
    CREATE INDEX IF NOT EXISTS idx_usage_ledger_activity_type ON usage_ledger(activity_type);
    CREATE INDEX IF NOT EXISTS idx_usage_ledger_runtime_id ON usage_ledger(runtime_id);
    CREATE INDEX IF NOT EXISTS idx_usage_ledger_provider_model ON usage_ledger(provider_id, model_id);
    CREATE INDEX IF NOT EXISTS idx_usage_ledger_finished_at ON usage_ledger(finished_at);

    CREATE TABLE IF NOT EXISTS learned_context (
      id TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT,
      diff TEXT,
      change_type TEXT NOT NULL,
      source_task_id TEXT,
      proposal_notification_id TEXT,
      proposed_additions TEXT,
      approved_by TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (source_task_id) REFERENCES tasks(id) ON UPDATE NO ACTION ON DELETE NO ACTION
    );

    CREATE INDEX IF NOT EXISTS idx_learned_context_profile_version ON learned_context(profile_id, version);
    CREATE INDEX IF NOT EXISTS idx_learned_context_change_type ON learned_context(change_type);

    CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY NOT NULL,
      surface TEXT NOT NULL,
      name TEXT NOT NULL,
      filters TEXT,
      sorting TEXT,
      columns TEXT,
      density TEXT DEFAULT 'comfortable',
      is_default INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_views_surface ON views(surface);
    CREATE INDEX IF NOT EXISTS idx_views_surface_default ON views(surface, is_default);
  `);

  const addColumnIfMissing = (ddl: string) => {
    try {
      sqlite.exec(ddl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("duplicate column")) {
        console.error("[bootstrap] ALTER TABLE failed:", msg);
      }
    }
  };

  addColumnIfMissing(`ALTER TABLE tasks ADD COLUMN agent_profile TEXT;`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_agent_profile ON tasks(agent_profile);`);

  addColumnIfMissing(`ALTER TABLE tasks ADD COLUMN workflow_id TEXT REFERENCES workflows(id);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON tasks(workflow_id);`);

  addColumnIfMissing(`ALTER TABLE tasks ADD COLUMN schedule_id TEXT REFERENCES schedules(id);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_schedule_id ON tasks(schedule_id);`);

  addColumnIfMissing(`ALTER TABLE projects ADD COLUMN working_directory TEXT;`);
  addColumnIfMissing(`ALTER TABLE schedules ADD COLUMN assigned_agent TEXT;`);
  addColumnIfMissing(`ALTER TABLE documents ADD COLUMN version INTEGER NOT NULL DEFAULT 1;`);
  addColumnIfMissing(`ALTER TABLE documents ADD COLUMN source TEXT DEFAULT 'upload';`);
  addColumnIfMissing(`ALTER TABLE documents ADD COLUMN conversation_id TEXT REFERENCES conversations(id);`);
  addColumnIfMissing(`ALTER TABLE documents ADD COLUMN message_id TEXT;`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_documents_conversation_id ON documents(conversation_id);`);

  // ── Environment onboarding tables ──────────────────────────────────────
  sqlite.exec(`
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
  `);

  // ── Chat conversation tables ────────────────────────────────────────────
  // Drop legacy conversations/messages tables (incompatible schema from earlier attempt)
  const legacyConv = sqlite.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='conversations'`
  ).get() as { sql: string } | undefined;
  if (legacyConv && !legacyConv.sql.includes("runtime_id")) {
    sqlite.exec(`DROP TABLE IF EXISTS messages`);
    sqlite.exec(`DROP TABLE IF EXISTS conversations`);
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT,
      title TEXT,
      runtime_id TEXT NOT NULL,
      model_id TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      session_id TEXT,
      context_scope TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE NO ACTION ON DELETE NO ACTION
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      status TEXT DEFAULT 'complete' NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON UPDATE NO ACTION ON DELETE NO ACTION
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON chat_messages(conversation_id, created_at);
  `);

  // ── Book reading progress & bookmarks ────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      chapter_id TEXT PRIMARY KEY NOT NULL,
      progress INTEGER DEFAULT 0 NOT NULL,
      scroll_position INTEGER DEFAULT 0 NOT NULL,
      last_read_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY NOT NULL,
      chapter_id TEXT NOT NULL,
      section_id TEXT,
      scroll_position INTEGER DEFAULT 0 NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_chapter_id ON bookmarks(chapter_id);
  `);

  // ── Repo imports (skills repo import tracking) ─────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS repo_imports (
      id TEXT PRIMARY KEY NOT NULL,
      repo_url TEXT NOT NULL,
      repo_owner TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      branch TEXT NOT NULL,
      commit_sha TEXT NOT NULL,
      profile_ids TEXT NOT NULL,
      skill_count INTEGER NOT NULL,
      last_checked_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_repo_imports_repo_url ON repo_imports(repo_url);
    CREATE INDEX IF NOT EXISTS idx_repo_imports_owner_name ON repo_imports(repo_owner, repo_name);
  `);

  // ── Profile test results ────────────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profile_test_results (
      id TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL,
      runtime_id TEXT NOT NULL,
      report_json TEXT NOT NULL,
      total_passed INTEGER DEFAULT 0 NOT NULL,
      total_failed INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_profile_test_results_profile_runtime ON profile_test_results(profile_id, runtime_id);
  `);
}

export function hasLegacyStagentTables(sqlite: Database.Database): boolean {
  const placeholders = STAGENT_TABLES.map(() => "?").join(", ");
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) AS count
       FROM sqlite_master
       WHERE type = 'table' AND name IN (${placeholders})`
    )
    .get(...STAGENT_TABLES) as { count: number };

  return row.count > 0;
}

export function hasMigrationHistory(
  sqlite: Database.Database,
  migrationsTable = "__drizzle_migrations"
): boolean {
  const tableRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS count
       FROM sqlite_master
       WHERE type = 'table' AND name = ?`
    )
    .get(migrationsTable) as { count: number };

  if (tableRow.count === 0) {
    return false;
  }

  const row = sqlite
    .prepare(`SELECT COUNT(*) AS count FROM ${migrationsTable}`)
    .get() as { count: number };

  return row.count > 0;
}

export function markAllMigrationsApplied(
  sqlite: Database.Database,
  migrationsFolder: string,
  migrationsTable = "__drizzle_migrations"
): void {
  const migrations = readMigrationFiles({ migrationsFolder, migrationsTable });

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )
  `);

  const existing = sqlite
    .prepare(`SELECT hash, created_at FROM ${migrationsTable}`)
    .all() as Array<{ hash: string; created_at: number }>;
  const seen = new Set(existing.map((row) => `${row.hash}:${row.created_at}`));
  const insert = sqlite.prepare(
    `INSERT INTO ${migrationsTable} (hash, created_at) VALUES (?, ?)`
  );

  for (const migration of migrations) {
    const key = `${migration.hash}:${migration.folderMillis}`;
    if (!seen.has(key)) {
      insert.run(migration.hash, migration.folderMillis);
    }
  }
}
