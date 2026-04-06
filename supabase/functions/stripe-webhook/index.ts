/**
 * Stripe Webhook Edge Function
 *
 * Handles Stripe subscription events → upserts license row.
 * Deployed to Supabase Edge Functions.
 *
 * Events handled:
 * - checkout.session.completed → create/upgrade license
 * - customer.subscription.updated → update tier/status
 * - customer.subscription.deleted → downgrade to community
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TIER_MAP: Record<string, string> = {
  "price_1TJ2d5RCxnzBPkIX4SnajFok": "solo",
  "price_1TJ2d5RCxnzBPkIXjjiyc7lb": "solo",
  "price_1TJ2e1RCxnzBPkIXZg47cNbO": "operator",
  "price_1TJ2e1RCxnzBPkIXODs5fZW2": "operator",
  "price_1TJ2evRCxnzBPkIXy9mBqBHB": "scale",
  "price_1TJ2evRCxnzBPkIXqIRaDxQp": "scale",
};

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    acc[key.trim()] = value;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts["t"];
  const expectedSig = parts["v1"];
  if (!timestamp || !expectedSig) return false;

  // Reject events older than 5 minutes (replay attack prevention)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === expectedSig;
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const rawBody = await req.text();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const valid = await verifyStripeSignature(rawBody, signature, webhookSecret);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const email = session.customer_email;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      // Look up the price to determine tier
      // TODO: Fetch subscription items to get price ID
      const tier = "solo"; // Default — will be resolved from price ID

      const { error } = await supabase
        .from("licenses")
        .upsert(
          {
            email,
            tier,
            status: "active",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );

      if (error) {
        console.error("Failed to upsert license:", error);
        return new Response("DB error", { status: 500 });
      }

      // TODO: Send welcome/upgrade email via Resend
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const tier = TIER_MAP[priceId] ?? "solo";

      await supabase
        .from("licenses")
        .update({
          tier,
          status: subscription.status === "active" ? "active" : "past_due",
          current_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await supabase
        .from("licenses")
        .update({
          tier: "community",
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    default:
      // Unhandled event type — acknowledge receipt
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
