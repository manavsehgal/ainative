import {
  ListTodo,
  Play,
  XCircle,
  FolderPlus,
  GitBranch,
  Upload,
  CalendarPlus,
  Search,
  Sun,
  CheckCheck,
  Plus,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { navigationItems, createItems } from "./command-data";

export type SlashCommandBehavior = "insert_template" | "navigate" | "execute_immediately";
export type SlashCommandGroup = "Actions" | "Navigation" | "Create" | "Utility";

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: SlashCommandGroup;
  keywords: string[];
  behavior: SlashCommandBehavior;
  template?: string;
  href?: string;
}

const actionCommands: SlashCommand[] = [
  {
    id: "create_task",
    label: "Create Task",
    description: "Create a new task",
    icon: ListTodo,
    group: "Actions",
    keywords: ["task", "new", "add"],
    behavior: "insert_template",
    template: 'Create a task titled "" with priority medium',
  },
  {
    id: "create_project",
    label: "Create Project",
    description: "Create a new project",
    icon: FolderPlus,
    group: "Actions",
    keywords: ["project", "new", "add"],
    behavior: "insert_template",
    template: 'Create a project named ""',
  },
  {
    id: "create_workflow",
    label: "Create Workflow",
    description: "Create a multi-step workflow",
    icon: GitBranch,
    group: "Actions",
    keywords: ["workflow", "automation", "steps"],
    behavior: "insert_template",
    template: 'Create a workflow named "" with steps: ',
  },
  {
    id: "create_schedule",
    label: "Create Schedule",
    description: "Create a recurring schedule",
    icon: CalendarPlus,
    group: "Actions",
    keywords: ["schedule", "cron", "recurring", "timer"],
    behavior: "insert_template",
    template: 'Create a schedule named "" that runs every ',
  },
  {
    id: "execute_task",
    label: "Execute Task",
    description: "Run a specific task",
    icon: Play,
    group: "Actions",
    keywords: ["run", "start", "execute"],
    behavior: "insert_template",
    template: "Execute the task ",
  },
  {
    id: "cancel_task",
    label: "Cancel Task",
    description: "Cancel a running task",
    icon: XCircle,
    group: "Actions",
    keywords: ["stop", "abort", "cancel"],
    behavior: "insert_template",
    template: "Cancel the task ",
  },
  {
    id: "upload_document",
    label: "Upload Document",
    description: "Upload a file",
    icon: Upload,
    group: "Actions",
    keywords: ["upload", "file", "attach", "document"],
    behavior: "insert_template",
    template: "Upload the document at ",
  },
  {
    id: "list_tasks",
    label: "List Tasks",
    description: "Show all tasks",
    icon: Search,
    group: "Actions",
    keywords: ["tasks", "list", "show", "all"],
    behavior: "insert_template",
    template: "List all tasks",
  },
  {
    id: "list_projects",
    label: "List Projects",
    description: "Show all projects",
    icon: Search,
    group: "Actions",
    keywords: ["projects", "list", "show", "all"],
    behavior: "insert_template",
    template: "List all projects",
  },
  {
    id: "execute_workflow",
    label: "Execute Workflow",
    description: "Run a workflow",
    icon: Play,
    group: "Actions",
    keywords: ["run", "workflow", "execute"],
    behavior: "insert_template",
    template: "Execute the workflow ",
  },
  {
    id: "build_app",
    label: "Build App",
    description: "Build a new app through guided conversation",
    icon: Package,
    group: "Actions",
    keywords: ["build", "app", "create", "sap", "package"],
    behavior: "insert_template",
    template: "Build a new app: ",
  },
];

const utilityCommands: SlashCommand[] = [
  {
    id: "toggle_theme",
    label: "Toggle Theme",
    description: "Switch dark/light mode",
    icon: Sun,
    group: "Utility",
    keywords: ["dark", "light", "mode", "theme"],
    behavior: "execute_immediately",
  },
  {
    id: "mark_all_read",
    label: "Mark All Read",
    description: "Mark all notifications as read",
    icon: CheckCheck,
    group: "Utility",
    keywords: ["clear", "inbox", "notifications", "unread"],
    behavior: "execute_immediately",
  },
];

let cachedCommands: SlashCommand[] | null = null;

export function getSlashCommands(): SlashCommand[] {
  if (cachedCommands) return cachedCommands;

  const navCommands: SlashCommand[] = navigationItems.map((item) => ({
    id: `nav_${item.href.replace(/\//g, "_").replace(/^_/, "")}`,
    label: item.title,
    description: `Go to ${item.title}`,
    icon: item.icon,
    group: "Navigation" as const,
    keywords: item.keywords.split(" "),
    behavior: "navigate" as const,
    href: item.href,
  }));

  const createCommands: SlashCommand[] = createItems.map((item) => ({
    id: `create_${item.title.toLowerCase().replace(/\s+/g, "_")}`,
    label: item.title,
    description: item.title,
    icon: Plus,
    group: "Create" as const,
    keywords: item.keywords.split(" "),
    behavior: "navigate" as const,
    href: item.href,
  }));

  cachedCommands = [
    ...actionCommands,
    ...navCommands,
    ...createCommands,
    ...utilityCommands,
  ];

  return cachedCommands;
}
