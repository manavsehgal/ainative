import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { licenseManager } from "@/lib/license/manager";
import { validateLicenseWithCloud } from "@/lib/license/cloud-validation";
import { sendUpgradeConfirmation } from "@/lib/billing/email";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/cloud/supabase-client";

/**
 * GET /auth/callback
 *
 * Handles the Supabase magic link redirect. Exchanges the auth code
 * for a session, validates the user's license, and redirects to settings.
 *
 * Flow:
 * 1. User clicks magic link in email
 * 2. Supabase redirects here with ?code=...
 * 3. We exchange the code for a session (gets user email)
 * 4. Validate license against cloud (check if they have a paid subscription)
 * 5. Activate the license locally if found
 * 6. Redirect to /settings with success indicator
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/settings?auth=error", req.url));
  }

  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false },
  });

  // Exchange the code for a session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("[auth/callback] Code exchange failed:", error?.message);
    return NextResponse.redirect(new URL("/settings?auth=error", req.url));
  }

  const email = data.session.user.email;
  if (!email) {
    return NextResponse.redirect(new URL("/settings?auth=error", req.url));
  }

  // Validate license against cloud — check if this email has a paid subscription
  const validation = await validateLicenseWithCloud(email);

  if (validation.valid && validation.tier !== "community") {
    // User has a paid subscription — activate locally
    licenseManager.activate({
      tier: validation.tier,
      email,
      expiresAt: validation.expiresAt,
    });
    // Send upgrade confirmation email (fire-and-forget)
    sendUpgradeConfirmation(email, validation.tier).catch(() => {});
  } else {
    // No paid subscription — still link the email for future activation
    // This sets the email so cloud sync and marketplace work when they upgrade
    const currentTier = licenseManager.getTierFromDb();
    if (currentTier === "community") {
      // Just store the email association without changing tier
      licenseManager.activate({
        tier: "community",
        email,
      });
    }
  }

  return NextResponse.redirect(new URL("/settings?auth=success", req.url));
}
