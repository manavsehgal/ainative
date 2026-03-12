import type { AgentRuntimeId } from "@/lib/agents/runtime/catalog";

export interface ProfileTestResult {
  task: string;
  expectedKeywords: string[];
  foundKeywords: string[];
  missingKeywords: string[];
  passed: boolean;
}

export interface ProfileTestReport {
  profileId: string;
  profileName: string;
  runtimeId: AgentRuntimeId;
  results: ProfileTestResult[];
  totalPassed: number;
  totalFailed: number;
  unsupported?: boolean;
  unsupportedReason?: string;
}
