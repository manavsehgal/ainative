import { NextResponse } from "next/server";
import {
  getInstanceConfig,
  getGuardrails,
  getUpgradeState,
} from "@/lib/instance/settings";
import { isDevMode } from "@/lib/instance/detect";

/**
 * GET /api/instance/config
 *
 * Returns the full instance state: config, guardrails, and upgrade state
 * in a single response. Used by the Settings → Instance section and by
 * the upgrade pre-flight modal.
 *
 * When running on the canonical dev repo (STAGENT_DEV_MODE=true or the
 * .git/stagent-dev-mode sentinel), returns `{ devMode: true }` with null
 * payloads. This prevents stale instance rows written during prior testing
 * from surfacing in the UI as if the dev repo were a real instance.
 */
export async function GET() {
  try {
    if (isDevMode()) {
      return NextResponse.json({
        devMode: true,
        config: null,
        guardrails: null,
        upgrade: null,
      });
    }
    return NextResponse.json({
      devMode: false,
      config: getInstanceConfig(),
      guardrails: getGuardrails(),
      upgrade: getUpgradeState(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
