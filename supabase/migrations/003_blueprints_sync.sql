-- Marketplace blueprints — workflow templates published by users
CREATE TABLE IF NOT EXISTS blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL, -- YAML workflow definition
  price_cents INTEGER DEFAULT 0,
  revenue_share_pct INTEGER DEFAULT 70, -- Creator's share (70% or 80%)
  success_rate REAL DEFAULT 0,
  install_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blueprints_status ON blueprints(status);
CREATE INDEX idx_blueprints_category ON blueprints(category);
CREATE INDEX idx_blueprints_creator ON blueprints(creator_id);

ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;

-- Public read for published blueprints
CREATE POLICY "Public read published blueprints"
  ON blueprints FOR SELECT
  USING (status = 'published' OR auth.uid() = creator_id);

-- Creators can manage their own
CREATE POLICY "Creator manage own blueprints"
  ON blueprints FOR ALL
  USING (auth.uid() = creator_id);

-- Sync sessions — tracks cloud backup/restore per device
CREATE TABLE IF NOT EXISTS sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  blob_path TEXT NOT NULL,
  blob_size_bytes INTEGER DEFAULT 0,
  encryption_iv TEXT, -- Base64-encoded IV
  content_hash TEXT,
  sync_type TEXT NOT NULL DEFAULT 'backup' CHECK (sync_type IN ('backup', 'restore')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_sessions_user ON sync_sessions(user_id);
CREATE INDEX idx_sync_sessions_device ON sync_sessions(device_id);

ALTER TABLE sync_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sync sessions"
  ON sync_sessions FOR ALL
  USING (auth.uid() = user_id);
