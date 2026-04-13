import { NextResponse } from "next/server";
import { listSyncSessions } from "@/lib/sync/cloud-sync";
import { getSettingSync } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

/**
 * GET /api/sync/sessions
 * List recent sync sessions for the current user.
 */
export async function GET() {
  const email = getSettingSync(SETTINGS_KEYS.CLOUD_EMAIL);
  if (!email) {
    return NextResponse.json({ sessions: [] });
  }

  const sessions = await listSyncSessions(email);
  return NextResponse.json({ sessions });
}
