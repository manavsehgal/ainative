"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  Inbox,
  Activity,
  FolderKanban,
  Workflow,
  FileText,
  Bot,
  Clock,
  Wallet,
  BookOpen,
  BookMarked,
  Globe,
  Settings,
  MessageCircle,
  Table2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarTrigger,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { TrustTierBadge } from "@/components/shared/trust-tier-badge";
import { UnreadBadge } from "@/components/notifications/unread-badge";
import { AuthStatusDot } from "@/components/settings/auth-status-dot";
import { StagentLogo } from "@/components/shared/stagent-logo";
import { WorkspaceIndicator } from "@/components/shared/workspace-indicator";

interface NavItem {
  title: string;
  href: string;
  icon: typeof Home;
  badge?: boolean;
  alsoMatches?: string[];
}

const workItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, alsoMatches: ["/tasks"] },
  { title: "Inbox", href: "/inbox", icon: Inbox, badge: true },
  { title: "Chat", href: "/chat", icon: MessageCircle },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Workflows", href: "/workflows", icon: Workflow },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Tables", href: "/tables", icon: Table2, alsoMatches: ["/tables/"] },
];

const manageItems: NavItem[] = [
  { title: "Monitor", href: "/monitor", icon: Activity },
  { title: "Profiles", href: "/profiles", icon: Bot },
  { title: "Schedules", href: "/schedules", icon: Clock },
  { title: "Cost & Usage", href: "/costs", icon: Wallet },
];

const learnItems: NavItem[] = [
  { title: "AI Native Book", href: "/book", icon: BookOpen },
  { title: "User Guide", href: "/user-guide", icon: BookMarked },
];

const configureItems: NavItem[] = [
  { title: "Environment", href: "/environment", icon: Globe },
  { title: "Settings", href: "/settings", icon: Settings },
];

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(item.href + "/")
                      || (item.alsoMatches?.some(p => pathname.startsWith(p)) ?? false)
                }
              >
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.title}</span>
                  {item.badge && <span className="group-data-[collapsible=icon]:hidden"><UnreadBadge /></span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <StagentLogo size={24} className="shrink-0" />
            <span className="text-lg font-bold tracking-tight">Stagent</span>
          </Link>
          <Link href="/" className="hidden group-data-[collapsible=icon]:flex items-center justify-center" aria-label="Stagent home">
            <StagentLogo size={20} />
          </Link>
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Work" items={workItems} pathname={pathname} />
        <NavGroup label="Manage" items={manageItems} pathname={pathname} />
        <NavGroup label="Learn" items={learnItems} pathname={pathname} />
        <NavGroup label="Configure" items={configureItems} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter className="px-4 py-3">
        <div className="group-data-[collapsible=icon]:hidden mb-2">
          <WorkspaceIndicator variant="sidebar" />
        </div>
        <SidebarSeparator className="!-mx-4 !w-[calc(100%+2rem)] group-data-[collapsible=icon]:hidden" />
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center mt-2">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden">
            <AuthStatusDot />
            <TrustTierBadge />
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
              className="h-7 px-1.5 rounded-md border border-border/50 text-[10px] font-medium text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer group-data-[collapsible=icon]:hidden"
              aria-label="Open command palette (⌘K)"
            >
              <kbd>⌘K</kbd>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
