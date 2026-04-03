import { NextRequest, NextResponse } from "next/server";
import { getTableHistory } from "@/lib/tables/history";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  const history = getTableHistory(id, limit);
  return NextResponse.json(history);
}
