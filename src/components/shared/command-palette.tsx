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
  LayoutDashboard,
  FolderKanban,
  Plus,
  Sun,
  Moon,
  CheckCheck,
  Loader2,
  BookOpen,
} from "lucide-react";
import { navigationItems, createItems } from "@/lib/chat/command-data";
import { toggleTheme } from "@/lib/theme";

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

interface PlaybookItem {
  slug: string;
  title: string;
  tags: string[];
}


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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [playbookItems, setPlaybookItems] = useState<PlaybookItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Defer render until after hydration to avoid Radix ID mismatch
  useEffect(() => setMounted(true), []);

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
          setPlaybookItems(data.playbook ?? []);
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

  function handleToggleTheme() {
    setOpen(false);
    toggleTheme();
  }

  async function markAllRead() {
    setOpen(false);
    await fetch("/api/notifications/mark-all-read", { method: "PATCH" });
    router.refresh();
  }

  const hasRecent = recentProjects.length > 0 || recentTasks.length > 0;

  if (!mounted) return null;

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

        {/* User Guide */}
        {playbookItems.length > 0 && (
          <>
            <CommandGroup heading="User Guide">
              {playbookItems.map((item) => (
                <CommandItem
                  key={`playbook-${item.slug}`}
                  value={`playbook-${item.title}`}
                  onSelect={() => navigate(`/user-guide/${item.slug}`)}
                  keywords={["docs", "guide", ...item.tags]}
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="flex-1 truncate">{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

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
          <CommandItem onSelect={handleToggleTheme} value="Toggle Theme" keywords={["dark", "light", "mode"]}>
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
