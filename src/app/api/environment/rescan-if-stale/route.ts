import { NextResponse } from "next/server";
import { shouldRescan, ensureFreshScan } from "@/lib/environment/auto-scan";
import { getLaunchCwd } from "@/lib/environment/workspace-context";

/**
 * Fire-and-forget rescan endpoint for chat session activation.
 * - If last scan is fresh (<5min), returns `{ scanned: false }` without I/O.
 * - Otherwise, runs a scan via `ensureFreshScan` (which catches errors and
 *   returns null on failure), returns `{ scanned: true }`.
 * - Never 500s; the chat UI must not be blocked by env issues.
 */
export async function POST() {
  if (!shouldRescan()) {
    return NextResponse.json({ scanned: false });
  }
  try {
    ensureFreshScan(getLaunchCwd());
  } catch (err) {
    // ensureFreshScan itself catches internally; this is belt + suspenders.
    console.warn("[rescan-if-stale] unexpected:", err);
  }
  return NextResponse.json({ scanned: true });
}
