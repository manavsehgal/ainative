"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
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
  Settings,
  Plus,
  Sun,
  Moon,
  CheckCheck,
  Loader2,
} from "lucide-react";

interface RecentProject {
  id: string;
  name: string;
  status: string;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
}

const navigationItems = [
  { title: "Home", href: "/", icon: Home, keywords: "landing welcome" },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "tasks kanban board" },
  { title: "Inbox", href: "/inbox", icon: Inbox, keywords: "notifications messages" },
  { title: "Monitor", href: "/monitor", icon: Activity, keywords: "logs agents streaming" },
  { title: "Projects", href: "/projects", icon: FolderKanban, keywords: "manage" },
  { title: "Workflows", href: "/workflows", icon: GitBranch, keywords: "automation steps sequence" },
  { title: "Documents", href: "/documents", icon: FileText, keywords: "files uploads attachments" },
  { title: "Profiles", href: "/profiles", icon: Bot, keywords: "agents configuration" },
  { title: "Schedules", href: "/schedules", icon: Clock, keywords: "cron recurring timer" },
  { title: "Settings", href: "/settings", icon: Settings, keywords: "preferences configuration" },
];

const createItems = [
  { title: "New Task", href: "/dashboard?create=task", keywords: "create add task" },
  { title: "New Project", href: "/projects?create=project", keywords: "create add project" },
  { title: "New Workflow", href: "/workflows/new", keywords: "create add workflow automation" },
  { title: "New Profile", href: "/profiles/new", keywords: "create add agent profile" },
];

function statusColorClass(status: string): string {
  switch (status) {
    case "running":
      return "text-status-running";
    case "completed":
      return "text-status-completed";
    case "failed":
      return "text-status-failed";
    default:
      return "text-muted-foreground";
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch recent items when palette opens
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingRecent(true);

    fetch("/api/command-palette/recent", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setRecentProjects(data.projects);
          setRecentTasks(data.tasks);
        }
      })
      .catch(() => {
        // Aborted or failed — ignore
      })
      .finally(() => setLoadingRecent(false));
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  function toggleTheme() {
    setOpen(false);
    const isDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("stagent-theme", isDark ? "light" : "dark");
  }

  async function markAllRead() {
    setOpen(false);
    await fetch("/api/notifications/mark-all-read", { method: "PATCH" });
    router.refresh();
  }

  const hasRecent = recentProjects.length > 0 || recentTasks.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent Items */}
        {(loadingRecent || hasRecent) && (
          <CommandGroup heading="Recent">
            {loadingRecent && !hasRecent ? (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recent items...
              </div>
            ) : (
              <>
                {recentProjects.map((project) => (
                  <CommandItem
                    key={`project-${project.id}`}
                    value={`recent-project-${project.name}`}
                    onSelect={() => navigate(`/projects/${project.id}`)}
                    keywords={["recent", "project"]}
                  >
                    <FolderKanban className="h-4 w-4" />
                    <span className="flex-1 truncate">{project.name}</span>
                    <span className={`text-xs ${statusColorClass(project.status)}`}>
                      {project.status}
                    </span>
                  </CommandItem>
                ))}
                {recentTasks.map((task) => (
                  <CommandItem
                    key={`task-${task.id}`}
                    value={`recent-task-${task.title}`}
                    onSelect={() => navigate(`/dashboard?task=${task.id}`)}
                    keywords={["recent", "task"]}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="flex-1 truncate">{task.title}</span>
                    <span className={`text-xs ${statusColorClass(task.status)}`}>
                      {task.status}
                    </span>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandGroup>
        )}

        {hasRecent && <CommandSeparator />}

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.href}
              value={item.title}
              onSelect={() => navigate(item.href)}
              keywords={[item.keywords]}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Create */}
        <CommandGroup heading="Create">
          {createItems.map((item) => (
            <CommandItem
              key={item.href}
              value={item.title}
              onSelect={() => navigate(item.href)}
              keywords={[item.keywords]}
            >
              <Plus className="h-4 w-4" />
              {item.title}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Utility */}
        <CommandGroup heading="Utility">
          <CommandItem onSelect={toggleTheme} value="Toggle Theme" keywords={["dark", "light", "mode"]}>
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="h-4 w-4 hidden dark:block" />
            Toggle Theme
            <CommandShortcut>Theme</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={markAllRead} value="Mark All Notifications Read" keywords={["clear", "inbox", "unread"]}>
            <CheckCheck className="h-4 w-4" />
            Mark All Read
            <CommandShortcut>Inbox</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
