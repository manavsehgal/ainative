import { NextResponse } from "next/server";
import { listApps } from "@/lib/apps/registry";

export async function GET() {
  try {
    const apps = listApps();
    return NextResponse.json(apps);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list apps";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
