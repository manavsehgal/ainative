import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/cloud/supabase-client";
import { setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

/**
 * GET /auth/callback
 *
 * Handles the Supabase magic link redirect. Exchanges the auth code
 * for a session, stores the user's email, and redirects to settings.
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

  // Store the email for cloud sync identification
  await setSetting(SETTINGS_KEYS.CLOUD_EMAIL, email);

  return NextResponse.redirect(new URL("/settings?auth=success", req.url));
}
