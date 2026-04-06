import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { TIERS } from "@/lib/license/tier-limits";

/**
 * POST /api/license/checkout
 * Creates a Stripe Checkout Session and returns the URL.
 * Body: { tier: "solo"|"operator"|"scale", billingPeriod?: "monthly"|"annual" }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tier, billingPeriod } = body;

  if (!tier || tier === "community" || !TIERS.includes(tier)) {
    return NextResponse.json(
      { error: "Valid paid tier required (solo, operator, scale)" },
      { status: 400 }
    );
  }

  const result = await createCheckoutSession(tier, billingPeriod ?? "monthly");

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ url: result.url });
}
