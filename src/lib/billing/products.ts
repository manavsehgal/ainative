/**
 * Stripe product and price configuration.
 *
 * Price IDs are placeholders — replace with actual Stripe dashboard values
 * after creating products. The structure supports both monthly and annual
 * billing for each tier.
 */

import type { LicenseTier } from "@/lib/license/tier-limits";

export type BillingInterval = "monthly" | "annual";

export interface StripeProduct {
  tier: Exclude<LicenseTier, "community">;
  name: string;
  description: string;
  prices: Record<BillingInterval, StripePrice>;
  paymentLink: string; // Static URL for marketing site
}

export interface StripePrice {
  id: string; // Stripe Price ID (price_xxx)
  amount: number; // In cents
  currency: string;
}

/** Stripe product catalog — live Price IDs and Payment Links. */
export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    tier: "solo",
    name: "Stagent Solo",
    description: "Power users — expanded limits and advanced history",
    prices: {
      monthly: { id: "price_1TJ2d5RCxnzBPkIX4SnajFok", amount: 1900, currency: "usd" },
      annual: { id: "price_1TJ2d5RCxnzBPkIXjjiyc7lb", amount: 19000, currency: "usd" },
    },
    paymentLink: "https://buy.stripe.com/fZufZjgKC4q9azrgDzdwc06",
  },
  {
    tier: "operator",
    name: "Stagent Operator",
    description: "Professionals — analytics, cloud sync, marketplace publishing",
    prices: {
      monthly: { id: "price_1TJ2e1RCxnzBPkIXZg47cNbO", amount: 4900, currency: "usd" },
      annual: { id: "price_1TJ2e1RCxnzBPkIXODs5fZW2", amount: 49000, currency: "usd" },
    },
    paymentLink: "https://buy.stripe.com/aFa4gB0LE9Kt22Vevrdwc07",
  },
  {
    tier: "scale",
    name: "Stagent Scale",
    description: "Teams — unlimited everything, featured marketplace, priority support",
    prices: {
      monthly: { id: "price_1TJ2evRCxnzBPkIXy9mBqBHB", amount: 9900, currency: "usd" },
      annual: { id: "price_1TJ2evRCxnzBPkIXqIRaDxQp", amount: 99000, currency: "usd" },
    },
    paymentLink: "https://buy.stripe.com/9B628t2TM5udazr72Zdwc08",
  },
];

/** Map from Stripe Price ID → tier for webhook processing */
export const PRICE_TO_TIER: Record<string, LicenseTier> = Object.fromEntries(
  STRIPE_PRODUCTS.flatMap((p) =>
    Object.values(p.prices).map((price) => [price.id, p.tier])
  )
);

/** Get the product for a specific tier */
export function getProductForTier(tier: Exclude<LicenseTier, "community">): StripeProduct | undefined {
  return STRIPE_PRODUCTS.find((p) => p.tier === tier);
}
