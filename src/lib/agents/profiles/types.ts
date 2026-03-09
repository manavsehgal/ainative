export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  domain: string;
  tags: string[];
  systemPrompt: string;
  allowedTools?: string[];
  mcpServers?: string[];
  temperature?: number;
}
