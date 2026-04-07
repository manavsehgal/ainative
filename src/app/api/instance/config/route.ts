import { NextResponse } from "next/server";
import {
  getInstanceConfig,
  getGuardrails,
  getUpgradeState,
} from "@/lib/instance/settings";

/**
 * GET /api/instance/config
 *
 * Returns the full instance state: config, guardrails, and upgrade state
 * in a single response. Used by the Settings → Instance section and by
 * the upgrade pre-flight modal.
 */
export async function GET() {
  try {
    return NextResponse.json({
      config: getInstanceConfig(),
      guardrails: getGuardrails(),
      upgrade: getUpgradeState(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
