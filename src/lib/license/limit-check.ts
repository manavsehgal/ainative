/**
 * Shared limit enforcement helpers.
 *
 * Used by API routes and internal write sites to check tier limits
 * before allowing operations. Returns a structured result for
 * consistent 402 response formatting.
 */

import { licenseManager } from "./manager";
import { TIER_LIMITS, type LimitResource, TIER_LABELS } from "./tier-limits";
import { createTierLimitNotification } from "./notifications";
import { sendMemoryWarning } from "@/lib/billing/email";
import { trackConversionEvent } from "@/lib/telemetry/conversion-events";

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  tier: string;
  requiredTier: string;
}

/**
 * Check if an operation is within the current tier's limit.
 *
 * @param resource - The limit resource key
 * @param currentCount - Current usage count
 * @returns Result with allowed flag and metadata for 402 responses
 */
export function checkLimit(
  resource: LimitResource,
  currentCount: number
): LimitCheckResult {
  const tier = licenseManager.getTier();
  const limit = TIER_LIMITS[tier][resource];

  if (currentCount < limit) {
    return {
      allowed: true,
      current: currentCount,
      limit: limit === Infinity ? -1 : limit,
      tier,
      requiredTier: tier,
    };
  }

  // Find the next tier that allows more
  const tiers = ["community", "solo", "operator", "scale"] as const;
  const tierIndex = tiers.indexOf(tier);
  let requiredTier = "scale";
  for (let i = tierIndex + 1; i < tiers.length; i++) {
    if (TIER_LIMITS[tiers[i]][resource] > currentCount) {
      requiredTier = tiers[i];
      break;
    }
  }

  return {
    allowed: false,
    current: currentCount,
    limit: limit === Infinity ? -1 : limit,
    tier,
    requiredTier,
  };
}

/**
 * Check a limit and emit a tier_limit notification if blocked.
 * Convenience wrapper that combines checkLimit + notification.
 */
export async function checkLimitAndNotify(
  resource: LimitResource,
  currentCount: number,
  taskId?: string
): Promise<LimitCheckResult> {
  const result = checkLimit(resource, currentCount);
  if (!result.allowed) {
    await createTierLimitNotification(resource, currentCount, result.limit, taskId);
    trackConversionEvent("limit_hit", resource, { current: currentCount, limit: result.limit });
  }

  // Send email warning when approaching memory limit (75%+)
  if (resource === "agentMemories" && result.allowed && result.limit > 0) {
    const ratio = currentCount / result.limit;
    if (ratio >= 0.75) {
      const email = licenseManager.getStatus().email;
      if (email) {
        sendMemoryWarning(email, "agent", currentCount, result.limit).catch(() => {});
      }
    }
  }

  return result;
}

/**
 * Build a standard 402 response body for limit violations.
 */
export function buildLimitErrorBody(
  resource: LimitResource,
  result: LimitCheckResult
): Record<string, unknown> {
  return {
    error: `${TIER_LABELS[result.tier as keyof typeof TIER_LABELS] ?? result.tier} tier limit reached for ${resource}`,
    upgradeUrl: "/settings",
    requiredTier: result.requiredTier,
    limitType: resource,
    current: result.current,
    max: result.limit,
  };
}
