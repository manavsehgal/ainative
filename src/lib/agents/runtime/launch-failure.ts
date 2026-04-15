import {
  getRuntimeCatalogEntry,
  type AgentRuntimeId,
} from "@/lib/agents/runtime/catalog";

export interface RuntimeLaunchProgress {
  hasTurnStarted?: boolean;
  hasToolUse?: boolean;
  hasResult?: boolean;
}

export class RetryableRuntimeLaunchError extends Error {
  runtimeId: AgentRuntimeId;
  cause: unknown;

  constructor(input: {
    runtimeId: AgentRuntimeId;
    message: string;
    cause: unknown;
  }) {
    super(input.message);
    this.name = "RetryableRuntimeLaunchError";
    this.runtimeId = input.runtimeId;
    this.cause = input.cause;
  }
}

function isLikelyRuntimeUnavailableMessage(message: string): boolean {
  const lower = message.toLowerCase();

  return (
    lower.includes("process exited with code") ||
    lower.includes("command not found") ||
    lower.includes("enoent") ||
    lower.includes("not logged in") ||
    lower.includes("authentication") ||
    lower.includes("oauth") ||
    lower.includes("token expired") ||
    lower.includes("api key") ||
    lower.includes("chatgpt sign-in is not configured") ||
    lower.includes("failed to start") ||
    lower.includes("runtime unavailable")
  );
}

export function classifyTaskFailureReason(error: unknown): string {
  if (!(error instanceof Error)) return "sdk_error";
  if (error.name === "AbortError" || error.message.includes("aborted")) {
    return "aborted";
  }
  const lower = error.message.toLowerCase();
  if (
    lower.includes("turn") &&
    (lower.includes("limit") || lower.includes("exhausted") || lower.includes("max"))
  ) {
    return "turn_limit_exceeded";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) return "timeout";
  if (lower.includes("budget")) return "budget_exceeded";
  if (
    lower.includes("authentication") ||
    lower.includes("oauth") ||
    lower.includes("not logged in") ||
    lower.includes("token expired")
  ) {
    return "auth_failed";
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return "rate_limited";
  }
  return "sdk_error";
}

export function toRetryableRuntimeLaunchError(input: {
  runtimeId: AgentRuntimeId;
  error: unknown;
  progress: RuntimeLaunchProgress;
}): RetryableRuntimeLaunchError | null {
  if (!(input.error instanceof Error)) {
    return null;
  }

  if (
    input.progress.hasTurnStarted ||
    input.progress.hasToolUse ||
    input.progress.hasResult
  ) {
    return null;
  }

  if (!isLikelyRuntimeUnavailableMessage(input.error.message)) {
    return null;
  }

  const label = getRuntimeCatalogEntry(input.runtimeId).label;
  return new RetryableRuntimeLaunchError({
    runtimeId: input.runtimeId,
    message: `${label} failed to launch before task execution started: ${input.error.message}`,
    cause: input.error,
  });
}
