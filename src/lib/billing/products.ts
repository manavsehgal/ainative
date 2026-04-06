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

/**
 * Stripe product catalog.
 *
 * TODO: Replace placeholder IDs with actual Stripe dashboard values.
 * Payment Link URLs are generated in Stripe dashboard.
 */
export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    tier: "solo",
    name: "Stagent Solo",
    description: "Power users — expanded limits and advanced history",
    prices: {
      monthly: { id: "price_solo_monthly", amount: 1900, currency: "usd" },
      annual: { id: "price_solo_annual", amount: 19000, currency: "usd" },
    },
    paymentLink: "https://buy.stripe.com/SOLO_LINK",
  },
  {
    tier: "operator",
    name: "Stagent Operator",
    description: "Professionals — analytics, cloud sync, marketplace publishing",
    prices: {
      monthly: { id: "price_operator_monthly", amount: 4900, currency: "usd" },
      annual: { id: "price_operator_annual", amount: 49000, currency: "usd" },
    },
    paymentLink: "https://buy.stripe.com/OPERATOR_LINK",
  },
  {
    tier: "scale",
    name: "Stagent Scale",
    description: "Teams — unlimited everything, featured marketplace, priority support",
    prices: {
      monthly: { id: "price_scale_monthly", amount: 9900, currency: "usd" },
      annual: { id: "price_scale_annual", amount: 99000, currency: "usd" },
    },
    paymentLink: "https://buy.stripe.com/SCALE_LINK",
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
