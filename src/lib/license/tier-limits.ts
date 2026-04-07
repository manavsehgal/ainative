/**
 * Tier limit constants for the PLG monetization system.
 *
 * Each tier includes all capabilities of lower tiers.
 * "Unlimited" is represented as Infinity for easy comparison.
 */

export const TIERS = ["community", "solo", "operator", "scale"] as const;
export type LicenseTier = (typeof TIERS)[number];

/** Numeric rank for tier comparison — higher = more capable */
export const TIER_RANK: Record<LicenseTier, number> = {
  community: 0,
  solo: 1,
  operator: 2,
  scale: 3,
} as const;

export type LimitResource =
  | "agentMemories"
  | "contextVersions"
  | "activeSchedules"
  | "historyRetentionDays"
  | "parallelWorkflows"
  | "maxCloudInstances";

export const TIER_LIMITS: Record<LicenseTier, Record<LimitResource, number>> = {
  community: {
    agentMemories: 50,
    contextVersions: 10,
    activeSchedules: 5,
    historyRetentionDays: 30,
    parallelWorkflows: 3,
    // Advisory client-side only; authoritative enforcement is server-side.
    // See TDR-030: hybrid instance licensing.
    maxCloudInstances: 1,
  },
  solo: {
    agentMemories: 200,
    contextVersions: 50,
    activeSchedules: 20,
    historyRetentionDays: 180,
    parallelWorkflows: 5,
    maxCloudInstances: 2,
  },
  operator: {
    agentMemories: 500,
    contextVersions: 100,
    activeSchedules: 50,
    historyRetentionDays: 365,
    parallelWorkflows: 10,
    maxCloudInstances: 5,
  },
  scale: {
    agentMemories: Infinity,
    contextVersions: Infinity,
    activeSchedules: Infinity,
    historyRetentionDays: Infinity,
    parallelWorkflows: Infinity,
    maxCloudInstances: Infinity,
  },
} as const;

/** Human-friendly tier labels for UI display */
export const TIER_LABELS: Record<LicenseTier, string> = {
  community: "Community",
  solo: "Solo",
  operator: "Operator",
  scale: "Scale",
} as const;

/** Monthly pricing in USD (0 = free) */
export const TIER_PRICING: Record<LicenseTier, { monthly: number; annual: number }> = {
  community: { monthly: 0, annual: 0 },
  solo: { monthly: 19, annual: 190 },
  operator: { monthly: 49, annual: 490 },
  scale: { monthly: 99, annual: 990 },
} as const;
