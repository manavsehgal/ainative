import {
  DEFAULT_AGENT_RUNTIME,
  getRuntimeCatalogEntry,
  resolveAgentRuntime,
} from "@/lib/agents/runtime/catalog";
import type { WorkflowDefinition } from "@/lib/workflows/types";
import { getProfile } from "./registry";
import { profileSupportsRuntime } from "./compatibility";

function getCompatibilityError(
  profileId: string,
  runtimeId?: string | null,
  context = "Profile"
): string | null {
  const profile = getProfile(profileId);
  if (!profile) {
    return `${context} "${profileId}" was not found`;
  }

  const resolvedRuntime = resolveAgentRuntime(runtimeId ?? DEFAULT_AGENT_RUNTIME);
  if (profileSupportsRuntime(profile, resolvedRuntime)) {
    return null;
  }

  const runtime = getRuntimeCatalogEntry(resolvedRuntime);
  return `${context} "${profile.name}" does not support ${runtime.label}`;
}

export function validateRuntimeProfileAssignment(input: {
  profileId?: string | null;
  runtimeId?: string | null;
  context?: string;
}): string | null {
  if (!input.profileId) {
    return null;
  }

  return getCompatibilityError(
    input.profileId,
    input.runtimeId,
    input.context
  );
}

export function validateWorkflowDefinitionAssignments(
  definition: WorkflowDefinition
): string | null {
  if (definition.loopConfig?.agentProfile) {
    const error = getCompatibilityError(
      definition.loopConfig.agentProfile,
      definition.loopConfig.assignedAgent,
      "Loop profile"
    );
    if (error) {
      return error;
    }
  }

  for (const [index, step] of definition.steps.entries()) {
    if (!step.agentProfile) {
      continue;
    }

    const error = getCompatibilityError(
      step.agentProfile,
      step.assignedAgent,
      `Step ${index + 1} profile`
    );
    if (error) {
      return error;
    }
  }

  return null;
}
