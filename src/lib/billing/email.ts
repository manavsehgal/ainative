/**
 * Transactional email helpers via Resend.
 *
 * All emails are sent through the Supabase `send-email` Edge Function.
 * This module provides typed wrappers with no-op behavior when
 * the cloud backend is not configured.
 */

import { isCloudConfigured } from "@/lib/cloud/supabase-client";

async function sendEmail(
  template: string,
  to: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!isCloudConfigured()) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ template, to, data }),
    });
  } catch {
    // Email sending is non-critical — log and continue
    console.warn(`[email] Failed to send ${template} to ${to}`);
  }
}

/** Welcome email for marketing site purchasers with install instructions */
export function sendWelcomeWithInstall(email: string, tier: string): Promise<void> {
  return sendEmail("welcome-install", email, { tier });
}

/** Upgrade confirmation for in-app purchasers */
export function sendUpgradeConfirmation(email: string, tier: string): Promise<void> {
  return sendEmail("upgrade-confirmation", email, { tier });
}

/** Memory cap warning (approaching limit) */
export function sendMemoryWarning(
  email: string,
  profileName: string,
  current: number,
  limit: number
): Promise<void> {
  return sendEmail("memory-warning", email, { profileName, current, limit });
}
