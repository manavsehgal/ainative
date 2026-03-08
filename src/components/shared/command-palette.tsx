"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Inbox,
  Activity,
  FolderKanban,
  Plus,
  Sun,
  Moon,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate("/dashboard")}>
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => navigate("/inbox")}>
            <Inbox className="h-4 w-4 mr-2" />
            Inbox
          </CommandItem>
          <CommandItem onSelect={() => navigate("/monitor")}>
            <Activity className="h-4 w-4 mr-2" />
            Monitor
          </CommandItem>
          <CommandItem onSelect={() => navigate("/projects")}>
            <FolderKanban className="h-4 w-4 mr-2" />
            Projects
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => navigate("/dashboard?create=task")}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </CommandItem>
          <CommandItem onSelect={() => navigate("/projects?create=project")}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={toggleTheme}>
            <Sun className="h-4 w-4 mr-2 dark:hidden" />
            <Moon className="h-4 w-4 mr-2 hidden dark:block" />
            Toggle Theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
