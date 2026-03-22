import { NextRequest, NextResponse } from "next/server";
import { getArtifacts, getLatestScan } from "@/lib/environment/data";
import type { ArtifactCategory, ToolPersona, ArtifactScope } from "@/lib/environment/types";

/** GET: Filtered artifact list from the latest (or specified) scan. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scanId = url.searchParams.get("scanId");
  const category = url.searchParams.get("category") as ArtifactCategory | null;
  const tool = url.searchParams.get("tool") as ToolPersona | null;
  const scope = url.searchParams.get("scope") as ArtifactScope | null;
  const search = url.searchParams.get("search");

  // Resolve scan ID — use provided or fall back to latest
  let resolvedScanId = scanId;
  if (!resolvedScanId) {
    const latestScan = getLatestScan();
    if (!latestScan) {
      return NextResponse.json({ artifacts: [], message: "No scan found. Trigger a scan first." });
    }
    resolvedScanId = latestScan.id;
  }

  const artifacts = getArtifacts({
    scanId: resolvedScanId,
    category: category || undefined,
    tool: tool || undefined,
    scope: scope || undefined,
    search: search || undefined,
  });

  return NextResponse.json({ artifacts, count: artifacts.length });
}
