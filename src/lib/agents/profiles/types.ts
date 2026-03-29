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
  runtimeOverrides?: Partial<Record<AgentRuntimeId, ProfileRuntimeOverride>>;
}
