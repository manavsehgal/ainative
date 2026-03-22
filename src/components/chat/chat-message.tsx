"use client";

import type { ChatMessageRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { Bot, User, AlertCircle } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageRow;
  isStreaming: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isError = message.status === "error";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          "rounded-xl px-4 py-2.5 max-w-[65%] sm:max-w-[85%] lg:max-w-[65%]",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : cn(
                "bg-card border border-border elevation-1 rounded-bl-sm",
                isError && "border-destructive/50"
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

      {/* User avatar */}
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
