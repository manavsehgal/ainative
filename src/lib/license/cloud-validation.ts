/**
 * Cloud license validation via Supabase Edge Function.
 *
 * Calls the validate-license Edge Function to check if the user's
 * email has an active subscription. Uses the same Supabase client
 * defaults as supabase-client.ts (production backend by default).
 */

import { isCloudConfigured } from "@/lib/cloud/supabase-client";
import type { LicenseTier } from "./tier-limits";

const DEFAULT_SUPABASE_URL = "https://yznantjbmacbllhcyzwc.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bmFudGpibWFjYmxsaGN5endjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MDg1ODMsImV4cCI6MjA4ODA4NDU4M30.i-P7MXpR1_emBjhUkzbFeSX7fgjgPDv90_wkqF7sW3Y";

export interface CloudValidationResult {
  valid: boolean;
  tier: LicenseTier;
  expiresAt?: Date;
  error?: string;
}

/**
 * Validate a license against the cloud backend.
 * Returns { valid: false } if cloud is disabled or email is empty.
 */
export async function validateLicenseWithCloud(
  email: string
): Promise<CloudValidationResult> {
  if (!isCloudConfigured() || !email) {
    return { valid: false, tier: "community", error: "Cloud disabled or no email" };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/validate-license`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
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
