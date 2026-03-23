import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, isNull, desc } from "drizzle-orm";
import { ok, err, type ToolContext } from "./helpers";

export function notificationTools(_ctx: ToolContext) {
  return [
    tool(
      "list_notifications",
      "List notifications. By default shows only pending approval requests. Set pendingOnly to false for all recent notifications.",
      {
        pendingOnly: z
          .boolean()
          .optional()
          .describe("If true (default), only show unanswered permission requests"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results (default 20)"),
      },
      async (args) => {
        try {
          const pendingOnly = args.pendingOnly !== false;
          const limit = args.limit ?? 20;

          if (pendingOnly) {
            const { listPendingApprovalPayloads } = await import(
              "@/lib/notifications/actionable"
            );
            const payloads = await listPendingApprovalPayloads(limit);
            return ok(payloads);
          }

          const result = await db
            .select({
              id: notifications.id,
              type: notifications.type,
              title: notifications.title,
              body: notifications.body,
              read: notifications.read,
              toolName: notifications.toolName,
              response: notifications.response,
              respondedAt: notifications.respondedAt,
              createdAt: notifications.createdAt,
            })
            .from(notifications)
            .orderBy(desc(notifications.createdAt))
            .limit(limit);

          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list notifications");
        }
      }
    ),

    tool(
      "respond_notification",
      "Respond to a pending permission or approval notification. Use 'allow' to approve or 'deny' to reject.",
      {
        notificationId: z.string().describe("The notification ID to respond to"),
        behavior: z
          .enum(["allow", "deny"])
          .describe("'allow' to approve, 'deny' to reject"),
        alwaysAllow: z
          .boolean()
          .optional()
          .describe("If true, save this as a permanent permission rule"),
      },
      async (args) => {
        try {
          const notification = await db
            .select()
            .from(notifications)
            .where(eq(notifications.id, args.notificationId))
            .get();

          if (!notification) return err(`Notification not found: ${args.notificationId}`);
          if (notification.response) return err("Already responded to this notification");

          const responseData = {
            behavior: args.behavior,
            message:
              args.behavior === "deny"
                ? "Denied via chat"
                : undefined,
            alwaysAllow: args.alwaysAllow || undefined,
          };

          await db
            .update(notifications)
            .set({
              response: JSON.stringify(responseData),
              respondedAt: new Date(),
              read: true,
            })
            .where(eq(notifications.id, args.notificationId));

          // Save permanent permission if requested
          if (args.behavior === "allow" && args.alwaysAllow && notification.toolName && notification.toolInput) {
            try {
              const { buildPermissionPattern } = await import("@/lib/notifications/permissions");
              const { addAllowedPermission } = await import("@/lib/settings/permissions");
              const parsedInput = JSON.parse(notification.toolInput);
              const pattern = buildPermissionPattern(notification.toolName, parsedInput);
              await addAllowedPermission(pattern);
            } catch {
              // Non-fatal: permission save failed but response was recorded
            }
          }

          return ok({
            message: `Notification ${args.behavior === "allow" ? "approved" : "denied"}`,
            notificationId: args.notificationId,
            alwaysAllow: args.alwaysAllow ?? false,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to respond to notification");
        }
      }
    ),

    tool(
      "mark_notifications_read",
      "Mark all unread notifications as read.",
      {},
      async () => {
        try {
          const result = await db
            .update(notifications)
            .set({ read: true })
            .where(eq(notifications.read, false));

          return ok({ message: "All notifications marked as read" });
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to mark notifications read");
        }
      }
    ),
  ];
}
