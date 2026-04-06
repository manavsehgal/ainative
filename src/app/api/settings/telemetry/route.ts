import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

export async function GET() {
  const enabled = await getSetting(SETTINGS_KEYS.TELEMETRY_ENABLED);
  return NextResponse.json({ enabled: enabled === "true" });
}

export async function POST(req: NextRequest) {
  const { enabled } = await req.json();
  await setSetting(SETTINGS_KEYS.TELEMETRY_ENABLED, String(!!enabled));
  return NextResponse.json({ enabled: !!enabled });
}
