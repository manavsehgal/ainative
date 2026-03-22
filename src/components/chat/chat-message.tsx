"use client";

import type { ChatMessageRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ChatPermissionRequest } from "./chat-permission-request";
import { ChatQuestionInline } from "./chat-question";
import { AlertCircle } from "lucide-react";
import type { ChatQuestion } from "@/lib/chat/types";

interface ChatMessageProps {
  message: ChatMessageRow;
  isStreaming: boolean;
  conversationId?: string;
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

export function ChatMessage({ message, isStreaming, conversationId }: ChatMessageProps) {
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
          />
        );
      }
    } catch {
      // Invalid metadata — fall through to default rendering
    }
  }

  // Skip rendering system messages without valid metadata
  if (isSystem) return null;

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
              <ChatMessageMarkdown content={message.content} />
            ) : isStreaming ? (
              <span className="text-muted-foreground text-xs">
                Thinking...
              </span>
            ) : null}
            {isStreaming && message.content && (
              <span className="inline-block w-0.5 h-4 bg-foreground animate-pulse ml-0.5 align-text-bottom" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
