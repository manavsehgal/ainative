-- Row version history for user-defined tables
CREATE TABLE IF NOT EXISTS `user_table_row_history` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `row_id` TEXT NOT NULL,
  `table_id` TEXT NOT NULL,
  `previous_data` TEXT NOT NULL,
  `changed_by` TEXT DEFAULT 'user',
  `change_type` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_row_history_row_id` ON `user_table_row_history`(`row_id`);
CREATE INDEX IF NOT EXISTS `idx_row_history_table_id` ON `user_table_row_history`(`table_id`);
CREATE INDEX IF NOT EXISTS `idx_row_history_created_at` ON `user_table_row_history`(`created_at`);
