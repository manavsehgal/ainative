import {
  getRuntimeCatalogEntry,
  SUPPORTED_AGENT_RUNTIMES,
  type AgentRuntimeId,
} from "@/lib/agents/runtime/catalog";
import { getAuthSettings } from "./auth";
import { getOpenAIAuthSettings } from "./openai-auth";
import type { ApiKeySource, AuthMethod } from "@/lib/constants/settings";

export type RuntimeBillingMode = "usage" | "subscription";
export type RuntimeSetupMethod = AuthMethod | "none";

export interface RuntimeSetupState {
  runtimeId: AgentRuntimeId;
  label: string;
  providerId: "anthropic" | "openai";
  configured: boolean;
  authMethod: RuntimeSetupMethod;
  apiKeySource: ApiKeySource;
  billingMode: RuntimeBillingMode;
}

export async function getRuntimeSetupStates(): Promise<
  Record<AgentRuntimeId, RuntimeSetupState>
> {
  const [claudeAuth, openAIAuth] = await Promise.all([
    getAuthSettings(),
    getOpenAIAuthSettings(),
  ]);

  const claudeRuntime = getRuntimeCatalogEntry("claude-code");
  const openAIRuntime = getRuntimeCatalogEntry("openai-codex-app-server");

  const claudeAuthMethod: RuntimeSetupMethod =
    claudeAuth.method === "oauth" || claudeAuth.apiKeySource === "oauth"
      ? "oauth"
      : claudeAuth.hasKey
        ? "api_key"
        : "none";
  const claudeConfigured =
    claudeAuth.hasKey || claudeAuth.apiKeySource === "oauth";

  const states = {
    "claude-code": {
      runtimeId: "claude-code",
      label: claudeRuntime.label,
      providerId: claudeRuntime.providerId,
      configured: claudeConfigured,
      authMethod: claudeAuthMethod,
      apiKeySource: claudeAuth.apiKeySource,
      billingMode: claudeAuthMethod === "oauth" ? "subscription" : "usage",
    },
    "openai-codex-app-server": {
      runtimeId: "openai-codex-app-server",
      label: openAIRuntime.label,
      providerId: openAIRuntime.providerId,
      configured: openAIAuth.hasKey,
      authMethod: openAIAuth.hasKey ? "api_key" : "none",
      apiKeySource: openAIAuth.apiKeySource,
      billingMode: "usage",
    },
    "anthropic-direct": {
      runtimeId: "anthropic-direct",
      label: getRuntimeCatalogEntry("anthropic-direct").label,
      providerId: "anthropic",
      configured: claudeConfigured, // Shares Anthropic API key
      authMethod: claudeAuth.hasKey ? "api_key" : "none",
      apiKeySource: claudeAuth.apiKeySource,
      billingMode: "usage",
    },
    "openai-direct": {
      runtimeId: "openai-direct",
      label: getRuntimeCatalogEntry("openai-direct").label,
      providerId: "openai",
      configured: openAIAuth.hasKey, // Shares OpenAI API key
      authMethod: openAIAuth.hasKey ? "api_key" : "none",
      apiKeySource: openAIAuth.apiKeySource,
      billingMode: "usage",
    },
  } satisfies Record<AgentRuntimeId, RuntimeSetupState>;

  return states;
}

export function listConfiguredRuntimeIds(
  states: Record<AgentRuntimeId, RuntimeSetupState>
) {
  return SUPPORTED_AGENT_RUNTIMES.filter((runtimeId) => states[runtimeId].configured);
}
