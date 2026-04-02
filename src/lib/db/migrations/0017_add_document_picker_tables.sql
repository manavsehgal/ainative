-- Schedule document inputs (context documents for scheduled tasks)
CREATE TABLE IF NOT EXISTS `schedule_document_inputs` (
  `id` text PRIMARY KEY NOT NULL,
  `schedule_id` text NOT NULL,
  `document_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_sdi_schedule` ON `schedule_document_inputs` (`schedule_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_sdi_schedule_doc` ON `schedule_document_inputs` (`schedule_id`, `document_id`);

-- Project document defaults (auto-attached to new tasks/workflows in project)
CREATE TABLE IF NOT EXISTS `project_document_defaults` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `document_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS `idx_pdd_project` ON `project_document_defaults` (`project_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_pdd_project_doc` ON `project_document_defaults` (`project_id`, `document_id`);
