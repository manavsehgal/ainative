import { NextRequest, NextResponse } from "next/server";
import {
  getBlueprint,
  deleteBlueprint,
} from "@/lib/workflows/blueprints/registry";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const blueprint = getBlueprint(id);

  if (!blueprint) {
    return NextResponse.json(
      { error: "Blueprint not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(blueprint);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    deleteBlueprint(id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to delete blueprint";
    const status = message.includes("built-in") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
