import { NextRequest, NextResponse } from "next/server";
import {
  restoreFromSnapshot,
  isSnapshotLocked,
} from "@/lib/snapshots/snapshot-manager";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** POST /api/snapshots/[id]/restore — restore from a snapshot (destructive) */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isSnapshotLocked()) {
    return NextResponse.json(
      { error: "Another snapshot operation is already in progress" },
      { status: 409 }
    );
  }

  // Check for running tasks
  const runningTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.status, "running"));

  if (runningTasks.length > 0) {
    return NextResponse.json(
      {
        error: `${runningTasks.length} task(s) are currently running. Stop them before restoring.`,
        runningTasks: runningTasks.map((t) => ({
          id: t.id,
          title: t.title,
        })),
      },
      { status: 409 }
    );
  }

  try {
    const result = await restoreFromSnapshot(id);

    return NextResponse.json({
      success: true,
      requiresRestart: result.requiresRestart,
      preRestoreSnapshotId: result.preRestoreSnapshotId,
      message:
        "Restore complete. Please restart the server to load the restored database.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to restore snapshot",
      },
      { status: 500 }
    );
  }
}
