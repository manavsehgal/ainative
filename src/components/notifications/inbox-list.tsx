"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CheckCheck, Inbox, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NotificationItem } from "./notification-item";
import { EmptyState } from "@/components/shared/empty-state";

interface Notification {
  id: string;
  taskId: string | null;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  toolName: string | null;
  toolInput: string | null;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export function InboxList({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] =
    useState<Notification[]>(initialNotifications);
  const [tab, setTab] = useState("all");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) setNotifications(await res.json());
  }, []);

  // Poll every 10 seconds (consolidated from 3s inbox + 5s badge)
  useEffect(() => {
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "PATCH" });
    toast.success("All notifications marked as read");
    refresh();
  }

  async function dismissAllRead() {
    const readNotifications = notifications.filter((n) => n.read);
    if (readNotifications.length === 0) return;
    await Promise.all(
      readNotifications.map((n) =>
        fetch(`/api/notifications/${n.id}`, { method: "DELETE" })
      )
    );
    toast.success(`Dismissed ${readNotifications.length} read notification${readNotifications.length !== 1 ? "s" : ""}`);
    refresh();
  }

  const filtered =
    tab === "all"
      ? notifications
      : tab === "unread"
        ? notifications.filter((n) => !n.read)
        : tab === "permissions"
          ? notifications.filter((n) => n.type === "permission_required")
          : notifications.filter((n) => n.type === "agent_message");

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} aria-label="Refresh notifications">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
          {notifications.some((n) => n.read) && (
            <Button variant="ghost" size="sm" onClick={dismissAllRead} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" />
              Dismiss read
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3" aria-live="polite">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            heading="No notifications"
            description={tab === "all" ? "You're all caught up." : `No ${tab} notifications to show.`}
          />
        ) : (
          filtered.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onUpdated={refresh}
            />
          ))
        )}
      </div>
    </div>
  );
}
