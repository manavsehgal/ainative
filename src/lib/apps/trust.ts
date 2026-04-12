/**
 * Trust ladder — progressive capability gating for apps.
 *
 * Trust levels: private → community → verified → official
 * Each level maps to an execution tier that determines which
 * primitive handlers bootstrapApp() is allowed to invoke.
 */

import type { AppTrustLevel } from "./types";

// ── Primitive tier definitions ───────────────────────────────────────

/** Tier A — Declarative primitives available to all trust levels */
const TIER_A_PRIMITIVES = new Set([
  "tables",
  "schedules",
  "profiles",
  "blueprints",
  "triggers",
  "notifications",
  "savedViews",
  "documents",
  "envVars",
]);

/** Tier B — Integration primitives requiring verified+ trust */
const TIER_B_PRIMITIVES = new Set([
  "mcpServers",
  "chatTools",
  "channels",
  "memory",
]);

/** Full access — Governance primitives requiring official trust */
const FULL_PRIMITIVES = new Set([
  "budgetPolicies",
]);

// ── Trust level hierarchy ────────────────────────────────────────────

const TRUST_HIERARCHY: Record<AppTrustLevel, number> = {
  private: 0,
  community: 1,
  verified: 2,
  official: 3,
};

// ── Public API ───────────────────────────────────────────────────────

/**
 * Check whether an app at a given trust level can execute a primitive.
 *
 * Tier A (all levels): tables, schedules, profiles, blueprints, etc.
 * Tier B (verified+): mcpServers, chatTools, channels, memory
 * Full (official only): budgetPolicies
 * Unknown primitives: blocked by default (safe-by-default)
 */
export function canExecutePrimitive(
  trustLevel: AppTrustLevel,
  primitive: string,
): boolean {
  if (TIER_A_PRIMITIVES.has(primitive)) {
    return true; // all trust levels can use Tier A
  }

  if (TIER_B_PRIMITIVES.has(primitive)) {
    return TRUST_HIERARCHY[trustLevel] >= TRUST_HIERARCHY.verified;
  }

  if (FULL_PRIMITIVES.has(primitive)) {
    return TRUST_HIERARCHY[trustLevel] >= TRUST_HIERARCHY.official;
  }

  // Unknown primitives are blocked by default
  return false;
}

/**
 * Get the minimum trust level required for a primitive.
 * Returns null for unknown primitives (which are always blocked).
 */
export function requiredTrustLevel(
  primitive: string,
): AppTrustLevel | null {
  if (TIER_A_PRIMITIVES.has(primitive)) return "private";
  if (TIER_B_PRIMITIVES.has(primitive)) return "verified";
  if (FULL_PRIMITIVES.has(primitive)) return "official";
  return null;
}

/**
 * Categorize a list of primitives by their tier and whether
 * the given trust level allows them.
 */
export function categorizePrimitives(
  trustLevel: AppTrustLevel,
  primitives: string[],
): { allowed: string[]; skipped: Array<{ primitive: string; requiredLevel: AppTrustLevel | null }> } {
  const allowed: string[] = [];
  const skipped: Array<{ primitive: string; requiredLevel: AppTrustLevel | null }> = [];

  for (const p of primitives) {
    if (canExecutePrimitive(trustLevel, p)) {
      allowed.push(p);
    } else {
      skipped.push({ primitive: p, requiredLevel: requiredTrustLevel(p) });
    }
  }

  return { allowed, skipped };
}
