export interface ProfileAssistRequest {
  /** Natural language description of desired agent */
  goal: string;
  /** Optional domain hint */
  domain?: "work" | "personal";
  /** Operation mode */
  mode: "generate" | "refine-skillmd" | "suggest-tests";
  /** Existing SKILL.md for refine/suggest-tests modes */
  existingSkillMd?: string;
  /** Existing tags for context */
  existingTags?: string[];
}

export interface ProfileAssistResponse {
  name: string;
  description: string;
  domain: "work" | "personal";
  tags: string[];
  skillMd: string;
  allowedTools: string[];
  canUseToolPolicy: {
    autoApprove: string[];
    autoDeny: string[];
  };
  maxTurns: number;
  outputFormat: string;
  supportedRuntimes: string[];
  tests: Array<{ task: string; expectedKeywords: string[] }>;
  reasoning: string;
}
