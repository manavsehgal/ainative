import { NextResponse } from "next/server";
import { downloadAndRestore } from "@/lib/sync/cloud-sync";
import { getSettingSync } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

/**
 * POST /api/sync/restore
 * Download the latest snapshot, decrypt, and restore.
 * Creates a safety backup first.
 */
export async function POST() {
  const email = getSettingSync(SETTINGS_KEYS.CLOUD_EMAIL);
  if (!email) {
    return NextResponse.json(
      { error: "Sign in with your email first (Settings → Cloud Account)" },
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
