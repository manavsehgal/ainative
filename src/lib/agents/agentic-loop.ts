/**
 * Provider-agnostic agentic loop for direct API runtimes.
 *
 * The loop handles turn counting, budget tracking, abort signaling,
 * and HITL tool permission checks. Provider-specific logic (API calls,
 * event mapping, tool result formatting) is injected via callbacks.
 */

import type { ToolResult } from "@/lib/chat/tool-registry";
import type { ToolPermissionResponse } from "./tool-permissions";

// ── Types ────────────────────────────────────────────────────────────

/** A single tool call extracted from the model response. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Usage snapshot from a single model turn. */
export interface TurnUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  modelId?: string;
  costUsd?: number;
}

/** Events emitted during the loop for SSE streaming. */
export type AgentStreamEvent =
  | { type: "status"; phase: "running" | "tool_use" | "thinking"; message?: string }
  | { type: "delta"; content: string }
  | { type: "done"; finalText: string }
  | { type: "error"; message: string };

/** Result of a single model API call (accumulated from stream). */
export interface ModelTurnResult {
  /** Concatenated text output from the model. */
  text: string;
  /** Tool calls requested by the model. */
  toolCalls: ToolCall[];
  /** Whether the model indicated it is done (end_turn / stop). */
  isComplete: boolean;
  /** Whether output was truncated by max_tokens. */
  needsContinuation: boolean;
  /** Usage for this turn. */
  usage: TurnUsage;
}

/** Message in the conversation history (provider-agnostic shape). */
export type LoopMessage = Record<string, unknown>;

/** Configuration for the agentic loop — provider injects callbacks. */
export interface AgenticLoopConfig {
  /**
   * Call the model API with the current messages. Must stream events
   * via `emitEvent` and return the accumulated turn result.
   */
  callModel: (
    messages: LoopMessage[],
    signal: AbortSignal,
  ) => Promise<ModelTurnResult>;

  /** Format a tool result for appending to the message history. */
  formatToolResult: (
    toolCallId: string,
    toolName: string,
    result: ToolResult,
  ) => LoopMessage;

  /** Format a continuation message (e.g. after max_tokens truncation). */
  formatContinuation: () => LoopMessage;

  /** Execute a ainative tool by name. */
  executeTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<ToolResult>;

  /** HITL permission check. Return allow/deny. */
  checkPermission: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<ToolPermissionResponse>;

  /** Emit SSE event for real-time UI streaming. */
  emitEvent: (event: AgentStreamEvent) => void;

  /** Maximum model turns before stopping. */
  maxTurns: number;

  /** Maximum budget in USD before stopping. */
  maxBudgetUsd?: number;

  /** Abort signal for cancellation. */
  signal: AbortSignal;
}

/** Result of the agentic loop. */
export interface AgenticLoopResult {
  finalText: string;
  turnCount: number;
  totalUsage: TurnUsage;
  stopReason: "complete" | "max_turns" | "budget_exceeded" | "cancelled" | "error";
  /**
   * When `stopReason === "error"` or `"budget_exceeded"`, holds the underlying
   * cause string. Adapters surface this in the task `result` field so the
   * failure is debuggable instead of opaque ("Task stopped: error").
   */
  errorMessage?: string;
}

// ── Loop implementation ──────────────────────────────────────────────

function mergeTurnUsage(total: TurnUsage, turn: TurnUsage): TurnUsage {
  return {
    inputTokens: (total.inputTokens ?? 0) + (turn.inputTokens ?? 0),
    outputTokens: (total.outputTokens ?? 0) + (turn.outputTokens ?? 0),
    totalTokens: (total.totalTokens ?? 0) + (turn.totalTokens ?? 0),
    modelId: turn.modelId ?? total.modelId,
    costUsd: (total.costUsd ?? 0) + (turn.costUsd ?? 0),
  };
}

/**
 * Run a provider-agnostic agentic loop.
 *
 * Repeatedly calls the model, handles tool execution with HITL checks,
 * and enforces turn/budget limits until the model completes or a limit
 * is reached.
 */
export async function runAgenticLoop(
  initialMessages: LoopMessage[],
  config: AgenticLoopConfig,
): Promise<AgenticLoopResult> {
  const messages = [...initialMessages];
  let turnCount = 0;
  let totalUsage: TurnUsage = {};
  let lastText = "";

  while (turnCount < config.maxTurns) {
    // Check cancellation
    if (config.signal.aborted) {
      return { finalText: lastText, turnCount, totalUsage, stopReason: "cancelled" };
    }

    // Check budget
    if (config.maxBudgetUsd && (totalUsage.costUsd ?? 0) >= config.maxBudgetUsd) {
      const message = `Budget limit exceeded ($${config.maxBudgetUsd.toFixed(2)})`;
      config.emitEvent({ type: "error", message });
      return { finalText: lastText, turnCount, totalUsage, stopReason: "budget_exceeded", errorMessage: message };
    }

    // Call model
    turnCount++;
    let turnResult: ModelTurnResult;

    try {
      turnResult = await config.callModel(messages, config.signal);
    } catch (err) {
      if (config.signal.aborted) {
        return { finalText: lastText, turnCount, totalUsage, stopReason: "cancelled" };
      }
      const message = err instanceof Error ? err.message : "Model API call failed";
      config.emitEvent({ type: "error", message });
      return { finalText: lastText, turnCount, totalUsage, stopReason: "error", errorMessage: message };
    }

    totalUsage = mergeTurnUsage(totalUsage, turnResult.usage);
    if (turnResult.text) lastText = turnResult.text;

    // Handle completion
    if (turnResult.isComplete && turnResult.toolCalls.length === 0) {
      config.emitEvent({ type: "done", finalText: lastText });
      return { finalText: lastText, turnCount, totalUsage, stopReason: "complete" };
    }

    // Handle tool calls
    if (turnResult.toolCalls.length > 0) {
      for (const toolCall of turnResult.toolCalls) {
        if (config.signal.aborted) {
          return { finalText: lastText, turnCount, totalUsage, stopReason: "cancelled" };
        }

        config.emitEvent({
          type: "status",
          phase: "tool_use",
          message: toolCall.name,
        });

        // HITL permission check
        const permission = await config.checkPermission(
          toolCall.name,
          toolCall.arguments,
        );

        let result: ToolResult;
        if (permission.behavior === "deny") {
          result = {
            content: [{ type: "text", text: JSON.stringify({ error: permission.message ?? "Tool denied by user" }) }],
            isError: true,
          };
        } else {
          try {
            result = await config.executeTool(
              toolCall.name,
              (permission.updatedInput as Record<string, unknown>) ?? toolCall.arguments,
            );
          } catch (err) {
            result = {
              content: [{ type: "text", text: JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed" }) }],
              isError: true,
            };
          }
        }

        // Append tool result to messages
        messages.push(
          config.formatToolResult(toolCall.id, toolCall.name, result),
        );
      }

      // Continue loop — model needs to process tool results
      continue;
    }

    // Handle max_tokens continuation
    if (turnResult.needsContinuation) {
      messages.push(config.formatContinuation());
      continue;
    }

    // Shouldn't reach here — safeguard
    config.emitEvent({ type: "done", finalText: lastText });
    return { finalText: lastText, turnCount, totalUsage, stopReason: "complete" };
  }

  // Max turns exceeded
  config.emitEvent({ type: "error", message: `Max turns (${config.maxTurns}) reached` });
  return { finalText: lastText, turnCount, totalUsage, stopReason: "max_turns" };
}
