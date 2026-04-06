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
  price_solo_monthly: "solo",
  price_solo_annual: "solo",
  price_operator_monthly: "operator",
  price_operator_annual: "operator",
  price_scale_monthly: "scale",
  price_scale_annual: "scale",
};

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  // TODO: Verify webhook signature with Stripe secret
  const body = await req.json();
  const event = body;

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
