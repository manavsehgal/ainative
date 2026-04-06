import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://stagent.io",
  "https://stagent.github.io",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, corsHeaders, 405);
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return jsonResponse({ error: "Billing not configured" }, corsHeaders, 500);
    }

    const { email, returnUrl } = await req.json();

    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "email is required" }, corsHeaders, 400);
    }

    // Look up Stripe customer by email
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
      {
        headers: { Authorization: `Bearer ${stripeKey}` },
      },
    );

    if (!searchRes.ok) {
      const text = await searchRes.text();
      console.error("Stripe customer search error:", searchRes.status, text);
      return jsonResponse({ error: "Failed to look up customer" }, corsHeaders, 502);
    }

    const { data: customers } = await searchRes.json();
    if (!customers || customers.length === 0) {
      return jsonResponse({ error: "No billing account found for this email" }, corsHeaders, 404);
    }

    const customerId = customers[0].id;
    const portalReturnUrl = returnUrl || "https://stagent.io/settings";

    // Create Stripe Billing Portal session
    const params = new URLSearchParams();
    params.set("customer", customerId);
    params.set("return_url", portalReturnUrl);

    const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!portalRes.ok) {
      const text = await portalRes.text();
      console.error("Stripe portal error:", portalRes.status, text);
      return jsonResponse({ error: "Failed to create portal session" }, corsHeaders, 502);
    }

    const session = await portalRes.json();
    return jsonResponse({ url: session.url }, corsHeaders);
  } catch (err) {
    console.error("Unhandled error:", err);
    return jsonResponse({ error: "Something went wrong" }, corsHeaders, 500);
  }
});
