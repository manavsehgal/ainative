import { getProfile } from "@/lib/agents/profiles/registry";
import { profileSupportsRuntime } from "@/lib/agents/profiles/compatibility";
import { suggestRuntime } from "@/lib/agents/router";
import {
  DEFAULT_AGENT_RUNTIME,
  getRuntimeCatalogEntry,
  getRuntimeFeatures,
  resolveAgentRuntime,
  type AgentRuntimeId,
} from "./catalog";
import { testRuntimeConnection } from "./index";
import { getRoutingPreference } from "@/lib/settings/routing";
import { getRuntimeSetupStates, listConfiguredRuntimeIds } from "@/lib/settings/runtime-setup";
import { DEFAULT_CHAT_MODEL, getRuntimeForModel } from "@/lib/chat/types";

const FILESYSTEM_TOOL_NAMES = new Set([
  "Read",
  "Write",
  "Edit",
  "MultiEdit",
  "Grep",
  "Glob",
]);

const CHAT_MODEL_FALLBACKS: Record<string, string[]> = {
  haiku: ["gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.4"],
  sonnet: ["gpt-5.3-codex", "gpt-5.4", "gpt-5.4-mini"],
  opus: ["gpt-5.4", "gpt-5.3-codex", "gpt-5.4-mini"],
  "gpt-5.4-mini": ["haiku", "sonnet", "opus"],
  "gpt-5.3-codex": ["sonnet", "haiku", "opus"],
  "gpt-5.4": ["opus", "sonnet", "haiku"],
};

export class RuntimeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeUnavailableError";
  }
}

export class RequestedModelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestedModelUnavailableError";
  }
}

export class NoCompatibleRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoCompatibleRuntimeError";
  }
}

export interface ResolvedExecutionTarget {
  requestedRuntimeId: AgentRuntimeId | null;
  effectiveRuntimeId: AgentRuntimeId;
  requestedModelId: string | null;
  effectiveModelId: string | null;
  fallbackApplied: boolean;
  fallbackReason: string | null;
}

type RuntimeRequirements = {
  requiresBash: boolean;
  requiresFilesystem: boolean;
};

type RuntimeAvailability = {
  available: boolean;
  reason: string | null;
};

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function getRuntimeLabel(runtimeId: AgentRuntimeId): string {
  return getRuntimeCatalogEntry(runtimeId).label;
}

function detectRuntimeRequirements(profileId?: string | null): RuntimeRequirements {
  const profile = profileId ? getProfile(profileId) : undefined;
  const allowedTools = profile?.allowedTools ?? [];

  const requiresBash = allowedTools.some(
    (tool) => tool === "Bash" || tool.startsWith("Bash(")
  );
  const requiresFilesystem =
    requiresBash ||
    allowedTools.some((tool) => FILESYSTEM_TOOL_NAMES.has(tool));

  return { requiresBash, requiresFilesystem };
}

function runtimeMeetsRequirements(
  runtimeId: AgentRuntimeId,
  requirements: RuntimeRequirements
): boolean {
  const features = getRuntimeFeatures(runtimeId);
  if (requirements.requiresBash && !features.hasBash) {
    return false;
  }
  if (requirements.requiresFilesystem && !features.hasFilesystemTools) {
    return false;
  }
  return true;
}

function filterCompatibleRuntimes(
  runtimeIds: AgentRuntimeId[],
  profileId?: string | null
): AgentRuntimeId[] {
  if (!profileId) {
    return runtimeIds;
  }

  const profile = getProfile(profileId);
  if (!profile) {
    return [];
  }

  return runtimeIds.filter((runtimeId) =>
    profileSupportsRuntime(profile, runtimeId)
  );
}

