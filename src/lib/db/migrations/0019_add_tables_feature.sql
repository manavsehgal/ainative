-- User-defined structured data tables
CREATE TABLE IF NOT EXISTS `user_tables` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `project_id` TEXT,
  `name` TEXT NOT NULL,
  `description` TEXT,
  `column_schema` TEXT NOT NULL DEFAULT '[]',
  `row_count` INTEGER DEFAULT 0 NOT NULL,
  `source` TEXT DEFAULT 'manual' NOT NULL,
  `template_id` TEXT,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_user_tables_project_id` ON `user_tables`(`project_id`);
CREATE INDEX IF NOT EXISTS `idx_user_tables_source` ON `user_tables`(`source`);

CREATE TABLE IF NOT EXISTS `user_table_columns` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `table_id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `display_name` TEXT NOT NULL,
  `data_type` TEXT NOT NULL,
  `position` INTEGER NOT NULL,
  `required` INTEGER DEFAULT 0 NOT NULL,
  `default_value` TEXT,
  `config` TEXT,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_user_table_columns_table_id` ON `user_table_columns`(`table_id`);
CREATE INDEX IF NOT EXISTS `idx_user_table_columns_position` ON `user_table_columns`(`table_id`, `position`);

CREATE TABLE IF NOT EXISTS `user_table_rows` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `table_id` TEXT NOT NULL,
  `data` TEXT NOT NULL DEFAULT '{}',
  `position` INTEGER NOT NULL,
  `created_by` TEXT DEFAULT 'user',
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_user_table_rows_table_id` ON `user_table_rows`(`table_id`);
CREATE INDEX IF NOT EXISTS `idx_user_table_rows_position` ON `user_table_rows`(`table_id`, `position`);

CREATE TABLE IF NOT EXISTS `user_table_views` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `table_id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `type` TEXT DEFAULT 'grid' NOT NULL,
  `config` TEXT,
  `is_default` INTEGER DEFAULT 0 NOT NULL,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_user_table_views_table_id` ON `user_table_views`(`table_id`);

CREATE TABLE IF NOT EXISTS `user_table_relationships` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `from_table_id` TEXT NOT NULL,
  `from_column` TEXT NOT NULL,
  `to_table_id` TEXT NOT NULL,
  `to_column` TEXT NOT NULL,
  `relationship_type` TEXT NOT NULL,
  `config` TEXT,
  `created_at` INTEGER NOT NULL,
  FOREIGN KEY (`from_table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`to_table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_user_table_rels_from` ON `user_table_relationships`(`from_table_id`);
CREATE INDEX IF NOT EXISTS `idx_user_table_rels_to` ON `user_table_relationships`(`to_table_id`);

CREATE TABLE IF NOT EXISTS `user_table_templates` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT,
  `category` TEXT NOT NULL,
  `column_schema` TEXT NOT NULL,
  `sample_data` TEXT,
  `scope` TEXT DEFAULT 'system' NOT NULL,
  `icon` TEXT,
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_user_table_templates_category` ON `user_table_templates`(`category`);
CREATE INDEX IF NOT EXISTS `idx_user_table_templates_scope` ON `user_table_templates`(`scope`);

CREATE TABLE IF NOT EXISTS `user_table_imports` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `table_id` TEXT NOT NULL,
  `document_id` TEXT,
  `row_count` INTEGER DEFAULT 0 NOT NULL,
  `error_count` INTEGER DEFAULT 0 NOT NULL,
  `errors` TEXT,
  `status` TEXT DEFAULT 'pending' NOT NULL,
  `created_at` INTEGER NOT NULL,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_user_table_imports_table_id` ON `user_table_imports`(`table_id`);

-- Junction tables for linking tables to other domain objects
CREATE TABLE IF NOT EXISTS `table_document_inputs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `table_id` TEXT NOT NULL,
  `document_id` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_tdi_table` ON `table_document_inputs`(`table_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_tdi_table_doc` ON `table_document_inputs`(`table_id`, `document_id`);

CREATE TABLE IF NOT EXISTS `task_table_inputs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `task_id` TEXT NOT NULL,
  `table_id` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_tti_task` ON `task_table_inputs`(`task_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_tti_task_table` ON `task_table_inputs`(`task_id`, `table_id`);

CREATE TABLE IF NOT EXISTS `workflow_table_inputs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `workflow_id` TEXT NOT NULL,
  `table_id` TEXT NOT NULL,
  `step_id` TEXT,
  `created_at` INTEGER NOT NULL,
  FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_wti_workflow` ON `workflow_table_inputs`(`workflow_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_wti_workflow_table_step` ON `workflow_table_inputs`(`workflow_id`, `table_id`, `step_id`);

CREATE TABLE IF NOT EXISTS `schedule_table_inputs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `schedule_id` TEXT NOT NULL,
  `table_id` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL,
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`table_id`) REFERENCES `user_tables`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_sti_schedule` ON `schedule_table_inputs`(`schedule_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_sti_schedule_table` ON `schedule_table_inputs`(`schedule_id`, `table_id`);
