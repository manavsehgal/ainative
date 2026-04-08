import { NextResponse } from "next/server";
import { getUpgradeState } from "@/lib/instance/settings";
import { isDevMode } from "@/lib/instance/detect";

/**
 * GET /api/instance/upgrade/status
 *
 * Returns the current UpgradeState for client components that need to poll
 * (e.g. the upgrade modal pre-flight). Server Components should read directly
 * from settings per TDR-004 rather than calling this route.
 *
 * When running on the canonical dev repo, returns a synthetic state with
 * `devMode: true` and `upgradeAvailable: false` so the sidebar upgrade
 * button never renders on main.
 */
export async function GET() {
  try {
    if (isDevMode()) {
      return NextResponse.json({
        devMode: true,
        lastPolledAt: null,
        upgradeAvailable: false,
        commitsBehind: 0,
        lastSuccessfulUpgradeAt: null,
        pollFailureCount: 0,
        lastPollError: null,
      });
    }
    const state = getUpgradeState();
    return NextResponse.json({ devMode: false, ...state });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
