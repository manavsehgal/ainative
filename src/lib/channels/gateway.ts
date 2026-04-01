/**
 * Channel Gateway — bridges inbound channel messages to the chat engine.
 *
 * Flow: Inbound webhook → gateway → sendMessage() (existing chat engine)
 *       → accumulate deltas → sendReply() back to channel thread.
 */

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { channelConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getBindingByConfigAndThread,
  createBinding,
  setPendingRequest,
} from "@/lib/data/channel-bindings";
import { createConversation } from "@/lib/data/chat";
import { sendMessage } from "@/lib/chat/engine";
import {
  resolvePendingRequest,
  type ToolPermissionResponse,
} from "@/lib/chat/permission-bridge";
import { getChannelAdapter } from "./registry";
import type { ChannelMessage, InboundMessage } from "./types";

// ── Turn lock ──────────────────────────────────────────────────────────

/** In-memory lock: one turn per conversation at a time. */
const activeTurns = new Map<string, Promise<void>>();

// ── Permission reply parsing ───────────────────────────────────────────

const APPROVE_PATTERNS = /^(approve|yes|allow|ok|y)$/i;
const DENY_PATTERNS = /^(deny|no|reject|n)$/i;
const ALWAYS_ALLOW_PATTERNS = /^(always\s*allow)$/i;

function parsePermissionReply(
  text: string
): ToolPermissionResponse | null {
  const trimmed = text.trim();
  if (ALWAYS_ALLOW_PATTERNS.test(trimmed)) {
    return { behavior: "allow" };
  }
  if (APPROVE_PATTERNS.test(trimmed)) {
    return { behavior: "allow" };
  }
  if (DENY_PATTERNS.test(trimmed)) {
    return { behavior: "deny" };
  }
  return null;
}

// ── Default runtime/model for channel conversations ────────────────────

const DEFAULT_RUNTIME = "claude-code";
const DEFAULT_MODEL = "sonnet";

// ── Public API ─────────────────────────────────────────────────────────

export interface HandleInboundParams {
  channelConfigId: string;
  message: InboundMessage;
}

export interface GatewayResult {
  success: boolean;
  conversationId?: string;
  error?: string;
}

/**
 * Handle an inbound message from a channel.
 *
 * 1. Resolve or create binding (channel+thread → conversation)
 * 2. Check turn lock
 * 3. If pending permission request, treat as permission reply
 * 4. Otherwise, feed to chat engine and send response back
 */
