/**
 * Feature→tier gating map.
 *
 * Each feature has a minimum tier required to access it.
 * Use LicenseManager.isFeatureAllowed(feature) to check access.
 */

import { type LicenseTier, TIER_RANK } from "./tier-limits";

export const LICENSE_FEATURES = [
  "analytics",
  "cloud-sync",
  "marketplace-browse",
  "marketplace-import",
  "marketplace-publish",
  "marketplace-featured",
  "telemetry-benchmarks",
  "advanced-history",
  "priority-support",
] as const;

export type LicenseFeature = (typeof LICENSE_FEATURES)[number];

/** Minimum tier required to access each feature */
const FEATURE_MIN_TIER: Record<LicenseFeature, LicenseTier> = {
  "analytics": "operator",
  "cloud-sync": "operator",
  "marketplace-browse": "community",
  "marketplace-import": "solo",
  "marketplace-publish": "operator",
  "marketplace-featured": "scale",
  "telemetry-benchmarks": "solo",
  "advanced-history": "solo",
  "priority-support": "scale",
} as const;

/**
 * Check if a tier can access a feature.
 * Pure function — no side effects or DB access.
 */
export function canAccessFeature(tier: LicenseTier, feature: LicenseFeature): boolean {
  const minTier = FEATURE_MIN_TIER[feature];
  return TIER_RANK[tier] >= TIER_RANK[minTier];
}
