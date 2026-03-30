import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

export async function GET() {
  const exaEnabled = await getSetting(SETTINGS_KEYS.EXA_SEARCH_MCP_ENABLED);

  return NextResponse.json({
    exaSearchEnabled: exaEnabled === "true",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.exaSearchEnabled !== undefined) {
    await setSetting(
      SETTINGS_KEYS.EXA_SEARCH_MCP_ENABLED,
      body.exaSearchEnabled ? "true" : "false"
    );
  }

  const exaEnabled = await getSetting(SETTINGS_KEYS.EXA_SEARCH_MCP_ENABLED);

  return NextResponse.json({
    exaSearchEnabled: exaEnabled === "true",
  });
}
