import { NextRequest, NextResponse } from "next/server";
import { previewSync, executeSync, type SyncRequest } from "@/lib/environment/sync-engine";

/** POST: Execute sync operations with auto-checkpoint. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    operations: SyncRequest[];
    label?: string;
  };

  if (!body.operations?.length) {
    return NextResponse.json(
      { error: "No operations provided" },
      { status: 400 }
    );
  }

  // Preview first to prepare sync operations
  const previews = previewSync(body.operations);

  if (previews.length === 0) {
    return NextResponse.json(
      { error: "No valid operations to execute" },
      { status: 400 }
    );
  }

  // Execute with checkpoint
  const result = executeSync(previews, body.label);

  const applied = result.operations.filter((o) => o.status === "applied").length;
  const failed = result.operations.filter((o) => o.status === "failed").length;

  return NextResponse.json({
    checkpointId: result.checkpointId,
    operations: result.operations,
    summary: {
      applied,
      failed,
      total: result.operations.length,
    },
  });
}
