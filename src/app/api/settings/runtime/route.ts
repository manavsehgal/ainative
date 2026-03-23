import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

export async function GET() {
  const sdkTimeoutSeconds = await getSetting(SETTINGS_KEYS.SDK_TIMEOUT_SECONDS);
  const maxTurns = await getSetting(SETTINGS_KEYS.MAX_TURNS);
  return NextResponse.json({
    sdkTimeoutSeconds: sdkTimeoutSeconds ?? "60",
    maxTurns: maxTurns ?? "10",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.sdkTimeoutSeconds !== undefined) {
    const seconds = parseInt(body.sdkTimeoutSeconds, 10);
    if (isNaN(seconds) || seconds < 10 || seconds > 300) {
      return NextResponse.json(
        { error: "sdkTimeoutSeconds must be between 10 and 300" },
        { status: 400 }
      );
    }
    await setSetting(SETTINGS_KEYS.SDK_TIMEOUT_SECONDS, String(seconds));
  }

  if (body.maxTurns !== undefined) {
    const turns = parseInt(body.maxTurns, 10);
    if (isNaN(turns) || turns < 1 || turns > 50) {
      return NextResponse.json(
        { error: "maxTurns must be between 1 and 50" },
        { status: 400 }
      );
    }
    await setSetting(SETTINGS_KEYS.MAX_TURNS, String(turns));
  }

  const sdkTimeoutSeconds = await getSetting(SETTINGS_KEYS.SDK_TIMEOUT_SECONDS);
  const maxTurns = await getSetting(SETTINGS_KEYS.MAX_TURNS);

  return NextResponse.json({
    sdkTimeoutSeconds: sdkTimeoutSeconds ?? "60",
    maxTurns: maxTurns ?? "10",
  });
}
