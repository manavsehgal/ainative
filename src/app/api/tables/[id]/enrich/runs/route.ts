import { NextRequest, NextResponse } from "next/server";
import { listRecentEnrichmentRuns } from "@/lib/tables/enrichment";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = req.nextUrl.searchParams;
  const rawLimit = Number(searchParams.get("limit") ?? "5");
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 10)
    : 5;

  try {
    const runs = await listRecentEnrichmentRuns(id, limit);
    return NextResponse.json(runs);
  } catch (err) {
    console.error("[tables/enrich/runs] GET error:", err);
    return NextResponse.json(
      { error: "Failed to load recent enrichment runs" },
      { status: 500 }
    );
  }
}
