import { NextRequest, NextResponse } from "next/server";
import {
  listBlueprints,
  createBlueprint,
} from "@/lib/workflows/blueprints/registry";

export async function GET() {
  const blueprints = listBlueprints();
  return NextResponse.json(blueprints);
}

export async function POST(req: NextRequest) {
  try {
    const { yaml: yamlContent } = await req.json();
    if (!yamlContent || typeof yamlContent !== "string") {
      return NextResponse.json(
        { error: "yaml field is required" },
        { status: 400 }
      );
    }

    const blueprint = createBlueprint(yamlContent);
    return NextResponse.json(blueprint, { status: 201 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create blueprint";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
