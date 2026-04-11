import { NextResponse } from "next/server";
import { getAppSidebarGroups } from "@/lib/apps/service";

export async function GET() {
  return NextResponse.json({ groups: getAppSidebarGroups() });
}
