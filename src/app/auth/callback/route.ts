import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { licenseManager } from "@/lib/license/manager";
import { validateLicenseWithCloud } from "@/lib/license/cloud-validation";
import { sendUpgradeConfirmation } from "@/lib/billing/email";

const DEFAULT_SUPABASE_URL = "https://yznantjbmacbllhcyzwc.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bmFudGpibWFjYmxsaGN5endjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MDg1ODMsImV4cCI6MjA4ODA4NDU4M30.i-P7MXpR1_emBjhUkzbFeSX7fgjgPDv90_wkqF7sW3Y";

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const supabase = createClient(url, anonKey, {
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
