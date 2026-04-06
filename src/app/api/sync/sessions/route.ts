import { NextResponse } from "next/server";
import { licenseManager } from "@/lib/license/manager";
import { listSyncSessions } from "@/lib/sync/cloud-sync";

/**
 * GET /api/sync/sessions
 * List recent sync sessions for the current user.
 */
export async function GET() {
  if (!licenseManager.isFeatureAllowed("cloud-sync")) {
    return NextResponse.json(
      { error: "Cloud sync requires Operator tier or above" },
      { status: 402 }
    );
  }

  const email = licenseManager.getStatus().email;
  if (!email) {
    return NextResponse.json({ sessions: [] });
  }

  const sessions = await listSyncSessions(email);
  return NextResponse.json({ sessions });
}
