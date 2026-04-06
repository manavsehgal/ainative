import { NextRequest, NextResponse } from "next/server";
import { browseBlueprints } from "@/lib/marketplace/marketplace-client";

/**
 * GET /api/marketplace/browse?page=1&category=general
 * Browse published marketplace blueprints. Available to all tiers.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const category = searchParams.get("category") ?? undefined;

  const result = await browseBlueprints(page, category);
  return NextResponse.json(result);
}
