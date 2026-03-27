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
import { getSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";
import {
  getConversation,
  addMessage,
  updateMessageStatus,
  updateMessageContent,
  updateConversation,
} from "@/lib/data/chat";
import { buildChatContext } from "./context-builder";
import {
  detectEntities,
  extractToolResultEntities,
  deduplicateByEntityId,
  type ToolResultCapture,
} from "./entity-detector";
import type { ChatStreamEvent, ChatQuestion, ScreenshotAttachment } from "./types";
import { getProviderForRuntime, DEFAULT_CHAT_MODEL } from "./types";
import { persistScreenshot, SCREENSHOT_TOOL_NAMES } from "@/lib/screenshots/persist";
import {
  createSideChannel,
  emitSideChannelEvent,
  createPendingRequest,
  cleanupConversation,
  type ToolPermissionResponse,
} from "./permission-bridge";
import { isToolAllowed } from "@/lib/settings/permissions";
import { getLaunchCwd, getWorkspaceContext } from "@/lib/environment/workspace-context";
import { createStagentMcpServer } from "./stagent-tools";
import {
  getBrowserMcpServers,
  getBrowserAllowedToolPatterns,
  isBrowserTool,
  isBrowserReadOnly,
} from "@/lib/agents/browser-mcp";

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

  // Route to Codex App Server for OpenAI models
  if (conversation.runtimeId === "openai-codex-app-server") {
    const { sendCodexMessage } = await import("./codex-engine");
    yield* sendCodexMessage(conversationId, userContent, signal);
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

  yield { type: "status", phase: "preparing", message: "Preparing context..." };

  // Build context BEFORE persisting user message to avoid double-send
  let projectName: string | null = null;
  let projectCwd: string | null = null;
  if (conversation.projectId) {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, conversation.projectId))
      .get();
    if (project) {
      projectName = project.name;
      projectCwd = project.workingDirectory ?? null;
    }
  }

  // Build workspace context — project workingDirectory overrides launch cwd
  const workspace = getWorkspaceContext();
  if (projectCwd) {
    workspace.cwd = projectCwd;
  }

  const context = await buildChatContext({
    conversationId,
    projectId: conversation.projectId,
    projectName,
    workspace,
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
    const toolResults: ToolResultCapture[] = [];
    const stagentServer = createStagentMcpServer(
      conversation.projectId,
      (toolName, result) => { toolResults.push({ toolName, result }); }
    );

    yield { type: "status", phase: "connecting", message: "Connecting to model..." };

    // Read user-configured max turns (Settings → Runtime)
    const maxTurnsSetting = await getSetting(SETTINGS_KEYS.MAX_TURNS);
    const maxTurns = maxTurnsSetting ? parseInt(maxTurnsSetting, 10) || 10 : 10;

    // Merge browser MCP servers when enabled in settings
    const browserServers = await getBrowserMcpServers();
    const browserToolPatterns = await getBrowserAllowedToolPatterns();

    const response = query({
      prompt: generatePrompt(fullPrompt),
      options: {
        model: conversation.modelId || undefined,
        maxTurns,
        abortController,
        includePartialMessages: true,
        cwd: workspace.cwd,
        env: buildClaudeSdkEnv(authEnv),
        mcpServers: { stagent: stagentServer, ...browserServers },
        allowedTools: ["mcp__stagent__*", ...browserToolPatterns],
        // @ts-expect-error Agent SDK canUseTool types are incomplete — our async handler is compatible at runtime
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>
        ): Promise<ToolPermissionResponse> => {
          // Auto-allow safe Stagent tools; gate dangerous ones through permission bridge
          const PERMISSION_GATED_TOOLS = new Set([
            "mcp__stagent__execute_task",
            "mcp__stagent__cancel_task",
            "mcp__stagent__execute_workflow",
            "mcp__stagent__delete_workflow",
            "mcp__stagent__delete_schedule",
            "mcp__stagent__upload_document",
            "mcp__stagent__update_document",
            "mcp__stagent__delete_document",
          ]);
          if (toolName.startsWith("mcp__stagent__") && !PERMISSION_GATED_TOOLS.has(toolName)) {
            // Emit tool-use status so the user sees what the model is doing
            const shortName = toolName.replace("mcp__stagent__", "").replace(/_/g, " ");
            emitSideChannelEvent(conversationId, {
              type: "status",
              phase: "tool_use",
              message: `Using ${shortName}...`,
            });
            return { behavior: "allow", updatedInput: input };
          }

          // Browser tools: auto-allow read-only, gate mutations
          if (isBrowserTool(toolName)) {
            if (isBrowserReadOnly(toolName)) {
              const shortName = toolName
                .replace("mcp__chrome-devtools__", "")
                .replace("mcp__playwright__", "")
                .replace(/_/g, " ");
              emitSideChannelEvent(conversationId, {
                type: "status",
                phase: "tool_use",
                message: `Browser: ${shortName}...`,
              });
              return { behavior: "allow", updatedInput: input };
            }
            // Mutation browser tools fall through to permission check below
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
          return createPendingRequest(requestId, conversationId, systemMsg.id);
        },
      },
    });

    let firstEvent = true;
    let hasStreamedDeltas = false;

    // Screenshot interception state
    const pendingScreenshotTools = new Set<string>(); // tool_use IDs for screenshot tools
    const screenshotAttachments: ScreenshotAttachment[] = [];

    for await (const raw of response as AsyncIterable<
      Record<string, unknown>
    >) {
      if (signal?.aborted) break;

      // Signal that the model has connected and is processing
      if (firstEvent) {
        firstEvent = false;
        yield { type: "status", phase: "generating", message: "Generating response..." };
      }

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
            hasStreamedDeltas = true;
            yield { type: "delta", content: delta.text };
          }
        }
      } else if (raw.type === "content_block_delta") {
        const delta = raw.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          fullText += delta.text;
          hasStreamedDeltas = true;
          yield { type: "delta", content: delta.text };
        }
      } else if (raw.type === "assistant") {
        // Track screenshot tool_use IDs (before the streaming skip)
        const assistantMsg = raw.message as Record<string, unknown> | undefined;
        const assistantBlocks = (assistantMsg?.content ?? raw.content) as Array<Record<string, unknown>> | undefined;
        if (assistantBlocks) {
          for (const block of assistantBlocks) {
            if (
              block.type === "tool_use" &&
              typeof block.name === "string" &&
              SCREENSHOT_TOOL_NAMES.has(block.name) &&
              typeof block.id === "string"
            ) {
              pendingScreenshotTools.add(block.id);
            }
          }
        }

        // Skip if we're already receiving streaming deltas — assistant events
        // are redundant partial messages from includePartialMessages: true
        // and their cumulative text blocks cause duplicate rendering
        if (hasStreamedDeltas) continue;
        // Fallback for non-streaming: extract text from content blocks
        if (assistantBlocks) {
          for (const block of assistantBlocks) {
            if (block.type === "text" && typeof block.text === "string" && !fullText.includes(block.text)) {
              fullText += block.text;
              yield { type: "delta", content: block.text };
            }
          }
        }
      } else if (raw.type === "user" && pendingScreenshotTools.size > 0) {
        // Intercept tool results that contain screenshot image data
        const userMsg = raw.message as Record<string, unknown> | undefined;
        const userContent = userMsg?.content as Array<Record<string, unknown>> | undefined;
        if (userContent) {
          for (const block of userContent) {
            if (block.type === "tool_result" && typeof block.tool_use_id === "string" && pendingScreenshotTools.has(block.tool_use_id)) {
              pendingScreenshotTools.delete(block.tool_use_id);
              // Extract base64 image data from the tool result content
              const resultContent = block.content as Array<Record<string, unknown>> | undefined;
              if (resultContent) {
                for (const item of resultContent) {
                  if (item.type === "image" && typeof item.source === "object" && item.source !== null) {
                    const source = item.source as Record<string, unknown>;
                    if (source.type === "base64" && typeof source.data === "string") {
                      const attachment = await persistScreenshot(source.data, {
                        conversationId,
                        messageId: assistantMsg.id,
                        projectId: conversation.projectId ?? undefined,
                        toolName: `screenshot_${block.tool_use_id}`,
                      });
                      if (attachment) {
                        screenshotAttachments.push(attachment);
                        yield { type: "screenshot" as const, ...attachment };
                      }
                    }
                  }
                }
              }
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
        // Only emit result text as fallback when streaming didn't deliver content.
        // When deltas were active, fullText is already complete — re-emitting
        // the result would duplicate the entire response.
        if (!hasStreamedDeltas || !fullText) {
          const result = raw.result;
          if (typeof result === "string" && result.length > 0) {
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

    // Detect entities for Quick Access pills (tool results + text matching)
    const toolEntities = extractToolResultEntities(toolResults);
    const textEntities = await detectEntities(fullText, conversation.projectId);
    const quickAccess = deduplicateByEntityId([...toolEntities, ...textEntities]);

    // Save usage metadata + quick access links + screenshot attachments
    const metadata = JSON.stringify({
      modelId: usage.modelId ?? conversation.modelId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      ...(quickAccess.length > 0 ? { quickAccess } : {}),
      ...(screenshotAttachments.length > 0 ? { attachments: screenshotAttachments } : {}),
    });
    await db
      .update(chatMessages)
      .set({ metadata })
      .where(eq(chatMessages.id, assistantMsg.id));

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

    if (fullText && fullText.length > 50) {
      // Substantial content was already streamed — complete gracefully with warning
      const warning = `\n\n---\n\n*Response may be incomplete: ${errorMessage}*`;
      fullText += warning;
      yield { type: "delta", content: warning };

      await updateMessageContent(assistantMsg.id, fullText);
      await updateMessageStatus(assistantMsg.id, "complete");

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

      yield { type: "done", messageId: assistantMsg.id, quickAccess: [] };
    } else {
      // No meaningful content — show as error
      await updateMessageContent(
        assistantMsg.id,
        fullText || errorMessage
      );
      await updateMessageStatus(assistantMsg.id, "error");

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
    }
  } finally {
    cleanupConversation(conversationId);
  }
}
