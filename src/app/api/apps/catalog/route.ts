import { type NextRequest, NextResponse } from "next/server";
import { listAppCatalog } from "@/lib/apps/service";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const apps = listAppCatalog({ category, q });
  return NextResponse.json({ apps });
}
