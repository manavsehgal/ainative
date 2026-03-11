import {
  DEFAULT_AGENT_RUNTIME,
  getRuntimeCapabilities,
  listRuntimeCatalog,
  resolveAgentRuntime,
  type AgentRuntimeId,
} from "./catalog";
import { claudeRuntimeAdapter } from "./claude";
import type {
  AgentRuntimeAdapter,
  RuntimeConnectionResult,
  RuntimeSummary,
  TaskAssistInput,
} from "./types";
import type { ProfileTestReport } from "@/lib/agents/profiles/test-types";
import type { TaskAssistResponse } from "./task-assist-types";

const runtimeRegistry: Record<AgentRuntimeId, AgentRuntimeAdapter> = {
  "claude-code": claudeRuntimeAdapter,
};

function getRuntimeAdapter(runtimeId?: string | null): AgentRuntimeAdapter {
  return runtimeRegistry[resolveAgentRuntime(runtimeId)];
}

function assertCapability(
  runtimeId: string | null | undefined,
  capability: keyof AgentRuntimeAdapter["metadata"]["capabilities"]
): AgentRuntimeAdapter {
  const resolvedRuntime = resolveAgentRuntime(runtimeId);
  const adapter = runtimeRegistry[resolvedRuntime];

  if (!adapter.metadata.capabilities[capability]) {
    throw new Error(
      `Runtime "${resolvedRuntime}" does not support ${capability}`
    );
  }

  return adapter;
}

export function getRuntimeSummary(
  runtimeId: string | null | undefined = DEFAULT_AGENT_RUNTIME
): RuntimeSummary {
  const resolvedRuntime = resolveAgentRuntime(runtimeId);
  return {
    runtime: runtimeRegistry[resolvedRuntime].metadata,
    capabilities: getRuntimeCapabilities(resolvedRuntime),
  };
}

export function listRuntimeSummaries(): RuntimeSummary[] {
  return listRuntimeCatalog().map((runtime) => ({
    runtime,
    capabilities: runtime.capabilities,
  }));
}

export async function executeTaskWithRuntime(
  taskId: string,
  runtimeId?: string | null
): Promise<void> {
  return getRuntimeAdapter(runtimeId).executeTask(taskId);
}

export async function resumeTaskWithRuntime(
  taskId: string,
  runtimeId?: string | null
): Promise<void> {
  const adapter = assertCapability(runtimeId, "resume");
  return adapter.resumeTask(taskId);
}

export async function cancelTaskWithRuntime(
  taskId: string,
  runtimeId?: string | null
): Promise<void> {
  const adapter = assertCapability(runtimeId, "cancel");
  return adapter.cancelTask(taskId);
}

export async function runTaskAssistWithRuntime(
  input: TaskAssistInput,
  runtimeId?: string | null
): Promise<TaskAssistResponse> {
  const adapter = assertCapability(runtimeId, "taskAssist");
  if (!adapter.runTaskAssist) {
    throw new Error(`Runtime "${adapter.metadata.id}" does not implement task assist`);
  }
  return adapter.runTaskAssist(input);
}

export async function runProfileTestsWithRuntime(
  profileId: string,
  runtimeId?: string | null
): Promise<ProfileTestReport> {
  const adapter = assertCapability(runtimeId, "profileTests");
  if (!adapter.runProfileTests) {
    throw new Error(`Runtime "${adapter.metadata.id}" does not implement profile tests`);
  }
  return adapter.runProfileTests(profileId);
}

export async function testRuntimeConnection(
  runtimeId?: string | null
): Promise<RuntimeConnectionResult> {
  const adapter = assertCapability(runtimeId, "authHealthCheck");
  if (!adapter.testConnection) {
    throw new Error(`Runtime "${adapter.metadata.id}" does not implement health checks`);
  }
  return adapter.testConnection();
}