async function checkRuntimeAvailability(
  runtimeId: AgentRuntimeId
): Promise<RuntimeAvailability> {
  const states = await getRuntimeSetupStates();
  if (!states[runtimeId]?.configured) {
    return {
      available: false,
      reason: `${getRuntimeLabel(runtimeId)} is not configured`,
    };
  }

  try {
    const connection = await testRuntimeConnection(runtimeId);
    if (connection.connected) {
      return { available: true, reason: null };
    }
    return {
      available: false,
      reason:
        connection.error ??
        `${getRuntimeLabel(runtimeId)} is unavailable`,
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getConfiguredCandidateRuntimes(
  profileId?: string | null
): Promise<AgentRuntimeId[]> {
  const states = await getRuntimeSetupStates();
  return filterCompatibleRuntimes(
    listConfiguredRuntimeIds(states) as AgentRuntimeId[],
    profileId
  );
}

function buildTaskFallbackOrder(input: {
  title: string;
  description?: string | null;
  profileId?: string | null;
  requestedRuntimeId: AgentRuntimeId | null;
  compatibleRuntimeIds: AgentRuntimeId[];
}): AgentRuntimeId[] {
  const alternates = input.compatibleRuntimeIds.filter(
    (runtimeId) => runtimeId !== input.requestedRuntimeId
  );
  if (alternates.length === 0) {
    return [];
  }

  const preferred = suggestRuntime(
    input.title,
    input.description,
    input.profileId,
    alternates,
    "quality"
  ).runtimeId;

  return unique([
    preferred,
    ...alternates.filter(
      (runtimeId) =>
        input.requestedRuntimeId != null &&
        getRuntimeCatalogEntry(runtimeId).providerId ===
          getRuntimeCatalogEntry(input.requestedRuntimeId).providerId
    ),
    ...alternates,
  ]);
}

function buildRuntimeFallbackReason(input: {
  requestedRuntimeId: AgentRuntimeId | null;
  effectiveRuntimeId: AgentRuntimeId;
  unavailableReason: string | null;
}): string | null {
  if (!input.requestedRuntimeId) {
    return null;
  }

  const requestedLabel = getRuntimeLabel(input.requestedRuntimeId);
  const effectiveLabel = getRuntimeLabel(input.effectiveRuntimeId);
  const reason = input.unavailableReason ?? `${requestedLabel} is unavailable`;
  return `${reason}. Fell back to ${effectiveLabel}.`;
}

export async function resolveTaskExecutionTarget(input: {
  title: string;
  description?: string | null;
  requestedRuntimeId?: string | null;
  profileId?: string | null;
  unavailableRuntimeIds?: string[];
  unavailableReasons?: Record<string, string>;
}): Promise<ResolvedExecutionTarget> {
  const requestedRuntimeId = input.requestedRuntimeId
    ? resolveAgentRuntime(input.requestedRuntimeId)
    : null;
  const requirements = detectRuntimeRequirements(input.profileId);
  const unavailableRuntimeIds = new Set(
    (input.unavailableRuntimeIds ?? []).map((runtimeId) =>
      resolveAgentRuntime(runtimeId)
    )
  );
  const configuredCandidates = await getConfiguredCandidateRuntimes(input.profileId);
  const compatibleCandidates = configuredCandidates.filter((runtimeId) =>
    runtimeMeetsRequirements(runtimeId, requirements)
  );
  const launchableCandidates = compatibleCandidates.filter(
    (runtimeId) => !unavailableRuntimeIds.has(runtimeId)
  );

  if (compatibleCandidates.length === 0) {
    throw new NoCompatibleRuntimeError(
      "No compatible configured runtime is available for this task."
    );
  }

  if (requestedRuntimeId) {
    if (
      compatibleCandidates.includes(requestedRuntimeId) &&
      !unavailableRuntimeIds.has(requestedRuntimeId) &&
      (await checkRuntimeAvailability(requestedRuntimeId)).available
    ) {
      return {
        requestedRuntimeId,
        effectiveRuntimeId: requestedRuntimeId,
        requestedModelId: null,
        effectiveModelId: null,
        fallbackApplied: false,
        fallbackReason: null,
      };
    }

    const availability = unavailableRuntimeIds.has(requestedRuntimeId)
      ? {
          available: false,
          reason:
            input.unavailableReasons?.[requestedRuntimeId] ??
            `${getRuntimeLabel(requestedRuntimeId)} is temporarily unavailable`,
        }
      : compatibleCandidates.includes(requestedRuntimeId)
      ? await checkRuntimeAvailability(requestedRuntimeId)
      : {
          available: false,
          reason: `${getRuntimeLabel(requestedRuntimeId)} does not support this task/profile`,
        };
    const fallbackOrder = buildTaskFallbackOrder({
      title: input.title,
      description: input.description,
      profileId: input.profileId,
      requestedRuntimeId,
      compatibleRuntimeIds: launchableCandidates,
    });

    for (const candidate of fallbackOrder) {
      const candidateAvailability = await checkRuntimeAvailability(candidate);
      if (candidateAvailability.available) {
        return {
          requestedRuntimeId,
          effectiveRuntimeId: candidate,
          requestedModelId: null,
          effectiveModelId: null,
          fallbackApplied: true,
          fallbackReason: buildRuntimeFallbackReason({
            requestedRuntimeId,
            effectiveRuntimeId: candidate,
            unavailableReason: availability.reason,
          }),
        };
      }
    }

    throw new NoCompatibleRuntimeError(
      availability.reason ??
        `No healthy alternate runtime is available for ${getRuntimeLabel(requestedRuntimeId)}.`
    );
  }

  const routingPreference = await getRoutingPreference();
  const suggested = suggestRuntime(
    input.title,
    input.description,
    input.profileId,
    launchableCandidates,
    routingPreference
  ).runtimeId;
  const autoOrder = unique([
    suggested,
    ...launchableCandidates,
  ]);

  for (const candidate of autoOrder) {
    const availability = await checkRuntimeAvailability(candidate);
    if (availability.available) {
      return {
        requestedRuntimeId: null,
        effectiveRuntimeId: candidate,
        requestedModelId: null,
        effectiveModelId: null,
        fallbackApplied: false,
        fallbackReason: null,
      };
    }
  }

  throw new RuntimeUnavailableError(
    "No healthy runtime is currently available to execute this task."
  );
}

export async function resolveResumeExecutionTarget(input: {
  requestedRuntimeId?: string | null;
  effectiveRuntimeId?: string | null;
}): Promise<ResolvedExecutionTarget> {
  const requestedRuntimeId = input.requestedRuntimeId
    ? resolveAgentRuntime(input.requestedRuntimeId)
    : null;
  const resumeRuntimeId = input.effectiveRuntimeId
    ? resolveAgentRuntime(input.effectiveRuntimeId)
    : requestedRuntimeId ?? DEFAULT_AGENT_RUNTIME;
  const availability = await checkRuntimeAvailability(resumeRuntimeId);

  if (!availability.available) {
    throw new RuntimeUnavailableError(
      availability.reason ??
        `${getRuntimeLabel(resumeRuntimeId)} is unavailable for resume. Use Retry for a fresh execution.`
    );
  }

  return {
    requestedRuntimeId,
    effectiveRuntimeId: resumeRuntimeId,
    requestedModelId: null,
    effectiveModelId: null,
    fallbackApplied: false,
    fallbackReason: null,
  };
}

function buildChatFallbackOrder(requestedModelId: string): string[] {
  const fallbacks = CHAT_MODEL_FALLBACKS[requestedModelId] ?? [];
  return unique([requestedModelId, ...fallbacks]);
}

function buildChatFallbackReason(input: {
  requestedRuntimeId: AgentRuntimeId;
  effectiveRuntimeId: AgentRuntimeId;
  requestedModelId: string;
  effectiveModelId: string;
  unavailableReason: string | null;
}): string | null {
  if (
    input.requestedRuntimeId === input.effectiveRuntimeId &&
    input.requestedModelId === input.effectiveModelId
  ) {
    return null;
  }

  const requestedLabel = `${input.requestedModelId} on ${getRuntimeLabel(input.requestedRuntimeId)}`;
  const effectiveLabel = `${input.effectiveModelId} on ${getRuntimeLabel(input.effectiveRuntimeId)}`;
  const reason = input.unavailableReason ?? `${requestedLabel} is unavailable`;
  return `${reason}. Using ${effectiveLabel} for this turn.`;
}

export async function resolveChatExecutionTarget(input: {
  requestedRuntimeId?: string | null;
  requestedModelId?: string | null;
}): Promise<ResolvedExecutionTarget> {
  const requestedModelId =
    input.requestedModelId ??
    (input.requestedRuntimeId
      ? getRuntimeCatalogEntry(resolveAgentRuntime(input.requestedRuntimeId)).models.default
      : DEFAULT_CHAT_MODEL);
  const requestedRuntimeId = resolveAgentRuntime(
    input.requestedRuntimeId ?? getRuntimeForModel(requestedModelId)
  );

  const modelOrder = buildChatFallbackOrder(requestedModelId);
  let requestedAvailability: RuntimeAvailability | null = null;

  for (const candidateModelId of modelOrder) {
    const candidateRuntimeId = resolveAgentRuntime(
      getRuntimeForModel(candidateModelId)
    );
    if (
      candidateRuntimeId !== "claude-code" &&
      candidateRuntimeId !== "openai-codex-app-server" &&
      candidateRuntimeId !== "ollama"
    ) {
      continue;
    }

    const availability = await checkRuntimeAvailability(candidateRuntimeId);
    if (
      candidateRuntimeId === requestedRuntimeId &&
      requestedAvailability === null
    ) {
      requestedAvailability = availability;
    }
    if (!availability.available) {
      continue;
    }

    return {
      requestedRuntimeId,
      effectiveRuntimeId: candidateRuntimeId,
      requestedModelId,
      effectiveModelId: candidateModelId,
      fallbackApplied:
        candidateRuntimeId !== requestedRuntimeId ||
        candidateModelId !== requestedModelId,
      fallbackReason: buildChatFallbackReason({
        requestedRuntimeId,
        effectiveRuntimeId: candidateRuntimeId,
        requestedModelId,
        effectiveModelId: candidateModelId,
        unavailableReason: requestedAvailability?.reason ?? null,
      }),
    };
  }

  throw new RequestedModelUnavailableError(
    requestedAvailability?.reason ??
      `No healthy runtime is available for ${requestedModelId}.`
  );
}
