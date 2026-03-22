/** Chat stream event types sent to the client via SSE */
export type ChatStreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; messageId: string; quickAccess: QuickAccessItem[] }
  | { type: "error"; message: string };

/** Entity link detected in an assistant response */
export interface QuickAccessItem {
  entityType: "project" | "task" | "workflow" | "document" | "schedule";
  entityId: string;
  label: string;
  href: string;
}

/** Model catalog entry for the chat model selector */
export interface ChatModelOption {
  id: string;
  label: string;
  provider: "anthropic" | "openai";
  tier: string; // "Fast" | "Balanced" | "Best"
  costLabel: string; // "$" | "$$" | "$$$"
}

/** Runtime → provider mapping */
export function getProviderForRuntime(runtimeId: string): "anthropic" | "openai" {
  return runtimeId === "openai-codex-app-server" ? "openai" : "anthropic";
}

/** Available chat models by provider (fallback when SDKs are unreachable).
 *  IDs must match what the SDKs actually accept:
 *  - Claude SDK: "haiku", "sonnet", "opus" (short names)
 *  - Codex App Server: "gpt-5.4", "gpt-5.3-codex", etc. */
export const CHAT_MODELS: ChatModelOption[] = [
  // Anthropic — uses SDK short names
  { id: "haiku", label: "Haiku", provider: "anthropic", tier: "Fast", costLabel: "$" },
  { id: "sonnet", label: "Sonnet", provider: "anthropic", tier: "Balanced", costLabel: "$$" },
  { id: "opus", label: "Opus", provider: "anthropic", tier: "Best", costLabel: "$$$" },
  // OpenAI — GPT-5.x / Codex family
  { id: "gpt-5.3-codex-spark", label: "Codex Spark", provider: "openai", tier: "Fast", costLabel: "$" },
  { id: "gpt-5.3-codex", label: "Codex 5.3", provider: "openai", tier: "Balanced", costLabel: "$$" },
  { id: "gpt-5.4", label: "GPT-5.4", provider: "openai", tier: "Best", costLabel: "$$$" },
];

export const DEFAULT_CHAT_MODEL = "haiku";

/** Model → runtime mapping (derived from model's provider or ID prefix) */
export function getRuntimeForModel(modelId: string): string {
  const model = CHAT_MODELS.find((m) => m.id === modelId);
  if (model) return model.provider === "openai" ? "openai-codex-app-server" : "claude-code";
  // Fallback: OpenAI models start with "gpt" or "o"
  return /^(gpt|o\d)/.test(modelId) ? "openai-codex-app-server" : "claude-code";
}

/** Suggested prompt category with expandable sub-prompts */
export interface PromptCategory {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  prompts: SuggestedPrompt[];
}

/** Individual suggested prompt with short label and detailed text */
export interface SuggestedPrompt {
  label: string;  // Short display text for dropdown (~40 chars)
  prompt: string; // Full detailed prompt text for hover preview and fill
}
