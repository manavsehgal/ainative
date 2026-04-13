import { NextRequest, NextResponse } from "next/server";
import { exportAndUpload } from "@/lib/sync/cloud-sync";
import { getSettingSync } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

/**
 * POST /api/sync/export
 * Export and encrypt the database, upload to Supabase Storage.
 * Requires Operator+ tier and an authenticated Supabase session.
 * Body: { accessToken: string } — the user's Supabase JWT
 */
export async function POST(req: NextRequest) {
  const { getSettingSync } = await import("@/lib/settings/helpers");
  const { SETTINGS_KEYS } = await import("@/lib/constants/settings");
  const email = getSettingSync(SETTINGS_KEYS.CLOUD_EMAIL);
  if (!email) {
    return NextResponse.json(
      { error: "Sign in with your email first (Settings → Cloud Account)" },
      { status: 400 }
    );
  }

  // Get the user's access token for authenticated Storage uploads
  const body = await req.json().catch(() => ({}));
  const accessToken = body.accessToken as string | undefined;

  let deviceId = getSettingSync(SETTINGS_KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    const { setSetting } = await import("@/lib/settings/helpers");
    await setSetting(SETTINGS_KEYS.DEVICE_ID, deviceId);
  }

  const result = await exportAndUpload(email, deviceId, accessToken);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { setSetting } = await import("@/lib/settings/helpers");
  await setSetting(SETTINGS_KEYS.LAST_SYNC_AT, new Date().toISOString());

  return NextResponse.json({
    success: true,
    blobPath: result.blobPath,
    sizeBytes: result.sizeBytes,
  });
}