export async function handleInboundMessage(
  params: HandleInboundParams
): Promise<GatewayResult> {
  const { channelConfigId, message } = params;

  // Fetch channel config
  const config = await db
    .select()
    .from(channelConfigs)
    .where(eq(channelConfigs.id, channelConfigId))
    .get();

  if (!config) {
    return { success: false, error: "Channel config not found" };
  }
  if (config.status === "disabled") {
    return { success: false, error: "Channel is disabled" };
  }
  if (config.direction !== "bidirectional") {
    return { success: false, error: "Channel is outbound-only" };
  }

  // Skip bot messages to prevent loops
  if (message.isBot) {
    return { success: true };
  }

  // Resolve or create binding
  let binding = getBindingByConfigAndThread(
    channelConfigId,
    message.externalThreadId ?? null
  );

  if (!binding) {
    // Create new conversation + binding
    const conversation = await createConversation({
      runtimeId: DEFAULT_RUNTIME,
      modelId: DEFAULT_MODEL,
      title: `Channel: ${config.name}`,
    });

    const bindingId = randomUUID();
    const now = new Date();
    createBinding({
      id: bindingId,
      channelConfigId,
      conversationId: conversation.id,
      externalThreadId: message.externalThreadId ?? null,
      runtimeId: DEFAULT_RUNTIME,
      modelId: DEFAULT_MODEL,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    binding = {
      id: bindingId,
      channelConfigId,
      conversationId: conversation.id,
      externalThreadId: message.externalThreadId ?? null,
      runtimeId: DEFAULT_RUNTIME,
      modelId: DEFAULT_MODEL,
      profileId: null,
      status: "active" as const,
      pendingRequestId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  const conversationId = binding.conversationId;

  // Handle pending permission request
  if (binding.pendingRequestId) {
    const response = parsePermissionReply(message.text);
    if (response) {
      resolvePendingRequest(binding.pendingRequestId, response);
      setPendingRequest(binding.id, null);
      return { success: true, conversationId };
    }
    // Not a valid permission reply — send guidance
    await sendChannelReply(
      config,
      message.externalThreadId,
      "Please reply with **approve** or **deny** to the pending permission request."
    );
    return { success: true, conversationId };
  }

  // Check turn lock
  if (activeTurns.has(conversationId)) {
    await sendChannelReply(
      config,
      message.externalThreadId,
      "Still processing your previous message. Please wait..."
    );
    return { success: true, conversationId };
  }

  // Process the turn
  const turnPromise = processTurn(
    config,
    binding,
    message
  );
  activeTurns.set(conversationId, turnPromise);

  try {
    await turnPromise;
  } finally {
    activeTurns.delete(conversationId);
  }

  return { success: true, conversationId };
}

// ── Turn processing ────────────────────────────────────────────────────

async function processTurn(
  config: typeof channelConfigs.$inferSelect,
  binding: {
    id: string;
    conversationId: string;
    externalThreadId: string | null;
  },
  message: InboundMessage
): Promise<void> {
  let fullResponse = "";

  try {
    for await (const event of sendMessage(binding.conversationId, message.text)) {
      switch (event.type) {
        case "delta":
          fullResponse += event.content;
          break;

        case "permission_request": {
          // Send permission prompt to channel
          const prompt = formatPermissionPrompt(
            event.toolName,
            event.toolInput
          );
          await sendChannelReply(config, binding.externalThreadId, prompt);

          // Track pending request on binding
          setPendingRequest(binding.id, event.requestId);

          // The stream is now blocked waiting for permission resolution.
          // The next inbound message will resolve it via handleInboundMessage.
          // We continue iterating — the generator will yield once unblocked.
          break;
        }

        case "question": {
          // Format questions for channel display
          const questionText = event.questions
            .map((q, i) => {
              let line = `**${q.header || `Question ${i + 1}`}**: ${q.question}`;
              if (q.options) {
                line += "\n" + q.options.map((o) => `  - ${o.label}: ${o.description}`).join("\n");
              }
              return line;
            })
            .join("\n\n");
          await sendChannelReply(config, binding.externalThreadId, questionText);
          break;
        }

        case "error":
          fullResponse = `Error: ${event.message}`;
          break;

        case "done":
          // Stream complete — break out of loop
          break;

        // Ignore: status, screenshot events (not meaningful in channel context)
        default:
          break;
      }

      if (event.type === "done" || event.type === "error") break;
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    fullResponse = `Error processing message: ${errorMsg}`;
    console.error(`[gateway] Error in processTurn for ${binding.conversationId}:`, err);
  }

  // Send accumulated response back to channel
  if (fullResponse.trim()) {
    await sendChannelReply(config, binding.externalThreadId, fullResponse);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function sendChannelReply(
  config: typeof channelConfigs.$inferSelect,
  threadId: string | null | undefined,
  body: string
): Promise<void> {
  const adapter = getChannelAdapter(config.channelType);
  let parsedConfig: Record<string, unknown>;
  try {
    parsedConfig = JSON.parse(config.config) as Record<string, unknown>;
  } catch {
    console.error(`[gateway] Invalid config JSON for channel ${config.id}`);
    return;
  }

  const message: ChannelMessage = {
    subject: "",
    body,
    format: "markdown",
  };

  // Prefer sendReply (thread-aware) if available, otherwise fall back to send
  if (adapter.sendReply && threadId) {
    await adapter.sendReply(message, parsedConfig, threadId);
  } else {
    await adapter.send(message, parsedConfig);
  }
}

function formatPermissionPrompt(
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  const inputPreview = JSON.stringify(toolInput, null, 2).slice(0, 500);
  return [
    `**Permission required:** \`${toolName}\``,
    "",
    "```json",
    inputPreview,
    "```",
    "",
    "Reply with:",
    "- **approve** — allow this action",
    "- **deny** — block this action",
    "- **always allow** — allow this tool permanently",
  ].join("\n");
}
