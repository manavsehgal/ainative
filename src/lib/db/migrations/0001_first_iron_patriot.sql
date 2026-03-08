CREATE INDEX `idx_agent_logs_task_id` ON `agent_logs` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_logs_timestamp` ON `agent_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_notifications_task_id` ON `notifications` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_notifications_read` ON `notifications` (`read`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project_id` ON `tasks` (`project_id`);