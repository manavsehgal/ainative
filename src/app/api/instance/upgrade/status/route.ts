import { NextResponse } from "next/server";
import { getUpgradeState } from "@/lib/instance/settings";

/**
 * GET /api/instance/upgrade/status
 *
 * Returns the current UpgradeState for client components that need to poll
 * (e.g. the upgrade modal pre-flight). Server Components should read directly
 * from settings per TDR-004 rather than calling this route.
 */
export async function GET() {
  try {
    const state = getUpgradeState();
    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
