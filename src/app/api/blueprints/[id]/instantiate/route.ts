import { NextRequest, NextResponse } from "next/server";
import { instantiateBlueprint } from "@/lib/workflows/blueprints/instantiator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { variables, projectId } = await req.json();

    if (!variables || typeof variables !== "object") {
      return NextResponse.json(
        { error: "variables object is required" },
        { status: 400 }
      );
    }

    const result = await instantiateBlueprint(id, variables, projectId);
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to instantiate blueprint";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
