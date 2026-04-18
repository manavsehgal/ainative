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

/**
 * LLM-surface features that affect what the model sees and which tools/skills
 * Stagent exposes to it. Distinct from RuntimeCapabilities above, which is
 * adapter-plumbing concerns (can the adapter resume/cancel/etc.).
 *
 * Values reflect post-Phase-1 capability (what the runtime SDK *can* do),
 * not current engagement (what `engine.ts` currently activates). Downstream
 * features read this bag to decide rendering, filtering, and dispatch.
 */
export interface RuntimeFeatures {
  /** SDK provides a native skill-invocation tool (e.g. Claude SDK `Skill` tool). */
  hasNativeSkills: boolean;
  /** SDK loads skill metadata first, full SKILL.md on demand. */
  hasProgressiveDisclosure: boolean;
  /** Read/Grep/Glob/Edit/Write available as LLM tools. */
  hasFilesystemTools: boolean;
  /** Bash tool available (Stagent gates via permission bridge). */
  hasBash: boolean;
  /** TodoWrite tool available. */
  hasTodoWrite: boolean;
  /** Runtime supports delegating to sub-agents (e.g. Task tool). */
  hasSubagentDelegation: boolean;
  /** Runtime loads filesystem hooks (pre/post tool-use shell scripts). */
  hasHooks: boolean;
  /** Which project-level instructions file the runtime auto-loads, if any. */
  autoLoadsInstructions: "CLAUDE.md" | "AGENTS.md" | null;
  /**
   * Runtime has no native skill support — Stagent must inject SKILL.md content
   * into the system prompt to expose skills to the LLM.
   */
  ainativeInjectsSkills: boolean;
  /**
   * Runtime supports composing multiple active skills in one conversation.
   * When false, only one skill may be active at a time (Ollama: context
   * budget too tight). When true, `activate_skill mode:"add"` is allowed
   * up to `maxActiveSkills`.
   */
  supportsSkillComposition: boolean;
  /**
   * Maximum number of skills that may be simultaneously active. Enforced
   * by the activate_skill tool. Ignored when supportsSkillComposition=false.
   */
  maxActiveSkills: number;
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
  features: RuntimeFeatures;
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
    features: {
      hasNativeSkills: true,
      hasProgressiveDisclosure: true,
      hasFilesystemTools: true,
      hasBash: true,
      hasTodoWrite: true,
      hasSubagentDelegation: false, // Stagent task primitives replace SDK Task tool
      hasHooks: false, // excluded per Q2
      autoLoadsInstructions: "CLAUDE.md",
      ainativeInjectsSkills: false,
      supportsSkillComposition: true,
      maxActiveSkills: 3,
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
    features: {
      hasNativeSkills: true,
      hasProgressiveDisclosure: true,
      hasFilesystemTools: true,
      hasBash: true,
      hasTodoWrite: true,
      hasSubagentDelegation: false,
      hasHooks: false,
      autoLoadsInstructions: "AGENTS.md",
      ainativeInjectsSkills: false,
      supportsSkillComposition: true,
      maxActiveSkills: 3,
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
    features: {
      // Direct Messages API — no SDK-native skill machinery.
      // Revisit when chat-claude-sdk-skills designs direct-API skill injection.
      hasNativeSkills: false,
      hasProgressiveDisclosure: false,
      hasFilesystemTools: false,
      hasBash: false,
      hasTodoWrite: false,
      hasSubagentDelegation: false,
      hasHooks: false,
      autoLoadsInstructions: null,
      ainativeInjectsSkills: false,
      supportsSkillComposition: true,
      maxActiveSkills: 3,
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
    features: {
      // Direct Responses API — no SDK-native skill machinery.
      // Revisit when chat-claude-sdk-skills designs direct-API skill injection.
      hasNativeSkills: false,
      hasProgressiveDisclosure: false,
      hasFilesystemTools: false,
      hasBash: false,
      hasTodoWrite: false,
      hasSubagentDelegation: false,
      hasHooks: false,
      autoLoadsInstructions: null,
      ainativeInjectsSkills: false,
      supportsSkillComposition: true,
      maxActiveSkills: 3,
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
    features: {
      hasNativeSkills: false,
      hasProgressiveDisclosure: false,
      hasFilesystemTools: false,
      hasBash: false,
      hasTodoWrite: false, // Stagent MCP exposes todo tools separately
      hasSubagentDelegation: false,
      hasHooks: false,
      autoLoadsInstructions: null,
      ainativeInjectsSkills: true,
      supportsSkillComposition: false,
      maxActiveSkills: 1,
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

export function getRuntimeFeatures(
  runtimeId: AgentRuntimeId = DEFAULT_AGENT_RUNTIME
): RuntimeFeatures {
  return getRuntimeCatalogEntry(runtimeId).features;
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
