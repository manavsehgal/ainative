import { NextRequest, NextResponse } from "next/server";
import { previewSync, type SyncRequest } from "@/lib/environment/sync-engine";

/** POST: Preview sync operations (dry run — no file modifications). */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { operations: SyncRequest[] };

  if (!body.operations?.length) {
    return NextResponse.json(
      { error: "No operations provided" },
      { status: 400 }
    );
  }

  const previews = previewSync(body.operations);

  return NextResponse.json({
    previews,
    summary: {
      total: previews.length,
      conflicts: previews.filter((p) => p.hasConflict).length,
      newFiles: previews.filter((p) => p.syncOp.isNew).length,
      totalAdditions: previews.reduce((sum, p) => sum + p.diff.additions, 0),
      totalDeletions: previews.reduce((sum, p) => sum + p.diff.deletions, 0),
    },
  });
}
