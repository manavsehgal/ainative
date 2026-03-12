import {
  DEFAULT_AGENT_RUNTIME,
  SUPPORTED_AGENT_RUNTIMES,
  resolveAgentRuntime,
  type AgentRuntimeId,
} from "@/lib/agents/runtime/catalog";
import type {
  CanUseToolPolicy,
  ProfileRuntimeOverride,
  ProfileSmokeTest,
} from "./types";

type CompatibilityProfile = {
  id: string;
  name: string;
  skillMd?: string;
  systemPrompt?: string;
  allowedTools?: string[];
  mcpServers?: Record<string, unknown>;
  canUseToolPolicy?: CanUseToolPolicy;
  tests?: ProfileSmokeTest[];
  supportedRuntimes?: AgentRuntimeId[];
  runtimeOverrides?: Partial<Record<AgentRuntimeId, ProfileRuntimeOverride>>;
};

export interface ProfileRuntimeCompatibility {
  runtimeId: AgentRuntimeId;
  supported: boolean;
  reason?: string;
  instructionsSource: "shared" | "runtime-override";
}

export interface ResolvedProfileRuntimePayload
  extends ProfileRuntimeCompatibility {
  profileId: string;
  profileName: string;
  instructions: string;
  allowedTools?: string[];
  mcpServers?: Record<string, unknown>;
  canUseToolPolicy?: CanUseToolPolicy;
  tests?: ProfileSmokeTest[];
}

export function getSupportedRuntimes(
  profile: Pick<CompatibilityProfile, "supportedRuntimes">
): AgentRuntimeId[] {
  const supported =
    profile.supportedRuntimes && profile.supportedRuntimes.length > 0
      ? profile.supportedRuntimes
      : ["claude-code"];

  return SUPPORTED_AGENT_RUNTIMES.filter((runtimeId) =>
    supported.includes(runtimeId)
  );
}

export function getProfileRuntimeCompatibility(
  profile: CompatibilityProfile,
  runtimeId?: string | null
): ProfileRuntimeCompatibility {
  const resolvedRuntime = resolveAgentRuntime(runtimeId ?? DEFAULT_AGENT_RUNTIME);
  const supportedRuntimes = getSupportedRuntimes(profile);
  const supported = supportedRuntimes.includes(resolvedRuntime);
  const runtimeOverride = profile.runtimeOverrides?.[resolvedRuntime];

  return {
    runtimeId: resolvedRuntime,
    supported,
    reason: supported
      ? undefined
      : `${profile.name} does not support ${resolvedRuntime}`,
    instructionsSource: runtimeOverride?.instructions ? "runtime-override" : "shared",
  };
}

export function profileSupportsRuntime(
  profile: CompatibilityProfile,
  runtimeId?: string | null
): boolean {
  return getProfileRuntimeCompatibility(profile, runtimeId).supported;
}

export function resolveProfileRuntimePayload(
  profile: CompatibilityProfile,
  runtimeId?: string | null
): ResolvedProfileRuntimePayload {
  const compatibility = getProfileRuntimeCompatibility(profile, runtimeId);
  const runtimeOverride = profile.runtimeOverrides?.[compatibility.runtimeId];
  const instructions =
    runtimeOverride?.instructions ??
    profile.skillMd ??
    profile.systemPrompt ??
    "";

  return {
    profileId: profile.id,
    profileName: profile.name,
    runtimeId: compatibility.runtimeId,
    supported: compatibility.supported,
    reason: compatibility.reason,
    instructionsSource: compatibility.instructionsSource,
    instructions,
    allowedTools: runtimeOverride?.allowedTools ?? profile.allowedTools,
    mcpServers: runtimeOverride?.mcpServers ?? profile.mcpServers,
    canUseToolPolicy:
      runtimeOverride?.canUseToolPolicy ?? profile.canUseToolPolicy,
    tests: runtimeOverride?.tests ?? profile.tests,
  };
}
