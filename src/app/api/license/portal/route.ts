import { NextRequest, NextResponse } from "next/server";
import { createPortalSession } from "@/lib/billing/stripe";

/**
 * GET /api/license/portal
 * Creates a Stripe Customer Portal session and redirects.
 * Query: ?email=user@example.com
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "email query parameter required" },
      { status: 400 }
    );
  }

  const result = await createPortalSession(email);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.redirect(result.url);
}
