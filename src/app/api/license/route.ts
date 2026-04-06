import { NextRequest, NextResponse } from "next/server";
import { licenseManager } from "@/lib/license/manager";
import { TIER_LIMITS, type LimitResource } from "@/lib/license/tier-limits";
import { LICENSE_FEATURES, canAccessFeature } from "@/lib/license/features";
import { activateLicenseSchema } from "@/lib/validators/license";
import type { LicenseTier } from "@/lib/license/tier-limits";

/**
 * GET /api/license — current license status, feature flags, and limits.
 */
export async function GET() {
  // Read from DB directly — avoids stale singleton cache in Turbopack dev mode
  const status = licenseManager.getStatusFromDb();
  const tier = status.tier;

  // Build feature access map
  const features: Record<string, boolean> = {};
  for (const feature of LICENSE_FEATURES) {
    features[feature] = canAccessFeature(tier, feature);
  }

  // Build limit map
  const limits: Record<string, number> = {};
  for (const key of Object.keys(TIER_LIMITS[tier]) as LimitResource[]) {
    const val = TIER_LIMITS[tier][key];
    limits[key] = val === Infinity ? -1 : val; // -1 = unlimited for JSON
  }

  return NextResponse.json({
    tier: status.tier,
    status: status.status,
    email: status.email,
    activatedAt: status.activatedAt?.toISOString() ?? null,
    expiresAt: status.expiresAt?.toISOString() ?? null,
    lastValidatedAt: status.lastValidatedAt?.toISOString() ?? null,
    gracePeriodExpiresAt: status.gracePeriodExpiresAt?.toISOString() ?? null,
    isPremium: tier !== "community",
    features,
    limits,
  });
}

/**
 * POST /api/license — activate a license.
 * Accepts either a license key or direct tier/email/token (from Stripe webhook flow).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = activateLicenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { tier, email, token } = parsed.data;

  if (!tier || !email) {
    return NextResponse.json(
      { error: "tier and email are required for activation" },
      { status: 400 }
    );
  }

  licenseManager.activate({
    tier: tier as LicenseTier,
    email,
    encryptedToken: token,
  });

  return NextResponse.json({
    success: true,
    tier: licenseManager.getTier(),
    status: licenseManager.getStatus().status,
  });
}

/**
 * DELETE /api/license — deactivate and revert to community.
 */
export async function DELETE() {
  licenseManager.deactivate();
  return NextResponse.json({
    success: true,
    tier: "community",
  });
}
