import { sql } from "drizzle-orm";

import { notifications } from "@/lib/db/schema";

export interface NotificationVisibilityRecord {
  type: string;
  response: string | null;
  respondedAt: string | Date | null;
}

export function isLearningNotificationType(type: string): boolean {
  return type === "context_proposal" || type === "context_proposal_batch";
}

export function isResolvedLearningNotification(
  notification: NotificationVisibilityRecord
): boolean {
  if (!isLearningNotificationType(notification.type)) {
    return false;
  }

  return notification.response !== null || notification.respondedAt !== null;
}

export function filterDefaultVisibleNotifications<T extends NotificationVisibilityRecord>(
  items: T[]
): T[] {
  return items.filter((item) => !isResolvedLearningNotification(item));
}

export function buildDefaultNotificationVisibilityCondition() {
  return sql`(${notifications.type} NOT IN ('context_proposal', 'context_proposal_batch') OR (${notifications.response} IS NULL AND ${notifications.respondedAt} IS NULL))`;
}
