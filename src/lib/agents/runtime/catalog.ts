export const SUPPORTED_AGENT_RUNTIMES = [
  "claude-code",
  "openai-codex-app-server",
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
  authHealthCheck: boolean;
}

export interface RuntimeCatalogEntry {
  id: AgentRuntimeId;
  label: string;
  description: string;
  capabilities: RuntimeCapabilities;
}

const RUNTIME_CATALOG: Record<AgentRuntimeId, RuntimeCatalogEntry> = {
  "claude-code": {
    id: "claude-code",
    label: "Claude Code",
    description: "Anthropic Claude Agent SDK runtime with approvals, resume, and MCP passthrough.",
    capabilities: {
      resume: true,
      cancel: true,
      approvals: true,
      mcpServers: true,
      profileTests: true,
      taskAssist: true,
      authHealthCheck: true,
    },
  },
  "openai-codex-app-server": {
    id: "openai-codex-app-server",
    label: "OpenAI Codex App Server",
    description: "OpenAI Codex runtime over the app server protocol with resumable threads and inbox approvals.",
    capabilities: {
      resume: true,
      cancel: true,
      approvals: true,
      mcpServers: true,
      profileTests: false,
      taskAssist: true,
      authHealthCheck: true,
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
  throw new Error(`Unknown agent type: ${runtimeId}`);
}

export function listRuntimeCatalog(): RuntimeCatalogEntry[] {
  return SUPPORTED_AGENT_RUNTIMES.map((runtimeId) => RUNTIME_CATALOG[runtimeId]);
}
