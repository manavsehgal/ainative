import { NextRequest, NextResponse } from "next/server";
import { getArtifactById } from "@/lib/environment/data";

/** GET: Single artifact with full detail. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const artifact = getArtifactById(id);

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  return NextResponse.json({ artifact });
}
