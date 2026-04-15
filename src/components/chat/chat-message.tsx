"use client";

import type { ChatMessageRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ChatPermissionRequest } from "./chat-permission-request";
import { ChatQuestionInline } from "./chat-question";
import { ChatQuickAccess } from "./chat-quick-access";
import { ScreenshotGallery } from "./screenshot-gallery";
import { AlertCircle } from "lucide-react";
import { resolveModelLabel, type ChatQuestion, type QuickAccessItem, type ScreenshotAttachment } from "@/lib/chat/types";

interface ChatMessageProps {
  message: ChatMessageRow;
  isStreaming: boolean;
  conversationId?: string;
  onStatusChange?: (messageId: string, status: string) => void;
}

interface PermissionMetadata {
  type: "permission_request";
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

interface QuestionMetadata {
  type: "question";
  requestId: string;
  questions: ChatQuestion[];
}

type SystemMetadata = PermissionMetadata | QuestionMetadata;

export function ChatMessage({ message, isStreaming, conversationId, onStatusChange }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isError = message.status === "error";

  // Handle system messages (permission requests, questions)
  if (isSystem && message.metadata && conversationId) {
    try {
      const meta = JSON.parse(message.metadata) as SystemMetadata;

      if (meta.type === "permission_request") {
        return (
          <ChatPermissionRequest
            conversationId={conversationId}
            requestId={meta.requestId}
            messageId={message.id}
            toolName={meta.toolName}
            toolInput={meta.toolInput}
            status={message.status ?? "pending"}
            onStatusChange={onStatusChange ? (status) => onStatusChange(message.id, status) : undefined}
          />
        );
      }

      if (meta.type === "question") {
        return (
          <ChatQuestionInline
            conversationId={conversationId}
            requestId={meta.requestId}
            messageId={message.id}
            questions={meta.questions}
            status={message.status ?? "pending"}
            onStatusChange={onStatusChange ? (status) => onStatusChange(message.id, status) : undefined}
          />
        );
      }
    } catch {
      // Invalid metadata — fall through to default rendering
    }
  }

  // Skip rendering system messages without valid metadata
  if (isSystem) return null;

  // Extract Quick Access pills, model label, and screenshot attachments from assistant messages
  let quickAccess: QuickAccessItem[] = [];
  let attachments: ScreenshotAttachment[] = [];
  let modelLabel: string | null = null;
  let fallbackReason: string | null = null;
  if (!isUser && message.metadata) {
    try {
      const meta = JSON.parse(message.metadata);
      if (Array.isArray(meta.quickAccess)) quickAccess = meta.quickAccess;
      if (Array.isArray(meta.attachments)) attachments = meta.attachments;
      if (meta.modelId) modelLabel = resolveModelLabel(meta.modelId);
      if (meta.fallbackReason) fallbackReason = meta.fallbackReason;
    } catch {
      // Invalid metadata
    }
  }

  return (
    <div>
      {/* Message bubble */}
      <div
        className={cn(
          "rounded-xl px-4 py-2.5",
          isUser
            ? "bg-muted text-foreground"
            : cn(
                "bg-card",
                isError && "border border-destructive/50"
              )
        )}
      >
        {isError && !isUser && (
          <div className="flex items-center gap-1.5 text-destructive text-xs mb-1.5">
            <AlertCircle className="h-3 w-3" />
            Error
          </div>
        )}

        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm">
            {message.content ? (
              <ChatMessageMarkdown
                content={message.content}
                attachments={attachments}
              />
            ) : isStreaming ? (
              <span className="text-muted-foreground text-xs animate-pulse">
                {(() => {
                  try {
                    const meta = message.metadata ? JSON.parse(message.metadata) : null;
                    return meta?.statusMessage || "Thinking...";
                  } catch { return "Thinking..."; }
                })()}
              </span>
            ) : null}
            {/* Legacy fallback: messages saved before inline screenshot rendering
                stored attachments in metadata but never embedded markdown image
                refs in `content`. Detect that case and show the trailing gallery
                so historical conversations don't lose their visuals. */}
            {attachments.length > 0 &&
              !attachments.some((att) =>
                message.content?.includes(`](${att.thumbnailUrl})`)
              ) && <ScreenshotGallery attachments={attachments} />}
            {isStreaming && message.content && (
              <span className="inline-block w-0.5 h-4 bg-foreground animate-pulse ml-0.5 align-text-bottom" />
            )}
            <ChatQuickAccess items={quickAccess} />
          </div>
        )}
      </div>
      {/* Model label for completed assistant messages */}
      {!isUser && !isStreaming && modelLabel && (
        <div className="mt-0.5 ml-1 space-y-0.5">
          <span className="block text-[10px] text-muted-foreground/50">
            {modelLabel}
          </span>
          {fallbackReason && (
            <span className="block text-[10px] text-amber-700/80 dark:text-amber-300/80">
              {fallbackReason}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
