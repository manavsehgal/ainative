-- Workflow triggers for user-defined tables
CREATE TABLE IF NOT EXISTS `user_table_triggers` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `table_id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `trigger_event` TEXT NOT NULL,
  `condition` TEXT,
  `action_type` TEXT NOT NULL,
  `action_config` TEXT NOT NULL,
  `status` TEXT DEFAULT 'active' NOT NULL,
  `fire_count` INTEGER DEFAULT 0 NOT NULL,
  `last_fired_at` INTEGER,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_user_table_triggers_table_id` ON `user_table_triggers`(`table_id`);
CREATE INDEX IF NOT EXISTS `idx_user_table_triggers_status` ON `user_table_triggers`(`status`);
