import {
  ListTodo,
  FolderKanban,
  GitBranch,
  FileText,
  Bell,
  Bot,
  Wallet,
  Settings,
  MessageSquare,
  Clock,
  Globe,
  Sun,
  CheckCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

export type ToolGroup =
  | "Tasks"
  | "Projects"
  | "Workflows"
  | "Schedules"
  | "Documents"
  | "Notifications"
  | "Profiles"
  | "Usage"
  | "Settings"
  | "Chat"
  | "Browser"
  | "Utility";

export interface ToolCatalogEntry {
  /** MCP tool name, e.g. "list_tasks" */
  name: string;
  /** Human-readable description */
  description: string;
  /** Grouping category */
  group: ToolGroup;
  /** Shortened parameter hint, e.g. "status, projectId" */
  paramHint?: string;
  /** Client-side action that bypasses MCP */
  behavior?: "execute_immediately";
}

// ── Group → Icon mapping ─────────────────────────────────────────────────

export const TOOL_GROUP_ICONS: Record<ToolGroup, LucideIcon> = {
  Tasks: ListTodo,
  Projects: FolderKanban,
  Workflows: GitBranch,
  Schedules: Clock,
  Documents: FileText,
  Notifications: Bell,
  Profiles: Bot,
  Usage: Wallet,
  Settings: Settings,
  Chat: MessageSquare,
  Browser: Globe,
  Utility: Sun,
};

/** Display order for groups in the popover */
export const TOOL_GROUP_ORDER: ToolGroup[] = [
  "Tasks",
  "Projects",
  "Workflows",
  "Documents",
  "Schedules",
  "Profiles",
  "Browser",
  "Notifications",
  "Chat",
  "Usage",
  "Settings",
  "Utility",
];

// ── Static tool registry ─────────────────────────────────────────────────
// Mirrors names/descriptions from src/lib/chat/tools/*.ts
// Keep in sync when adding or renaming MCP tools.

const STAGENT_TOOLS: ToolCatalogEntry[] = [
  // ── Tasks ──
  { name: "list_tasks", description: "List tasks, filter by project or status", group: "Tasks", paramHint: "projectId, status" },
  { name: "get_task", description: "Get full details for a task", group: "Tasks", paramHint: "taskId" },
  { name: "create_task", description: "Create a new task", group: "Tasks", paramHint: "title, description, priority" },
  { name: "update_task", description: "Update a task's status, title, or priority", group: "Tasks", paramHint: "taskId, status, priority" },
  { name: "execute_task", description: "Queue and run a task with an AI agent", group: "Tasks", paramHint: "taskId" },
  { name: "cancel_task", description: "Cancel a running task", group: "Tasks", paramHint: "taskId" },

  // ── Projects ──
  { name: "list_projects", description: "List all projects with task counts", group: "Projects", paramHint: "status" },
  { name: "create_project", description: "Create a new project", group: "Projects", paramHint: "name, description" },

  // ── Workflows ──
  { name: "list_workflows", description: "List workflows, filter by project or status", group: "Workflows", paramHint: "projectId, status" },
  { name: "get_workflow", description: "Get workflow details and step info", group: "Workflows", paramHint: "workflowId" },
  { name: "create_workflow", description: "Create a workflow with steps", group: "Workflows", paramHint: "name, definition" },
  { name: "update_workflow", description: "Update a draft workflow", group: "Workflows", paramHint: "workflowId, name" },
  { name: "execute_workflow", description: "Start executing a workflow", group: "Workflows", paramHint: "workflowId" },
  { name: "delete_workflow", description: "Delete a workflow", group: "Workflows", paramHint: "workflowId" },
  { name: "get_workflow_status", description: "Get workflow execution progress", group: "Workflows", paramHint: "workflowId" },

  // ── Schedules ──
  { name: "list_schedules", description: "List scheduled prompt loops", group: "Schedules", paramHint: "status" },
  { name: "get_schedule", description: "Get schedule details", group: "Schedules", paramHint: "scheduleId" },
  { name: "create_schedule", description: "Create a recurring scheduled task", group: "Schedules", paramHint: "name, prompt, interval" },
  { name: "update_schedule", description: "Update or pause/resume a schedule", group: "Schedules", paramHint: "scheduleId, status" },
  { name: "delete_schedule", description: "Delete a schedule", group: "Schedules", paramHint: "scheduleId" },

  // ── Documents ──
  { name: "list_documents", description: "List documents, filter by project or status", group: "Documents", paramHint: "projectId, status" },
  { name: "get_document", description: "Get document metadata", group: "Documents", paramHint: "documentId" },
  { name: "read_document_content", description: "Read full text content of a document", group: "Documents", paramHint: "documentId" },
  { name: "upload_document", description: "Upload a file as a document", group: "Documents", paramHint: "file_path" },
  { name: "update_document", description: "Update document metadata", group: "Documents", paramHint: "documentId, metadata" },
  { name: "delete_document", description: "Delete a document", group: "Documents", paramHint: "documentId" },

  // ── Notifications ──
  { name: "list_notifications", description: "List pending approval requests", group: "Notifications", paramHint: "pendingOnly, limit" },
  { name: "respond_notification", description: "Approve or deny a pending request", group: "Notifications", paramHint: "notificationId, behavior" },
  { name: "mark_notifications_read", description: "Mark all notifications as read", group: "Notifications" },

  // ── Profiles ──
  { name: "list_profiles", description: "List available agent profiles", group: "Profiles" },
  { name: "get_profile", description: "Get agent profile configuration", group: "Profiles", paramHint: "profileId" },

  // ── Usage ──
  { name: "get_usage_summary", description: "Get spending and token usage stats", group: "Usage", paramHint: "days" },

  // ── Settings ──
  { name: "get_settings", description: "Get current Stagent settings", group: "Settings", paramHint: "key" },

  // ── Chat History ──
  { name: "list_conversations", description: "List recent chat conversations", group: "Chat", paramHint: "search, limit" },
  { name: "get_conversation_messages", description: "Get messages from a past conversation", group: "Chat", paramHint: "conversationId, limit" },
  { name: "search_messages", description: "Search across all conversations", group: "Chat", paramHint: "query" },
];

const BROWSER_TOOLS: ToolCatalogEntry[] = [
  { name: "take_screenshot", description: "Capture a screenshot of the page", group: "Browser" },
  { name: "navigate_page", description: "Navigate to a URL", group: "Browser", paramHint: "url" },
  { name: "click", description: "Click an element on the page", group: "Browser", paramHint: "selector" },
  { name: "get_page_text", description: "Extract text content from the page", group: "Browser" },
  { name: "fill", description: "Fill in a form field", group: "Browser", paramHint: "selector, value" },
  { name: "take_snapshot", description: "Take an accessibility snapshot", group: "Browser" },
];

const UTILITY_ENTRIES: ToolCatalogEntry[] = [
  { name: "toggle_theme", description: "Switch dark/light mode", group: "Utility", behavior: "execute_immediately" },
  { name: "mark_all_read", description: "Mark all notifications as read", group: "Utility", behavior: "execute_immediately" },
];

// ── Public API ───────────────────────────────────────────────────────────

let cachedCatalog: ToolCatalogEntry[] | null = null;
let cachedWithBrowser: ToolCatalogEntry[] | null = null;

export function getToolCatalog(opts?: { includeBrowser?: boolean }): ToolCatalogEntry[] {
  const withBrowser = opts?.includeBrowser ?? false;

  if (withBrowser) {
    if (!cachedWithBrowser) {
      cachedWithBrowser = [...STAGENT_TOOLS, ...BROWSER_TOOLS, ...UTILITY_ENTRIES];
    }
    return cachedWithBrowser;
  }

  if (!cachedCatalog) {
    cachedCatalog = [...STAGENT_TOOLS, ...UTILITY_ENTRIES];
  }
  return cachedCatalog;
}

/** Group catalog entries by their ToolGroup */
export function groupToolCatalog(entries: ToolCatalogEntry[]): Record<string, ToolCatalogEntry[]> {
  const groups: Record<string, ToolCatalogEntry[]> = {};
  for (const entry of entries) {
    if (!groups[entry.group]) groups[entry.group] = [];
    groups[entry.group].push(entry);
  }
  return groups;
}
