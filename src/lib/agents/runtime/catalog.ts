export const SUPPORTED_AGENT_RUNTIMES = [
  "claude-code",
  "openai-codex-app-server",
  "anthropic-direct",
  "openai-direct",
  "ollama",
] as const;

export type AgentRuntimeId = (typeof SUPPORTED_AGENT_RUNTIMES)[number];

export const DEFAULT_AGENT_RUNTIME: AgentRuntimeId = "claude-code";

export interface RuntimeCapabilities {
  resume: boolean;
  cancel: boolean;
  approvals: boolean;
  mcpServers: boolean;
  profileTests: boolean;
  taskAssist: boolean;
  profileAssist: boolean;
  authHealthCheck: boolean;
}

export interface RuntimeModelConfig {
  /** Default model ID for this runtime */
  default: string;
  /** All supported model IDs for this runtime */
  supported: string[];
}

export interface RuntimeCatalogEntry {
  id: AgentRuntimeId;
  label: string;
  description: string;
  providerId: "anthropic" | "openai" | "ollama";
  capabilities: RuntimeCapabilities;
  /** Model catalog — default and supported model IDs for this runtime */
  models: RuntimeModelConfig;
}

const RUNTIME_CATALOG: Record<AgentRuntimeId, RuntimeCatalogEntry> = {
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    description: "Anthropic Claude Agent SDK runtime with approvals, resume, and MCP passthrough.",
    providerId: "anthropic",
    capabilities: {
      resume: true,
      cancel: true,
      approvals: true,
      mcpServers: true,
      profileTests: true,
      taskAssist: true,
      profileAssist: true,
      authHealthCheck: true,
    },
    models: {
      default: "sonnet",
      supported: ["haiku", "sonnet", "opus"],
    },
  },
  "openai-codex-app-server": {
    id: "openai-codex-app-server",
    label: "OpenAI Codex App Server",
    description: "OpenAI Codex runtime over the app server protocol with resumable threads and inbox approvals.",
    providerId: "openai",
    capabilities: {
      resume: true,
      cancel: true,
      approvals: true,
      mcpServers: false,
      profileTests: false,
      taskAssist: true,
      profileAssist: false,
      authHealthCheck: true,
    },
    models: {
      default: "gpt-5.4",
      supported: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex"],
    },
  },
  "anthropic-direct": {
    id: "anthropic-direct",
    label: "Anthropic Direct API",
    description: "Direct Anthropic Messages API — fast, cost-optimized, no CLI required.",
    providerId: "anthropic",
    capabilities: {
      resume: true,
      cancel: true,
      approvals: true,
      mcpServers: true,
      profileTests: false,
      taskAssist: true,
      profileAssist: true,
      authHealthCheck: true,
    },
    models: {
      default: "claude-sonnet-4-20250514",
      supported: ["claude-haiku-4-5-20251001", "claude-sonnet-4-20250514", "claude-opus-4-20250514"],
    },
  },
  "openai-direct": {
    id: "openai-direct",
    label: "OpenAI Direct API",
    description: "Direct OpenAI Responses API — server-side tools, web search, code interpreter.",
    providerId: "openai",
    capabilities: {
      resume: true,
      cancel: true,
      approvals: true,
      mcpServers: false,
      profileTests: false,
      taskAssist: true,
      profileAssist: false,
      authHealthCheck: true,
    },
    models: {
      default: "gpt-4.1",
      supported: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"],
    },
  },
  ollama: {
    id: "ollama",
    label: "Ollama (Local)",
    description: "Local model execution via Ollama — free, private, no API key required.",
    providerId: "ollama",
    capabilities: {
      resume: false,
      cancel: true,
      approvals: false,
      mcpServers: false,
      profileTests: false,
      taskAssist: true,
      profileAssist: false,
      authHealthCheck: true,
    },
    models: {
      default: "llama3",
      supported: [],  // Dynamic — populated from Ollama API at runtime
    },
  },
};

export function isAgentRuntimeId(value: string): value is AgentRuntimeId {
  return SUPPORTED_AGENT_RUNTIMES.includes(value as AgentRuntimeId);
}

export function getRuntimeCatalogEntry(
  runtimeId: AgentRuntimeId = DEFAULT_AGENT_RUNTIME
): RuntimeCatalogEntry {
  return RUNTIME_CATALOG[runtimeId];
}

export function getRuntimeCapabilities(
  runtimeId: AgentRuntimeId = DEFAULT_AGENT_RUNTIME
): RuntimeCapabilities {
  return getRuntimeCatalogEntry(runtimeId).capabilities;
}

export function resolveAgentRuntime(runtimeId?: string | null): AgentRuntimeId {
  if (!runtimeId) return DEFAULT_AGENT_RUNTIME;
  if (isAgentRuntimeId(runtimeId)) return runtimeId;
  console.warn(`Unknown agent runtime "${runtimeId}", falling back to "${DEFAULT_AGENT_RUNTIME}"`);
  return DEFAULT_AGENT_RUNTIME;
}

export function listRuntimeCatalog(): RuntimeCatalogEntry[] {
  return SUPPORTED_AGENT_RUNTIMES.map((runtimeId) => RUNTIME_CATALOG[runtimeId]);
}
