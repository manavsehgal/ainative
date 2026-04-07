import { NextResponse } from "next/server";
import { tick } from "@/lib/instance/upgrade-poller";

/**
 * POST /api/instance/upgrade/check
 *
 * Force-run the upgrade availability poller. Rate-limited to one call per
 * ~5 minutes via the same lock file the scheduled poller uses. Returns the
 * new UpgradeState on success, or a skipped reason if the lock was held or
 * dev-mode was active.
 */
export async function POST() {
  try {
    const result = await tick();
    if (result.updated) {
      return NextResponse.json({ ok: true, state: result.updated });
    }
    return NextResponse.json(
      { ok: false, skipped: result.skipped, error: result.error },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
