"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Shield, MessageCircle, CheckCircle, XCircle } from "lucide-react";
import { PermissionAction } from "./permission-action";
import { MessageResponse, type Question } from "./message-response";
import { FailureAction } from "./failure-action";
import { formatTimestamp } from "@/lib/utils/format-timestamp";

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

interface NotificationItemProps {
  notification: Notification;
  onUpdated: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  permission_required: <Shield className="h-4 w-4 text-chart-5" aria-hidden="true" />,
  agent_message: <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />,
  task_completed: <CheckCircle className="h-4 w-4 text-chart-2" aria-hidden="true" />,
  task_failed: <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />,
};

const typeLabels: Record<string, string> = {
  permission_required: "Permission required",
  agent_message: "Agent message",
  task_completed: "Task completed",
  task_failed: "Task failed",
};

function formatToolInput(toolName: string | null, input: Record<string, unknown>): React.ReactNode {
  // AskUserQuestion — show the question text directly
  if (toolName === "AskUserQuestion" || toolName === "ask_user_question") {
    const question = input.question ?? input.text ?? input.message;
    if (typeof question === "string") {
      return <p>{question}</p>;
    }
  }

  // Bash/shell — show the command
  if (toolName === "Bash" || toolName === "bash") {
    const cmd = input.command ?? input.cmd;
    if (typeof cmd === "string") {
      return <code className="text-xs font-mono break-all">{cmd}</code>;
    }
  }

  // Read/Write — show the file path
  if (toolName === "Read" || toolName === "Write" || toolName === "Edit") {
    const path = input.file_path ?? input.path;
    if (typeof path === "string") {
      return <span>File: <code className="text-xs font-mono">{path}</code></span>;
    }
  }

  // Fallback: show key-value pairs in a readable format
  const entries = Object.entries(input).slice(0, 4);
  if (entries.length === 0) return null;

  return (
    <dl className="text-xs space-y-0.5">
      {entries.map(([key, val]) => (
        <div key={key} className="flex gap-2">
          <dt className="font-medium shrink-0">{key}:</dt>
          <dd className="truncate">{typeof val === "string" ? val : JSON.stringify(val)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function NotificationItem({ notification, onUpdated }: NotificationItemProps) {
  const isUnread = !notification.read;
  const hasResponse = !!notification.response;
  let parsedToolInput: Record<string, unknown> | null = null;

  try {
    if (notification.toolInput) {
      parsedToolInput = JSON.parse(notification.toolInput);
    }
  } catch {
    // Invalid JSON
  }

  return (
    <Card
      className={`p-4 ${
        isUnread
          ? "border-l-4 border-l-primary bg-background"
          : "bg-muted/30"
      }`}
      role="article"
      aria-label={`${typeLabels[notification.type] ?? "Notification"}: ${notification.title}${isUnread ? " (unread)" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{typeIcons[notification.type]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className={`text-sm ${isUnread ? "font-semibold" : "font-normal"}`}
            >
              {notification.title}
            </h4>
            {hasResponse && (
              <Badge variant="secondary" className="text-xs">
                Responded
              </Badge>
            )}
          </div>

          {/* Tool name for permission requests */}
          {notification.type === "permission_required" && notification.toolName && (
            <div className="mb-2">
              <Badge variant="outline" className="text-xs font-mono">
                {notification.toolName}
              </Badge>
              {parsedToolInput && (
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded mt-1">
                  {formatToolInput(notification.toolName, parsedToolInput)}
                </div>
              )}
            </div>
          )}

          {/* Body for non-tool notifications */}
          {notification.body &&
            notification.type !== "permission_required" &&
            notification.type !== "agent_message" && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {notification.body}
              </p>
            )}

          {/* Actions based on type */}
          {notification.type === "permission_required" &&
            notification.taskId &&
            parsedToolInput && (
              <PermissionAction
                taskId={notification.taskId}
                notificationId={notification.id}
                toolName={notification.toolName ?? ""}
                toolInput={parsedToolInput}
                responded={hasResponse}
                response={notification.response}
                onResponded={onUpdated}
              />
            )}

          {notification.type === "agent_message" &&
            notification.taskId &&
            parsedToolInput && (
              <MessageResponse
                taskId={notification.taskId}
                notificationId={notification.id}
                toolInput={parsedToolInput as { questions: Question[] }}
                responded={hasResponse}
                response={notification.response}
                onResponded={onUpdated}
              />
            )}

          {notification.type === "task_failed" && notification.taskId && (
            <FailureAction taskId={notification.taskId} onRetried={onUpdated} />
          )}

          <p className="text-xs text-muted-foreground mt-2">
            {formatTimestamp(notification.createdAt)}
            {notification.respondedAt && (
              <span>
                {" "}
                · Responded{" "}
                {formatTimestamp(notification.respondedAt)}
              </span>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}
