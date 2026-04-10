import type { ApiKeySource } from "@/lib/constants/settings";
import type { ProfileTestReport } from "@/lib/agents/profiles/test-types";
import type { RuntimeCapabilities, RuntimeCatalogEntry } from "./catalog";
import type { TaskAssistResponse } from "./task-assist-types";
import type { ProfileAssistRequest, ProfileAssistResponse } from "./profile-assist-types";
import type {
  OpenAIAccountInfo,
  OpenAIAuthMode,
  OpenAIRateLimitInfo,
} from "@/lib/settings/openai-auth";

export interface RuntimeConnectionResult {
  connected: boolean;
  apiKeySource?: ApiKeySource;
  account?: OpenAIAccountInfo | null;
  rateLimits?: OpenAIRateLimitInfo | null;
  authMode?: OpenAIAuthMode;
  error?: string;
}

export interface TaskAssistInput {
  title?: string;
  description?: string;
}

export interface AgentRuntimeAdapter {
  metadata: RuntimeCatalogEntry;
  executeTask(taskId: string): Promise<void>;
  resumeTask(taskId: string): Promise<void>;
  cancelTask(taskId: string): Promise<void>;
  runTaskAssist?(input: TaskAssistInput): Promise<TaskAssistResponse>;
  runProfileAssist?(input: ProfileAssistRequest): Promise<ProfileAssistResponse>;
  runProfileTests?(profileId: string): Promise<ProfileTestReport>;
  testConnection?(): Promise<RuntimeConnectionResult>;
}

export interface RuntimeSummary {
  runtime: RuntimeCatalogEntry;
  capabilities: RuntimeCapabilities;
}
