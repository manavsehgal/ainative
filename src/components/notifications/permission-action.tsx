"use client";

import { PermissionResponseActions } from "@/components/notifications/permission-response-actions";
import type { PermissionToolInput } from "@/lib/notifications/permissions";

interface PermissionActionProps {
  taskId?: string | null;
  notificationId: string;
  toolName: string;
  toolInput: PermissionToolInput;
  responded: boolean;
  response: string | null;
  onResponded: () => void;
}

export function PermissionAction({
  taskId,
  notificationId,
  toolName,
  toolInput,
  responded,
  response,
  onResponded,
}: PermissionActionProps) {
  return (
    <PermissionResponseActions
      taskId={taskId}
      notificationId={notificationId}
      toolName={toolName}
      toolInput={toolInput}
      responded={responded}
      response={response}
      onResponded={onResponded}
      className="mt-2"
    />
  );
}
