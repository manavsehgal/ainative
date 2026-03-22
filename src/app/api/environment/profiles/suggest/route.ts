import { NextRequest, NextResponse } from "next/server";
import { getLatestScan } from "@/lib/environment/data";
import { suggestProfiles } from "@/lib/environment/profile-generator";

/** GET: Suggest profiles based on latest (or specified) scan. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scanId = url.searchParams.get("scanId");

  let resolvedScanId = scanId;
  if (!resolvedScanId) {
    const latest = getLatestScan();
    if (!latest) {
      return NextResponse.json({ suggestions: [], message: "No scan found" });
    }
    resolvedScanId = latest.id;
  }

  const suggestions = suggestProfiles(resolvedScanId);

  return NextResponse.json({
    suggestions,
    count: suggestions.length,
  });
}
