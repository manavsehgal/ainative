import { NextResponse } from "next/server";
import { ensureInstance } from "@/lib/instance/bootstrap";
import {
  getInstanceConfig,
  getGuardrails,
  getUpgradeState,
} from "@/lib/instance/settings";

/**
 * POST /api/instance/init
 *
 * Idempotent manual re-run of the instance bootstrap. Useful when the
 * initial boot-time run failed (permission error, git not installed),
 * or when the user wants to re-apply guardrails after changing consent
 * via the Settings → Instance UI.
 *
 * Returns the current instance config + guardrails + upgrade state after
 * the re-run so the Settings → Instance section can refresh its display
 * without a second request.
 */
export async function POST() {
  try {
    const result = await ensureInstance();
    return NextResponse.json({
      ensureResult: result,
      config: getInstanceConfig(),
      guardrails: getGuardrails(),
      upgrade: getUpgradeState(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
