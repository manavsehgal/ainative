import {
  Home,
  LayoutDashboard,
  Inbox,
  Activity,
  FolderKanban,
  GitBranch,
  FileText,
  Bot,
  Clock,
  Wallet,
  Settings,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  keywords: string;
}

export interface CreateItem {
  title: string;
  href: string;
  keywords: string;
}

export const navigationItems: NavigationItem[] = [
  { title: "Home", href: "/", icon: Home, keywords: "landing welcome" },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "tasks kanban board" },
  { title: "Inbox", href: "/inbox", icon: Inbox, keywords: "notifications messages" },
  { title: "Monitor", href: "/monitor", icon: Activity, keywords: "logs agents streaming" },
  { title: "Projects", href: "/projects", icon: FolderKanban, keywords: "manage" },
  { title: "Workflows", href: "/workflows", icon: GitBranch, keywords: "automation steps sequence" },
  { title: "Documents", href: "/documents", icon: FileText, keywords: "files uploads attachments" },
  { title: "Profiles", href: "/profiles", icon: Bot, keywords: "agents configuration" },
  { title: "Schedules", href: "/schedules", icon: Clock, keywords: "cron recurring timer" },
  { title: "Cost & Usage", href: "/costs", icon: Wallet, keywords: "spend tokens metering budget analytics" },
  { title: "User Guide", href: "/user-guide", icon: BookOpen, keywords: "docs guide documentation help playbook" },
  { title: "Settings", href: "/settings", icon: Settings, keywords: "preferences configuration" },
];

export const createItems: CreateItem[] = [
  { title: "New Task", href: "/dashboard?create=task", keywords: "create add task" },
  { title: "New Project", href: "/projects?create=project", keywords: "create add project" },
  { title: "New Workflow", href: "/workflows/new", keywords: "create add workflow automation" },
  { title: "New Profile", href: "/profiles/new", keywords: "create add agent profile" },
];
