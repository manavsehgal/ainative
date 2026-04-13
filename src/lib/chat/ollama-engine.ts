/**
 * Ollama chat engine — streams messages via the Ollama /api/chat endpoint.
 *
 * Follows the same ChatStreamEvent protocol as the main engine
 * so the chat UI can render Ollama responses identically.
 */

import { db } from "@/lib/db";
import { chatMessages, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";
import {
  getConversation,
  addMessage,
  updateMessageStatus,
  updateMessageContent,
} from "@/lib/data/chat";
import { buildChatContext } from "./context-builder";
import { getWorkspaceContext } from "@/lib/environment/workspace-context";
import type { ChatStreamEvent } from "./types";

/**
 * Send a user message to Ollama and stream the response.
 */
export async function* sendOllamaMessage(
  conversationId: string,
  userContent: string,
  signal?: AbortSignal
): AsyncGenerator<ChatStreamEvent> {
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    yield { type: "error", message: "Conversation not found" };
    return;
  }

  yield { type: "status", phase: "preparing", message: "Connecting to Ollama..." };

  // Resolve Ollama base URL and model
  const baseUrl =
    (await getSetting(SETTINGS_KEYS.OLLAMA_BASE_URL)) || "http://localhost:11434";
  const modelId =
    conversation.modelId?.replace(/^ollama:/, "") ||
    (await getSetting(SETTINGS_KEYS.OLLAMA_DEFAULT_MODEL)) ||
    "llama3.2";

  // Build context
  let projectName: string | null = null;
  let projectCwd: string | null = null;
  if (conversation.projectId) {
    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, conversation.projectId))
      .get();
    if (project) {
      projectName = project.name;
      projectCwd = project.workingDirectory ?? null;
    }
  }

  const workspace = getWorkspaceContext();
  if (projectCwd) workspace.cwd = projectCwd;

  const context = await buildChatContext({
    conversationId,
    projectId: conversation.projectId,
    projectName,
    workspace,
  });

  // Persist user message
  await addMessage({
    conversationId,
    role: "user",
    content: userContent,
    status: "complete",
  });

  // Create assistant message placeholder
  const assistantMsg = await addMessage({
    conversationId,
    role: "assistant",
    content: "",
    status: "streaming",
  });

  // Build message history for Ollama
  const history = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt)
    .all();

  const messages = [
    // System prompt from context
    ...(context.systemPrompt
      ? [{ role: "system" as const, content: context.systemPrompt }]
      : []),
    // Conversation history (exclude the placeholder assistant msg)
    ...history
      .filter((m) => m.id !== assistantMsg.id && m.content)
      .map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content!,
      })),
  ];

  // Stream from Ollama
  let accumulated = "";
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      yield { type: "error", message: `Ollama error (${response.status}): ${errorText}` };
      await updateMessageStatus(assistantMsg.id, "complete");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", message: "No response stream from Ollama" };
      await updateMessageStatus(assistantMsg.id, "complete");
      return;
    }

    yield { type: "status", phase: "streaming", message: "Streaming response..." };

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const delta = parsed.message?.content ?? "";
          if (delta) {
            accumulated += delta;
            yield { type: "delta", content: delta };
          }
          if (parsed.done) break;
        } catch {
          // Skip malformed lines
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        const delta = parsed.message?.content ?? "";
        if (delta) {
          accumulated += delta;
          yield { type: "delta", content: delta };
        }
      } catch {
        // ignore
      }
    }

    // Persist the complete response
    await updateMessageContent(assistantMsg.id, accumulated);
    await updateMessageStatus(assistantMsg.id, "complete");

    yield { type: "done", messageId: assistantMsg.id, quickAccess: [] };
  } catch (err) {
    if (signal?.aborted) {
      yield { type: "error", message: "Request cancelled" };
    } else {
      const msg = err instanceof Error ? err.message : "Ollama streaming failed";
      yield { type: "error", message: msg };
    }
    if (accumulated) {
      await updateMessageContent(assistantMsg.id, accumulated);
    }
    await updateMessageStatus(assistantMsg.id, "complete");
  }
}
