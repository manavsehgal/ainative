import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { InferSelectModel } from "drizzle-orm";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["active", "paused", "completed"] })
    .default("active")
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", {
      enum: ["planned", "queued", "running", "completed", "failed", "cancelled"],
    })
      .default("planned")
      .notNull(),
    assignedAgent: text("assigned_agent"),
    priority: integer("priority").default(2).notNull(),
    result: text("result"),
    sessionId: text("session_id"),
    resumeCount: integer("resume_count").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_tasks_status").on(table.status),
    index("idx_tasks_project_id").on(table.projectId),
  ]
);

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  name: text("name").notNull(),
  definition: text("definition").notNull(),
  status: text("status", {
    enum: ["draft", "active", "paused", "completed"],
  })
    .default("draft")
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const agentLogs = sqliteTable(
  "agent_logs",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => tasks.id),
    agentType: text("agent_type").notNull(),
    event: text("event").notNull(),
    payload: text("payload"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_agent_logs_task_id").on(table.taskId),
    index("idx_agent_logs_timestamp").on(table.timestamp),
  ]
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => tasks.id),
    type: text("type", {
      enum: [
        "permission_required",
        "task_completed",
        "task_failed",
        "agent_message",
      ],
    }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    read: integer("read", { mode: "boolean" }).default(false).notNull(),
    toolName: text("tool_name"),
    toolInput: text("tool_input"),
    response: text("response"),
    respondedAt: integer("responded_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_notifications_task_id").on(table.taskId),
    index("idx_notifications_read").on(table.read),
  ]
);

// Shared types derived from schema — use these in components instead of `as any`
export type ProjectRow = InferSelectModel<typeof projects>;
export type TaskRow = InferSelectModel<typeof tasks>;
export type WorkflowRow = InferSelectModel<typeof workflows>;
export type AgentLogRow = InferSelectModel<typeof agentLogs>;
export type NotificationRow = InferSelectModel<typeof notifications>;
