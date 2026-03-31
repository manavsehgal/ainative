import { NextRequest, NextResponse } from "next/server";
import { getLatestScan } from "@/lib/environment/data";
import { suggestProfiles, suggestProfilesTiered } from "@/lib/environment/profile-generator";

/** GET: Suggest profiles based on latest (or specified) scan. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scanId = url.searchParams.get("scanId");
  const tiered = url.searchParams.get("tiered") === "true";

  let resolvedScanId = scanId;
  if (!resolvedScanId) {
    const latest = getLatestScan();
    if (!latest) {
      return NextResponse.json({
        suggestions: [],
        curated: [],
        discovered: [],
        message: "No scan found",
      });
    }
    resolvedScanId = latest.id;
  }

  if (tiered) {
    const { curated, discovered } = suggestProfilesTiered(resolvedScanId);
    return NextResponse.json({
      curated,
      discovered,
      curatedCount: curated.length,
      discoveredCount: discovered.length,
    });
  }

  // Legacy flat response (backward-compatible)
  const suggestions = suggestProfiles(resolvedScanId);
  return NextResponse.json({
    suggestions,
    count: suggestions.length,
  });
}
