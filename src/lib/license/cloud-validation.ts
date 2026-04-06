/**
 * Cloud license validation via Supabase Edge Function.
 *
 * Stub implementation — returns "not configured" until supabase-cloud-backend
 * is set up. The LicenseManager gracefully handles validation failures by
 * entering the 7-day grace period.
 */

import type { LicenseTier } from "./tier-limits";

export interface CloudValidationResult {
  valid: boolean;
  tier: LicenseTier;
  expiresAt?: Date;
  error?: string;
}

/**
 * Validate a license against the cloud backend.
 * Returns { valid: false } if Supabase is not configured.
 */
export async function validateLicenseWithCloud(
  email: string
): Promise<CloudValidationResult> {
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || !email) {
    return { valid: false, tier: "community", error: "Cloud backend not configured" };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/validate-license`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      return { valid: false, tier: "community", error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      valid: data.valid === true,
      tier: data.tier ?? "community",
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    };
  } catch (err) {
    return {
      valid: false,
      tier: "community",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
