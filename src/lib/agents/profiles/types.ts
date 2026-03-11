export interface CanUseToolPolicy {
  autoApprove?: string[];
  autoDeny?: string[];
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
  temperature?: number;
  maxTurns?: number;
  outputFormat?: string;
  version?: string;
  author?: string;
  source?: string;
  tests?: Array<{ task: string; expectedKeywords: string[] }>;
}
