"use client";
import { useMemo } from "react";
import { useChatSession } from "@/components/chat/chat-session-provider";

export function useRecentUserMessages(
  conversationId: string | null | undefined,
  limit: number = 20
): string[] {
  const { messages } = useChatSession();
  return useMemo(() => {
    if (!conversationId) return [];
    return messages
      .filter((m) => m.role === "user")
      .slice(-limit)
      .map((m) =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content)
      );
  }, [messages, conversationId, limit]);
}
