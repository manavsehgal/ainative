import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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

export const tasks = sqliteTable("tasks", {
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
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

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

export const agentLogs = sqliteTable("agent_logs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id),
  agentType: text("agent_type").notNull(),
  event: text("event").notNull(),
  payload: text("payload"),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
});

export const notifications = sqliteTable("notifications", {
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
});
