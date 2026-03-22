"use client";

import { useState, useCallback } from "react";
import type { ConversationRow, ChatMessageRow } from "@/lib/db/schema";
import type { PromptCategory } from "@/lib/chat/types";
import { ConversationList } from "./conversation-list";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";
import { ChatEmptyState } from "./chat-empty-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MessageCircle, PanelRightOpen } from "lucide-react";

interface ChatShellProps {
  initialConversations: ConversationRow[];
  promptCategories: PromptCategory[];
}

export function ChatShell({
  initialConversations,
  promptCategories,
}: ChatShellProps) {
  const [conversations, setConversations] =
    useState<ConversationRow[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<string | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeId);

  // ── Conversation Management ──────────────────────────────────────────

  const handleNewChat = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runtimeId: "claude-code" }),
      });
      if (!res.ok) return;
      const conversation = await res.json();
      setConversations((prev) => [conversation, ...prev]);
      setActiveId(conversation.id);
      setMessages([]);
      setMobileListOpen(false);
    } catch {
      // Handle error silently
    }
  }, []);

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setMobileListOpen(false);
    try {
      const res = await fetch(
        `/api/chat/conversations/${id}/messages`
      );
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs);
      }
    } catch {
      setMessages([]);
    }
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/chat/conversations/${id}`, {
          method: "DELETE",
        });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeId === id) {
          setActiveId(null);
          setMessages([]);
        }
      } catch {
        // Handle error silently
      }
    },
    [activeId]
  );

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await fetch(`/api/chat/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (res.ok) {
          const updated = await res.json();
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? updated : c))
          );
        }
      } catch {
        // Handle error silently
      }
    },
    []
  );

  // ── Message Sending ──────────────────────────────────────────────────

  const handleSend = useCallback(
    async (content: string) => {
      let conversationId = activeId;

      // Create conversation on first message if none active
      if (!conversationId) {
        try {
          const res = await fetch("/api/chat/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runtimeId: "claude-code" }),
          });
          if (!res.ok) return;
          const conversation = await res.json();
          setConversations((prev) => [conversation, ...prev]);
          setActiveId(conversation.id);
          conversationId = conversation.id;
        } catch {
          return;
        }
      }

      // Add optimistic user message
      const userMsg: ChatMessageRow = {
        id: crypto.randomUUID(),
        conversationId: conversationId!,
        role: "user",
        content,
        metadata: null,
        status: "complete",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Add placeholder assistant message
      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: ChatMessageRow = {
        id: assistantMsgId,
        conversationId: conversationId!,
        role: "assistant",
        content: "",
        metadata: null,
        status: "streaming",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      setIsStreaming(true);
      const controller = new AbortController();
      setAbortController(controller);

      try {
        const res = await fetch(
          `/api/chat/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
            signal: controller.signal,
          }
        );

        if (!res.ok || !res.body) {
          throw new Error("Failed to send message");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6);
            try {
              const event = JSON.parse(json);
              if (event.type === "delta") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
              } else if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, id: event.messageId, status: "complete" }
                      : m
                  )
                );
                // Refresh conversation from API to get auto-generated title
                fetch(`/api/chat/conversations/${conversationId}`)
                  .then((r) => r.ok ? r.json() : null)
                  .then((conv) => {
                    if (conv) {
                      setConversations((prev) =>
                        prev.map((c) =>
                          c.id === conversationId
                            ? { ...c, title: conv.title, updatedAt: new Date() }
                            : c
                        )
                      );
                    }
                  })
                  .catch(() => {});
              } else if (event.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: m.content || event.message,
                          status: "error",
                        }
                      : m
                  )
                );
              }
            } catch {
              // Ignore malformed SSE data
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content:
                      m.content || "Failed to get response. Please try again.",
                    status: "error",
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        setAbortController(null);
      }
    },
    [activeId]
  );

  const handleStop = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  const handleSuggestionClick = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend]
  );

  // ── Render ───────────────────────────────────────────────────────────

  const conversationListContent = (
    <ConversationList
      conversations={conversations}
      activeId={activeId}
      onSelect={handleSelectConversation}
      onNewChat={handleNewChat}
      onDelete={handleDeleteConversation}
      onRename={handleRenameConversation}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-49px)] overflow-hidden">
      {/* Main chat area */}
      <div className="relative flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 lg:hidden">
          <span className="flex-1 text-sm font-medium truncate">
            {activeConversation?.title ?? "New Chat"}
          </span>
          <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0">
              {conversationListContent}
            </SheetContent>
          </Sheet>
        </div>

        {!activeId && messages.length === 0 ? (
          /* Hero mode: vertically centered greeting + input + chips */
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <ChatEmptyState
              promptCategories={promptCategories}
              onSuggestionClick={handleSuggestionClick}
              onHoverPreview={setHoverPreview}
            >
              <ChatInput
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
                isHeroMode
                previewText={hoverPreview}
              />
            </ChatEmptyState>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <ChatMessageList messages={messages} isStreaming={isStreaming} />
            </div>

            {/* Docked input */}
            <ChatInput
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              isHeroMode={false}
            />
          </>
        )}
      </div>

      {/* Desktop conversation list — right side */}
      <div className="hidden lg:flex lg:w-[280px] lg:flex-col lg:border-l border-border">
        {conversationListContent}
      </div>
    </div>
  );
}
