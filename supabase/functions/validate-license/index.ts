/**
 * Validate License Edge Function
 *
 * Called by LicenseManager.validateAndRefresh() for daily cloud validation.
 * Returns the user's current tier and subscription status.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { email } = await req.json();
  if (!email) {
    return new Response(
      JSON.stringify({ valid: false, error: "email required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("licenses")
    .select("tier, status, current_period_end")
    .eq("email", email)
    .eq("status", "active")
    .single();

  if (error || !data) {
    return new Response(
      JSON.stringify({ valid: false, tier: "community" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      valid: true,
      tier: data.tier,
      expiresAt: data.current_period_end,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
