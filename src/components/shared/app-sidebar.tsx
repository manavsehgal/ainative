"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Activity,
  FolderKanban,
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

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, badge: false },
  { title: "Inbox", href: "/inbox", icon: Inbox, badge: true },
  { title: "Monitor", href: "/monitor", icon: Activity, badge: false },
  { title: "Projects", href: "/projects", icon: FolderKanban, badge: false },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">Stagent</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
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
          <kbd className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">
            <span className="text-xs">&#8984;</span>K
          </kbd>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
