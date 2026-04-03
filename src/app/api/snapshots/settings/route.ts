import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";

const SETTINGS_KEYS = {
  enabled: "snapshot.autoBackup.enabled",
  interval: "snapshot.autoBackup.interval",
  maxCount: "snapshot.retention.maxCount",
  maxAgeWeeks: "snapshot.retention.maxAgeWeeks",
} as const;

const DEFAULTS = {
  enabled: "false",
  interval: "1d",
  maxCount: "10",
  maxAgeWeeks: "4",
} as const;

/** GET /api/snapshots/settings — read snapshot settings */
export async function GET() {
  try {
    const [enabled, interval, maxCount, maxAgeWeeks] = await Promise.all([
      getSetting(SETTINGS_KEYS.enabled),
      getSetting(SETTINGS_KEYS.interval),
      getSetting(SETTINGS_KEYS.maxCount),
      getSetting(SETTINGS_KEYS.maxAgeWeeks),
    ]);

    return NextResponse.json({
      enabled: enabled ?? DEFAULTS.enabled,
      interval: interval ?? DEFAULTS.interval,
      maxCount: maxCount ?? DEFAULTS.maxCount,
      maxAgeWeeks: maxAgeWeeks ?? DEFAULTS.maxAgeWeeks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read settings" },
      { status: 500 }
    );
  }
}

/** PUT /api/snapshots/settings — update snapshot settings */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.enabled !== undefined) {
      await setSetting(SETTINGS_KEYS.enabled, String(body.enabled));
    }
    if (body.interval !== undefined) {
      await setSetting(SETTINGS_KEYS.interval, String(body.interval));
    }
    if (body.maxCount !== undefined) {
      await setSetting(SETTINGS_KEYS.maxCount, String(body.maxCount));
    }
    if (body.maxAgeWeeks !== undefined) {
      await setSetting(SETTINGS_KEYS.maxAgeWeeks, String(body.maxAgeWeeks));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}
