import { NextRequest, NextResponse } from "next/server";
import { getRowHistory, rollbackRow } from "@/lib/tables/history";

interface RouteContext {
  params: Promise<{ id: string; rowId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { rowId } = await params;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

  const history = getRowHistory(rowId, limit);
  return NextResponse.json(history);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  await params; // validate route
  const body = await req.json();
  const { historyEntryId } = body as { historyEntryId?: string };

  if (!historyEntryId) {
    return NextResponse.json({ error: "historyEntryId is required" }, { status: 400 });
  }

  const success = rollbackRow(historyEntryId);
  if (!success) {
    return NextResponse.json({ error: "History entry not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
