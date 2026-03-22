import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "@/lib/db";
import { projects, chatMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthEnv } from "@/lib/settings/auth";
import { buildClaudeSdkEnv } from "@/lib/agents/runtime/claude-sdk";
import {
  extractUsageSnapshot,
  mergeUsageSnapshot,
  recordUsageLedgerEntry,
  type UsageSnapshot,
} from "@/lib/usage/ledger";
import { enforceBudgetGuardrails } from "@/lib/settings/budget-guardrails";
import {
  getConversation,
  addMessage,
  updateMessageStatus,
  updateMessageContent,
  updateConversation,
} from "@/lib/data/chat";
import { buildChatContext } from "./context-builder";
import { detectEntities } from "./entity-detector";
import type { ChatStreamEvent, ChatQuestion } from "./types";
import { getProviderForRuntime, DEFAULT_CHAT_MODEL } from "./types";
import {
  createSideChannel,
  emitSideChannelEvent,
  createPendingRequest,
  cleanupConversation,
  type ToolPermissionResponse,
} from "./permission-bridge";
import { isToolAllowed } from "@/lib/settings/permissions";
import { createStagentMcpServer } from "./stagent-tools";

// ── Streaming input wrapper (required for MCP tools) ─────────────────

async function* generatePrompt(text: string) {
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: text },
    parent_tool_use_id: null,
    session_id: crypto.randomUUID(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Send a user message and stream the assistant response.
 * Returns an async iterable of ChatStreamEvent for SSE bridging.
 *
 * The generator merges two event sources:
 *   1. SDK stream events (text deltas, results)
 *   2. Side-channel events from canUseTool (permission requests, questions)
 */
export async function* sendMessage(
  conversationId: string,
  userContent: string,
  signal?: AbortSignal
): AsyncGenerator<ChatStreamEvent> {
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    yield { type: "error", message: "Conversation not found" };
    return;
  }

  const runtimeId = conversation.runtimeId;
  const providerId = getProviderForRuntime(runtimeId);

  // Enforce budget before the turn
  try {
    await enforceBudgetGuardrails({
      runtimeId,
      activityType: "chat_turn",
      projectId: conversation.projectId,
    });
  } catch (error) {
    yield {
      type: "error",
      message: error instanceof Error ? error.message : "Budget limit exceeded",
    };
    return;
  }

  // Build context BEFORE persisting user message to avoid double-send
  let projectName: string | null = null;
  let cwd: string | null = null;
  if (conversation.projectId) {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, conversation.projectId))
      .get();
    if (project) {
      projectName = project.name;
      cwd = project.workingDirectory ?? null;
    }
  }

  const context = await buildChatContext({
    conversationId,
    projectId: conversation.projectId,
    projectName,
    cwd,
  });

  // Persist user message (after context is built so it won't appear in history)
  await addMessage({
    conversationId,
    role: "user",
    content: userContent,
  });

  // Auto-title from first message if conversation has no title
  if (!conversation.title) {
    const title =
      userContent.length > 60
        ? userContent.slice(0, 57) + "..."
        : userContent;
    await updateConversation(conversationId, { title });
  }

  // Build prompt: system context with history, user message as the prompt
  // The SDK sends the prompt as the user turn, so we embed history in the system preamble
  const historyBlock = context.history.length > 0
    ? "\n\n## Prior conversation:\n" +
      context.history
        .map((m) => `**${m.role}:** ${m.content}`)
        .join("\n\n")
    : "";

  const fullPrompt = [
    context.systemPrompt + historyBlock,
    "",
    userContent,
  ].join("\n");

  // Create placeholder assistant message
  const assistantMsg = await addMessage({
    conversationId,
    role: "assistant",
    content: "",
    status: "streaming",
  });

  // Create side channel for canUseTool → SSE bridge communication
  const sideChannel = createSideChannel(conversationId);

  const startedAt = new Date();
  let usage: UsageSnapshot = {};
  let fullText = "";

  try {
    const authEnv = await getAuthEnv();
    const abortController = new AbortController();

    // Forward external abort signal
    if (signal) {
      signal.addEventListener("abort", () => abortController.abort(), {
        once: true,
      });
    }

    // Create in-process MCP server for Stagent CRUD tools
    const stagentServer = createStagentMcpServer(conversation.projectId);

    const response = query({
      prompt: generatePrompt(fullPrompt),
      options: {
        model: conversation.modelId || undefined,
        abortController,
        includePartialMessages: true,
        cwd: cwd ?? process.cwd(),
        env: buildClaudeSdkEnv(authEnv),
        mcpServers: { stagent: stagentServer },
        allowedTools: ["mcp__stagent__*"],
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ): Promise<ToolPermissionResponse> => {
          // Auto-allow Stagent CRUD tools (handled by in-process MCP server)
          if (toolName.startsWith("mcp__stagent__")) {
            return { behavior: "allow", updatedInput: input };
          }

          const isQuestion = toolName === "AskUserQuestion";

          // Layer 1: Check saved user permissions (skip for questions)
          if (!isQuestion) {
            if (await isToolAllowed(toolName, input)) {
              return { behavior: "allow", updatedInput: input };
            }
          }

          // Persist the request as a system message
          const requestId = crypto.randomUUID();
          const systemMsg = await addMessage({
            conversationId,
            role: "system",
            content: isQuestion
              ? `Agent has a question`
              : `Permission required: ${toolName}`,
            status: "pending",
            metadata: JSON.stringify(
              isQuestion
                ? { type: "question", requestId, questions: (input as { questions?: ChatQuestion[] }).questions ?? [] }
                : { type: "permission_request", requestId, toolName, toolInput: input }
            ),
          });

          // Emit event through side channel to SSE bridge
          if (isQuestion) {
            emitSideChannelEvent(conversationId, {
              type: "question",
              requestId,
              messageId: systemMsg.id,
              questions: (input as { questions?: ChatQuestion[] }).questions ?? [],
            });
          } else {
            emitSideChannelEvent(conversationId, {
              type: "permission_request",
              requestId,
              messageId: systemMsg.id,
              toolName,
              toolInput: input,
            });
          }

          // Block until user responds via the respond API
          return createPendingRequest(requestId, conversationId);
        },
      },
    });

    for await (const raw of response as AsyncIterable<
      Record<string, unknown>
    >) {
      if (signal?.aborted) break;

      // Drain any side-channel events (from canUseTool) before processing SDK event
      for (const sideEvent of sideChannel.drain()) {
        yield sideEvent;
      }

      usage = mergeUsageSnapshot(usage, extractUsageSnapshot(raw));

      if (raw.type === "stream_event") {
        // SDK wraps Anthropic API events inside stream_event.event
        const innerEvent = raw.event as Record<string, unknown> | undefined;
        if (innerEvent?.type === "content_block_delta") {
          const delta = innerEvent.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            fullText += delta.text;
            yield { type: "delta", content: delta.text };
          }
        }
      } else if (raw.type === "content_block_delta") {
        const delta = raw.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          fullText += delta.text;
          yield { type: "delta", content: delta.text };
        }
      } else if (raw.type === "assistant") {
        // Handle assistant message with content blocks
        const msg = raw.message as Record<string, unknown> | undefined;
        const blocks = (msg?.content ?? raw.content) as Array<Record<string, unknown>> | undefined;
        if (blocks) {
          for (const block of blocks) {
            if (block.type === "text" && typeof block.text === "string" && !fullText.includes(block.text)) {
              fullText += block.text;
              yield { type: "delta", content: block.text };
            }
          }
        }
      } else if (raw.type === "result" && "result" in raw) {
        if (raw.is_error && raw.subtype !== "error_max_turns") {
          throw new Error(
            typeof raw.result === "string"
              ? raw.result
              : "Agent SDK returned an error"
          );
        }
        // For max_turns errors, use whatever text was accumulated
        const result = raw.result;
        if (typeof result === "string" && result.length > 0) {
          // If result has content not yet streamed, emit the remainder
          if (result !== fullText) {
            const remainder = result.startsWith(fullText)
              ? result.slice(fullText.length)
              : result;
            if (remainder) {
              yield { type: "delta" as const, content: remainder };
            }
            fullText = result;
          }
        }
        break;
      }
    }

    // Drain any remaining side-channel events
    for (const sideEvent of sideChannel.drain()) {
      yield sideEvent;
    }

    // Safety net: if SDK reported output tokens but no text was captured
    if (!fullText && usage.outputTokens && usage.outputTokens > 0) {
      fullText = "(Response was generated but could not be captured. Please try again.)";
      yield { type: "delta", content: fullText };
    }

    // Finalize assistant message
    await updateMessageContent(assistantMsg.id, fullText);
    await updateMessageStatus(assistantMsg.id, "complete");

    // Save usage metadata
    const metadata = JSON.stringify({
      modelId: usage.modelId ?? conversation.modelId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    await db
      .update(chatMessages)
      .set({ metadata })
      .where(eq(chatMessages.id, assistantMsg.id));

    // Detect entities for Quick Access pills
    const quickAccess = await detectEntities(
      fullText,
      conversation.projectId
    );

    // Record usage
    await recordUsageLedgerEntry({
      projectId: conversation.projectId,
      activityType: "chat_turn",
      runtimeId,
      providerId,
      modelId: usage.modelId ?? conversation.modelId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      status: "completed",
      startedAt,
      finishedAt: new Date(),
    });

    yield {
      type: "done",
      messageId: assistantMsg.id,
      quickAccess,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Update message status to error
    await updateMessageContent(
      assistantMsg.id,
      fullText || errorMessage
    );
    await updateMessageStatus(assistantMsg.id, "error");

    // Record failed usage
    await recordUsageLedgerEntry({
      projectId: conversation.projectId,
      activityType: "chat_turn",
      runtimeId,
      providerId,
      modelId: usage.modelId ?? conversation.modelId ?? null,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      status: signal?.aborted ? "cancelled" : "failed",
      startedAt,
      finishedAt: new Date(),
    });

    yield { type: "error", message: errorMessage };
  } finally {
    cleanupConversation(conversationId);
  }
}
