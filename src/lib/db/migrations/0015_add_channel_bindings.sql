-- Bidirectional Channel Chat: channel_bindings table + direction column on channel_configs

CREATE TABLE IF NOT EXISTS channel_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  channel_config_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  external_thread_id TEXT,
  runtime_id TEXT NOT NULL,
  model_id TEXT,
  profile_id TEXT,
  status TEXT DEFAULT 'active' NOT NULL,
  pending_request_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (channel_config_id) REFERENCES channel_configs(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_channel_bindings_config ON channel_bindings(channel_config_id);
CREATE INDEX IF NOT EXISTS idx_channel_bindings_conversation ON channel_bindings(conversation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_bindings_config_thread ON channel_bindings(channel_config_id, external_thread_id);

ALTER TABLE channel_configs ADD COLUMN direction TEXT DEFAULT 'outbound' NOT NULL;
