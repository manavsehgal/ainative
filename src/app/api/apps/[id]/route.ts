import { NextRequest, NextResponse } from "next/server";
import { deleteApp, getApp } from "@/lib/apps/registry";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const app = getApp(id);
  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });
  return NextResponse.json(app);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const removed = deleteApp(id);
  if (!removed) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
