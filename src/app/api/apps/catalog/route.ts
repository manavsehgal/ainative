import { NextResponse } from "next/server";
import { listAppCatalog } from "@/lib/apps/service";

export async function GET() {
  return NextResponse.json({ apps: listAppCatalog() });
}
