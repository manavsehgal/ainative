CREATE TABLE IF NOT EXISTS `app_instances` (
  `id` text PRIMARY KEY NOT NULL,
  `app_id` text NOT NULL,
  `name` text NOT NULL,
  `version` text NOT NULL,
  `project_id` text,
  `manifest_json` text NOT NULL,
  `ui_schema_json` text NOT NULL,
  `resource_map_json` text DEFAULT '{}' NOT NULL,
  `status` text DEFAULT 'installing' NOT NULL,
  `source_type` text DEFAULT 'builtin' NOT NULL,
  `bootstrap_error` text,
  `installed_at` integer NOT NULL,
  `bootstrapped_at` integer,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_app_instances_app_id` ON `app_instances` (`app_id`);
CREATE INDEX IF NOT EXISTS `idx_app_instances_project_id` ON `app_instances` (`project_id`);
CREATE INDEX IF NOT EXISTS `idx_app_instances_status` ON `app_instances` (`status`);
