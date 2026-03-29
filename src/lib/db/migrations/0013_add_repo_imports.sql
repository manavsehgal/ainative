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
