/**
 * Stripe billing helpers.
 *
 * All Stripe API calls go through Supabase Edge Functions —
 * no Stripe secret key in the local app. This module calls
 * Edge Functions to create Checkout Sessions and Portal Sessions.
 */

import { isCloudConfigured } from "@/lib/cloud/supabase-client";
import { getProductForTier } from "./products";
import type { LicenseTier } from "@/lib/license/tier-limits";
import type { BillingInterval } from "./products";

/**
 * Create a Stripe Checkout Session for in-app upgrade.
 * Returns the checkout URL to redirect the user to.
 */
export async function createCheckoutSession(
  tier: Exclude<LicenseTier, "community">,
  billingPeriod: BillingInterval = "monthly",
  returnUrl?: string
): Promise<{ url: string } | { error: string }> {
  if (!isCloudConfigured()) {
    return { error: "Cloud backend not configured" };
  }

  const product = getProductForTier(tier);
  if (!product) {
    return { error: `Unknown tier: ${tier}` };
  }

  const priceId = product.prices[billingPeriod].id;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/create-checkout-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          priceId,
          returnUrl: returnUrl ?? `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/settings`,
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error ?? `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { url: data.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Checkout failed" };
  }
}

/**
 * Create a Stripe Customer Portal session for billing management.
 * Returns the portal URL to redirect the user to.
 */
export async function createPortalSession(
  email: string
): Promise<{ url: string } | { error: string }> {
  if (!isCloudConfigured()) {
    return { error: "Cloud backend not configured" };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/create-portal-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error ?? `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { url: data.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Portal failed" };
  }
}
