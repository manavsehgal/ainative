import { NextRequest, NextResponse } from "next/server";
import { getRoutingPreference, setRoutingPreference } from "@/lib/settings/routing";
import type { RoutingPreference } from "@/lib/constants/settings";

const VALID_VALUES: RoutingPreference[] = ["cost", "latency", "quality", "manual"];

export async function GET() {
  const preference = await getRoutingPreference();
  return NextResponse.json({ preference });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.preference || !VALID_VALUES.includes(body.preference)) {
    return NextResponse.json(
      { error: `preference must be one of: ${VALID_VALUES.join(", ")}` },
      { status: 400 },
    );
  }

  await setRoutingPreference(body.preference);
  return NextResponse.json({ preference: body.preference });
}
