import { NextRequest, NextResponse } from "next/server";
import { deleteAppCascade, getApp } from "@/lib/apps/registry";

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

  try {
    const result = await deleteAppCascade(id);
    if (!result.filesRemoved && !result.projectRemoved) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      filesRemoved: result.filesRemoved,
      projectRemoved: result.projectRemoved,
    });
  } catch (err) {
    console.error("App delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
