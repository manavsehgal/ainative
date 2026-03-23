import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

export async function GET() {
  const sdkTimeoutSeconds = await getSetting(SETTINGS_KEYS.SDK_TIMEOUT_SECONDS);
  return NextResponse.json({
    sdkTimeoutSeconds: sdkTimeoutSeconds ?? "60",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const seconds = parseInt(body.sdkTimeoutSeconds, 10);

  if (isNaN(seconds) || seconds < 10 || seconds > 300) {
    return NextResponse.json(
      { error: "sdkTimeoutSeconds must be between 10 and 300" },
      { status: 400 }
    );
  }

  await setSetting(SETTINGS_KEYS.SDK_TIMEOUT_SECONDS, String(seconds));
  return NextResponse.json({ sdkTimeoutSeconds: String(seconds) });
}
