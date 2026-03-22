import { NextRequest, NextResponse } from "next/server";
import { getCheckpoints, getSyncOps } from "@/lib/environment/data";

/** GET: List past sync operations grouped by checkpoint. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const checkpoints = getCheckpoints(projectId || undefined)
    .filter((cp) => cp.checkpointType === "pre-sync")
    .slice(0, limit);

  const history = checkpoints.map((cp) => ({
    checkpoint: cp,
    operations: getSyncOps(cp.id),
  }));

  return NextResponse.json({ history, count: history.length });
}
