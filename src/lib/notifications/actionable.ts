import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { notifications, tasks, workflows } from "@/lib/db/schema";
import {
  buildPermissionSummary,
  getPermissionKindLabel,
  parseNotificationToolInput,
  type PermissionToolInput,
} from "@/lib/notifications/permissions";

export const APPROVAL_ACTION_IDS = [
  "allow_once",
  "always_allow",
  "deny",
  "open_inbox",
] as const;

export type ApprovalActionId = (typeof APPROVAL_ACTION_IDS)[number];
export type NotificationChannelId = "in_app" | "browser" | "tauri";

export interface ActionableNotificationPayload {
  notificationId: string;
  taskId: string | null;
  workflowId: string | null;
  toolName: string | null;
  permissionLabel: string;
  compactSummary: string;
  deepLink: string;
  supportedActionIds: ApprovalActionId[];
}

export interface PendingApprovalPayload extends ActionableNotificationPayload {
  channel: "in_app";
  title: string;
  body: string | null;
  taskTitle: string | null;
  workflowName: string | null;
  toolInput: PermissionToolInput | null;
  createdAt: string;
  read: boolean;
  notificationType?: string;
}

export interface ActionableNotificationChannelAdapter {
  channelId: NotificationChannelId;
  present(payload: ActionableNotificationPayload): void | Promise<void>;
  dismiss?(notificationId: string): void | Promise<void>;
}

function buildDeepLink(taskId: string | null, workflowId: string | null): string {
  if (taskId) return `/tasks/${taskId}`;
  if (workflowId) return `/workflows/${workflowId}`;
  return "/inbox";
}

export async function listPendingApprovalPayloads(
  limit = 20
): Promise<PendingApprovalPayload[]> {
  const rows = await db
    .select({
      notificationId: notifications.id,
      taskId: notifications.taskId,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      read: notifications.read,
      toolName: notifications.toolName,
      toolInput: notifications.toolInput,
      createdAt: notifications.createdAt,
      taskTitle: tasks.title,
      workflowId: tasks.workflowId,
      workflowName: workflows.name,
    })
    .from(notifications)
    .leftJoin(tasks, eq(tasks.id, notifications.taskId))
    .leftJoin(workflows, eq(workflows.id, tasks.workflowId))
    .where(
      and(
        inArray(notifications.type, [
          "permission_required",
          "context_proposal",
        ]),
        isNull(notifications.response)
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const isContextProposal = row.type === "context_proposal";
    const parsedInput = parseNotificationToolInput(row.toolInput);

    return {
      channel: "in_app",
      notificationId: row.notificationId,
      taskId: row.taskId,
      workflowId: row.workflowId,
      toolName: row.toolName,
      permissionLabel: isContextProposal
        ? "Context Proposal"
        : getPermissionKindLabel(row.toolName),
      compactSummary: isContextProposal
        ? `Learned patterns proposed for profile "${row.toolName}"`
        : buildPermissionSummary(row.toolName, parsedInput),
      deepLink: isContextProposal
        ? `/profiles/${row.toolName}`
        : buildDeepLink(row.taskId, row.workflowId),
      supportedActionIds: isContextProposal
        ? (["allow_once", "deny"] as ApprovalActionId[])
        : [...APPROVAL_ACTION_IDS],
      title: row.title,
      body: row.body,
      taskTitle: row.taskTitle,
      workflowName: row.workflowName,
      toolInput: parsedInput as PermissionToolInput | null,
      createdAt: row.createdAt.toISOString(),
      read: row.read,
      notificationType: row.type,
    } as PendingApprovalPayload;
  });
}
