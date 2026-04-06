import { NextResponse } from "next/server";
import { licenseManager } from "@/lib/license/manager";
import { exportAndUpload } from "@/lib/sync/cloud-sync";
import { getSettingSync } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

/**
 * POST /api/sync/export
 * Export and encrypt the database, upload to Supabase Storage.
 * Requires Operator+ tier.
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

  let deviceId = getSettingSync(SETTINGS_KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    // Store device ID for future syncs
    const { setSetting } = await import("@/lib/settings/helpers");
    await setSetting(SETTINGS_KEYS.DEVICE_ID, deviceId);
  }

  const result = await exportAndUpload(email, deviceId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Update last sync timestamp
  const { setSetting } = await import("@/lib/settings/helpers");
  await setSetting(SETTINGS_KEYS.LAST_SYNC_AT, new Date().toISOString());

  return NextResponse.json({
    success: true,
    blobPath: result.blobPath,
    sizeBytes: result.sizeBytes,
  });
}
