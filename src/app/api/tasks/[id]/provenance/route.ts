import { NextRequest, NextResponse } from "next/server";
import { buildTaskProvenance } from "@/lib/agents/provenance";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const provenance = await buildTaskProvenance(id);

  if (!provenance) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(provenance);
}
