import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, deleteSnapshot } from "@/lib/snapshots/snapshot-manager";

/** GET /api/snapshots/[id] — get snapshot details */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const snapshot = await getSnapshot(id);
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get snapshot" },
      { status: 500 }
    );
  }
}

/** DELETE /api/snapshots/[id] — delete a snapshot and its files */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const deleted = await deleteSnapshot(id);
    if (!deleted) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete snapshot" },
      { status: 500 }
    );
  }
}
