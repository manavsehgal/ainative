import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

export async function GET() {
  const autoPromote = await getSetting(SETTINGS_KEYS.AUTO_PROMOTE_SKILLS);
  return NextResponse.json({
    autoPromoteSkills: autoPromote === "true",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.autoPromoteSkills !== undefined) {
    await setSetting(
      SETTINGS_KEYS.AUTO_PROMOTE_SKILLS,
      body.autoPromoteSkills ? "true" : "false"
    );
  }

  const autoPromote = await getSetting(SETTINGS_KEYS.AUTO_PROMOTE_SKILLS);
  return NextResponse.json({
    autoPromoteSkills: autoPromote === "true",
  });
}
