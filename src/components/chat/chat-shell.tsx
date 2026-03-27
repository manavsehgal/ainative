"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ConversationRow, ChatMessageRow } from "@/lib/db/schema";
import type { PromptCategory } from "@/lib/chat/types";
import { DEFAULT_CHAT_MODEL, CHAT_MODELS, getRuntimeForModel, type ChatModelOption } from "@/lib/chat/types";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ConversationList } from "./conversation-list";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";
import type { MentionReference } from "@/hooks/use-chat-autocomplete";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatActivityIndicator } from "./chat-activity-indicator";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MessageCircle, PanelRightOpen } from "lucide-react";

interface ChatShellProps {
  initialConversations: ConversationRow[];
  promptCategories: PromptCategory[];
  initialActiveId?: string | null;
}

export function ChatShell({
  initialConversations,
  promptCategories,
  initialActiveId,
}: ChatShellProps) {
  const router = useRouter();
  const [conversations, setConversations] =
    useState<ConversationRow[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_CHAT_MODEL);
  const [availableModels, setAvailableModels] = useState<ChatModelOption[]>(CHAT_MODELS);

  // Persistence via localStorage fallback
  const [persistedActiveId, setPersistedActiveId] = usePersistedState<string>("stagent-active-chat", "");

  const activeConversation = conversations.find((c) => c.id === activeId);

  // Restore active conversation on mount
  // Read localStorage synchronously to avoid race with usePersistedState's async useEffect
  useEffect(() => {
    let restoredId = initialActiveId || null;
    if (!restoredId) {
      try {
        restoredId = localStorage.getItem("stagent-active-chat") || null;
      } catch { /* localStorage unavailable */ }
    }
    if (restoredId && conversations.some((c) => c.id === restoredId)) {
      setActiveId(restoredId);
      setPersistedActiveId(restoredId);
      // Fetch messages for restored conversation
      fetch(`/api/chat/conversations/${restoredId}/messages`)
        .then((r) => r.ok ? r.json() : [])
        .then((msgs) => setMessages(msgs))
        .catch(() => setMessages([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync activeId to URL and localStorage
  const updateActiveId = useCallback((id: string | null) => {
    setActiveId(id);
    setPersistedActiveId(id ?? "");
    if (id) {
      router.replace(`/chat?c=${id}`, { scroll: false });
    } else {
      router.replace("/chat", { scroll: false });
    }
  }, [router, setPersistedActiveId]);

  // Extract spawned task IDs from messages (execute_task tool results)
  const spawnedTaskIds = useMemo(() => {
    const taskIds: string[] = [];
    for (const msg of messages) {
      if (msg.metadata) {
        try {
          const meta = typeof msg.metadata === "string" ? JSON.parse(msg.metadata) : msg.metadata;
          // Check for execute_task tool result in metadata
          if (meta.type === "permission_request" && meta.toolName === "mcp__stagent__execute_task") {
            const input = meta.toolInput;
            if (input?.taskId) taskIds.push(input.taskId);
          }
        } catch {
          // Ignore parse errors
        }
      }
      // Also scan assistant message content for task execution confirmations
      if (msg.role === "assistant" && msg.content) {
        const taskIdMatch = msg.content.match(/Execution started.*?taskId["\s:]+([a-f0-9-]{36})/i);
        if (taskIdMatch) taskIds.push(taskIdMatch[1]);
      }
    }
    return [...new Set(taskIds)];
  }, [messages]);

  // Fetch default model and available models on mount
  useEffect(() => {
    fetch("/api/settings/chat")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.defaultModel) setModelId(data.defaultModel);
      })
      .catch(() => {});

    fetch("/api/chat/models")
      .then((r) => r.ok ? r.json() : null)
      .then((models) => {
        if (models?.length) setAvailableModels(models);
      })
      .catch(() => {});
  }, []);

  // ── Conversation Management ──────────────────────────────────────────

  const handleNewChat = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runtimeId: getRuntimeForModel(modelId), modelId }),
      });
      if (!res.ok) return;
      const conversation = await res.json();
      setConversations((prev) => [conversation, ...prev]);
      updateActiveId(conversation.id);
      setMessages([]);
      setMobileListOpen(false);
    } catch {
      // Handle error silently
    }
  }, [modelId, updateActiveId]);

  const handleSelectConversation = useCallback(async (id: string) => {
    updateActiveId(id);
    setMobileListOpen(false);
    try {
      const [msgRes, convRes] = await Promise.all([
        fetch(`/api/chat/conversations/${id}/messages`),
        fetch(`/api/chat/conversations/${id}`),
      ]);
      if (msgRes.ok) {
        const msgs = await msgRes.json();
        // Clean up stale "streaming" messages from interrupted sessions
        setMessages(
          msgs.map((m: ChatMessageRow) =>
            m.status === "streaming" ? { ...m, status: "complete" as const } : m
          )
        );
      }
      if (convRes.ok) {
        const conv = await convRes.json();
        if (conv.modelId) setModelId(conv.modelId);
      }
    } catch {
      setMessages([]);
    }
  }, [updateActiveId]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/chat/conversations/${id}`, {
          method: "DELETE",
        });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeId === id) {
          updateActiveId(null);
          setMessages([]);
        }
      } catch {
        // Handle error silently
      }
    },
    [activeId, updateActiveId]
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
    async (content: string, mentions?: MentionReference[]) => {
      let conversationId = activeId;

      // Create conversation on first message if none active
      if (!conversationId) {
        try {
          const res = await fetch("/api/chat/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runtimeId: getRuntimeForModel(modelId), modelId }),
          });
          if (!res.ok) return;
          const conversation = await res.json();
          setConversations((prev) => [conversation, ...prev]);
          updateActiveId(conversation.id);
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
            body: JSON.stringify({ content, mentions }),
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
              if (event.type === "status") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, metadata: JSON.stringify({ statusPhase: event.phase, statusMessage: event.message }) }
                      : m
                  )
                );
              } else if (event.type === "delta") {
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
                      ? {
                          ...m,
                          id: event.messageId,
                          status: "complete",
                          metadata: (() => {
                            const existing = m.metadata
                              ? (() => { try { return JSON.parse(m.metadata!); } catch { return {}; } })()
                              : {};
                            if (event.quickAccess?.length) {
                              existing.quickAccess = event.quickAccess;
                            }
                            return JSON.stringify(existing);
                          })(),
                        }
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
              } else if (event.type === "permission_request" || event.type === "question") {
                // Insert system message for inline permission/question UI
                const systemMsg = {
                  id: event.messageId,
                  conversationId: conversationId!,
                  role: "system" as const,
                  content: event.type === "permission_request"
                    ? `Permission required: ${event.toolName}`
                    : "Agent has a question",
                  metadata: JSON.stringify(event.type === "permission_request"
                    ? { type: "permission_request", requestId: event.requestId, toolName: event.toolName, toolInput: event.toolInput }
                    : { type: "question", requestId: event.requestId, questions: event.questions }
                  ),
                  status: "pending" as const,
                  createdAt: new Date(),
                };
                setMessages((prev) => [...prev, systemMsg]);
              } else if (event.type === "screenshot") {
                // Append screenshot attachment to assistant message metadata
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantMsgId) return m;
                    const meta = m.metadata ? (() => { try { return JSON.parse(m.metadata!); } catch { return {}; } })() : {};
                    const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
                    attachments.push({
                      documentId: event.documentId,
                      thumbnailUrl: event.thumbnailUrl,
                      originalUrl: event.originalUrl,
                      width: event.width,
                      height: event.height,
                    });
                    return { ...m, metadata: JSON.stringify({ ...meta, attachments }) };
                  })
                );
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
    [activeId, modelId, updateActiveId]
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

  const handleMessageStatusChange = useCallback(
    (messageId: string, status: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, status: status as "pending" | "streaming" | "complete" | "error" }
            : m
        )
      );
    },
    []
  );

  const handleModelChange = useCallback(
    async (newModelId: string) => {
      setModelId(newModelId);
      // If there's an active conversation, update both modelId and runtimeId
      if (activeId) {
        const newRuntimeId = getRuntimeForModel(newModelId);
        await fetch(`/api/chat/conversations/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: newModelId, runtimeId: newRuntimeId }),
        }).catch(() => {});
        // Update local state so conversation list reflects the change
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId
              ? { ...c, modelId: newModelId, runtimeId: newRuntimeId }
              : c
          )
        );
      }
    },
    [activeId]
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
                modelId={modelId}
                onModelChange={handleModelChange}
                availableModels={availableModels}
              />
            </ChatEmptyState>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <ChatMessageList messages={messages} isStreaming={isStreaming} conversationId={activeId ?? undefined} onMessageStatusChange={handleMessageStatusChange} />
            </div>

            {/* Background activity indicator */}
            {spawnedTaskIds.length > 0 && (
              <ChatActivityIndicator taskIds={spawnedTaskIds} />
            )}

            {/* Docked input */}
            <ChatInput
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              isHeroMode={false}
              modelId={modelId}
              onModelChange={handleModelChange}
              availableModels={availableModels}
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
