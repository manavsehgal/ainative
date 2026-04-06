import { NextRequest, NextResponse } from "next/server";
import { licenseManager } from "@/lib/license/manager";
import { importBlueprint } from "@/lib/marketplace/marketplace-client";

/**
 * POST /api/marketplace/import
 * Import a blueprint from the marketplace. Requires Solo+ tier.
 */
export async function POST(req: NextRequest) {
  if (!licenseManager.isFeatureAllowed("marketplace-import")) {
    return NextResponse.json(
      { error: "Blueprint import requires Solo tier or above" },
      { status: 402 }
    );
  }

  const { blueprintId } = await req.json();
  if (!blueprintId) {
    return NextResponse.json({ error: "blueprintId required" }, { status: 400 });
  }

  const result = await importBlueprint(blueprintId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ content: result.content });
}
