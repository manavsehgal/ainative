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

/** Available chat models by provider */
export const CHAT_MODELS: ChatModelOption[] = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5", provider: "anthropic", tier: "Fast", costLabel: "$" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", provider: "anthropic", tier: "Balanced", costLabel: "$$" },
  { id: "claude-opus-4-6", label: "Opus 4.6", provider: "anthropic", tier: "Best", costLabel: "$$$" },
  { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai", tier: "Fast", costLabel: "$" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", tier: "Balanced", costLabel: "$$" },
];

export const DEFAULT_CHAT_MODEL = "claude-haiku-4-5";

/** Model → runtime mapping (derived from model's provider) */
export function getRuntimeForModel(modelId: string): string {
  const model = CHAT_MODELS.find((m) => m.id === modelId);
  return model?.provider === "openai" ? "openai-codex-app-server" : "claude-code";
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
