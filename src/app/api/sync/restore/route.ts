import { NextResponse } from "next/server";
import { licenseManager } from "@/lib/license/manager";
import { downloadAndRestore } from "@/lib/sync/cloud-sync";

/**
 * POST /api/sync/restore
 * Download the latest snapshot, decrypt, and restore.
 * Requires Operator+ tier. Creates a safety backup first.
 */
export async function POST() {
  if (!licenseManager.isFeatureAllowed("cloud-sync")) {
    return NextResponse.json(
      { error: "Cloud sync requires Operator tier or above" },
      { status: 402 }
    );
  }

  const email = licenseManager.getStatus().email;
  if (!email) {
    return NextResponse.json(
      { error: "No license email — activate your license first" },
      { status: 400 }
    );
  }

  const result = await downloadAndRestore(email);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    sizeBytes: result.sizeBytes,
    message: "Database restored. Restart the app to apply changes.",
  });
}
