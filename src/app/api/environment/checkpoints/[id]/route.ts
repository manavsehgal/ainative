import { NextRequest, NextResponse } from "next/server";
import {
  getCheckpointById,
  updateCheckpointStatus,
  getSyncOps,
} from "@/lib/environment/data";
import { rollbackToCheckpoint, getCheckpointDiff } from "@/lib/environment/git-manager";
import { restoreFromBackup } from "@/lib/environment/backup-manager";
import { getLaunchCwd } from "@/lib/environment/workspace-context";

/** GET: Get checkpoint details with sync operations. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const checkpoint = getCheckpointById(id);

  if (!checkpoint) {
    return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
  }

  const syncOps = getSyncOps(id);

  // Get current diff if git checkpoint exists
  let diff: string | null = null;
  if (checkpoint.gitCommitSha) {
    diff = getCheckpointDiff(getLaunchCwd(), checkpoint.gitCommitSha);
  }

  return NextResponse.json({ checkpoint, syncOps, diff });
}

/** POST: Rollback to this checkpoint. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const checkpoint = getCheckpointById(id);

  if (!checkpoint) {
    return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
  }

  if (checkpoint.status !== "active") {
    return NextResponse.json(
      { error: `Cannot rollback: checkpoint status is ${checkpoint.status}` },
      { status: 400 }
    );
  }

  const results: { git?: { success: boolean; error?: string }; backup?: { restored: number; errors: string[] } } = {};

  // Rollback git changes if applicable
  if (checkpoint.gitCommitSha) {
    const projectDir = getLaunchCwd();
    const gitResult = rollbackToCheckpoint(
      projectDir,
      checkpoint.gitCommitSha,
      checkpoint.label
    );
    results.git = gitResult;

    if (!gitResult.success) {
      return NextResponse.json(
        { error: `Git rollback failed: ${gitResult.error}`, results },
        { status: 500 }
      );
    }
  }

  // Restore file backups if applicable
  if (checkpoint.backupPath) {
    const backupResult = restoreFromBackup(checkpoint.backupPath);
    results.backup = backupResult;
  }

  // Mark checkpoint as rolled back
  updateCheckpointStatus(id, "rolled_back");

  return NextResponse.json({
    message: `Rolled back to: ${checkpoint.label}`,
    results,
  });
}
