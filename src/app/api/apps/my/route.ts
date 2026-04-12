import { NextResponse } from "next/server";
import { listMyApps } from "@/lib/apps/service";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const apps = listMyApps();
    return NextResponse.json({ apps, count: apps.length });
  } catch (error) {
    console.error("[api/apps/my] Failed to list my apps:", error);
    return NextResponse.json({ apps: [], count: 0 });
  }
}
