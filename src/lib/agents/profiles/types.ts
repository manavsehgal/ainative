import type { AgentRuntimeId } from "@/lib/agents/runtime/catalog";
import type { ImportMeta } from "@/lib/validators/profile";

export interface CanUseToolPolicy {
  autoApprove?: string[];
  autoDeny?: string[];
}

export interface ProfileSmokeTest {
  task: string;
  expectedKeywords: string[];
}

export interface ProfileRuntimeOverride {
  instructions?: string;
  allowedTools?: string[];
  mcpServers?: Record<string, unknown>;
  canUseToolPolicy?: CanUseToolPolicy;
  tests?: ProfileSmokeTest[];
}

export interface ProfileRuntimeCapabilityOverride {
  /** Override model ID for this runtime (e.g., "claude-opus-4-20250514"). */
  modelId?: string;
  /** Enable extended thinking (Anthropic Direct only). */
  extendedThinking?: { enabled: boolean; budgetTokens?: number };
  /** Server-side tools to enable (e.g., { web_search: true }). */
  serverTools?: Record<string, boolean>;
}

export type ProfileScope = "builtin" | "user" | "project";

/** How a profile entered the system — distinct from scope (where it lives). */
export type ProfileOrigin = "manual" | "environment" | "import" | "ai-assist";

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  domain: string;
  tags: string[];
  /** @deprecated Use skillMd instead — kept for backward compat during migration */
  systemPrompt: string;
  /** Full content of the SKILL.md file (system prompt + behavioral instructions) */
  skillMd: string;
  allowedTools?: string[];
  mcpServers?: Record<string, unknown>;
  canUseToolPolicy?: CanUseToolPolicy;
  maxTurns?: number;
  outputFormat?: string;
  version?: string;
  author?: string;
  source?: string;
  tests?: ProfileSmokeTest[];
  importMeta?: ImportMeta;
  supportedRuntimes: AgentRuntimeId[];
  /** Preferred runtime for auto-routing. When set, suggestRuntime() prefers this. */
  preferredRuntime?: AgentRuntimeId;
  runtimeOverrides?: Partial<Record<AgentRuntimeId, ProfileRuntimeOverride>>;
  /** Per-runtime capability overrides (model, extended thinking, server tools). */
  capabilityOverrides?: Partial<Record<AgentRuntimeId, ProfileRuntimeCapabilityOverride>>;
  /** Scope: builtin (shipped), user (~/.claude/skills/), or project (.claude/skills/) */
  scope?: ProfileScope;
  /** How this profile was created — manual, environment, import, or ai-assist */
  origin?: ProfileOrigin;
  /** Whether this profile is read-only (true for project-scoped profiles) */
  readOnly?: boolean;
  /** Absolute path to the project directory (only set for project-scoped profiles) */
  projectDir?: string;
}
