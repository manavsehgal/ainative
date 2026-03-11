"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UnreadBadge } from "@/components/notifications/unread-badge";
import { AuthStatusDot } from "@/components/settings/auth-status-dot";

const navItems = [
  { title: "Home", href: "/", icon: Home, badge: false },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, badge: false, alsoMatches: ["/tasks"] },
  { title: "Inbox", href: "/inbox", icon: Inbox, badge: true },
  { title: "Monitor", href: "/monitor", icon: Activity, badge: false },
  { title: "Projects", href: "/projects", icon: FolderKanban, badge: false },
  { title: "Workflows", href: "/workflows", icon: GitBranch, badge: false },
  { title: "Documents", href: "/documents", icon: FileText, badge: false },
  { title: "Profiles", href: "/profiles", icon: Bot, badge: false },
  { title: "Schedules", href: "/schedules", icon: Clock, badge: false },
  { title: "Settings", href: "/settings", icon: Settings, badge: false },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar className="glass-sidebar">
      <SidebarHeader className="px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">Stagent</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href || pathname.startsWith(item.href + "/")
                        || (item.alsoMatches?.some(p => pathname.startsWith(p)) ?? false)
                  }>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.title}</span>
                      {item.badge && <UnreadBadge />}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AuthStatusDot />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                    bubbles: true,
                  })
                )
              }
              className="h-7 px-1.5 rounded-md border border-border/50 text-[10px] font-medium text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer"
              aria-label="Open command palette (⌘K)"
            >
              <kbd>⌘K</kbd>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
