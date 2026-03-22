import { NextRequest, NextResponse } from "next/server";
import { captureTemplate, listTemplates } from "@/lib/environment/templates";

/** GET: List all templates. */
export async function GET() {
  const templates = listTemplates();
  return NextResponse.json({ templates });
}

/** POST: Capture a new template from a scan. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    scanId: string;
    name: string;
    description?: string;
  };

  if (!body.scanId || !body.name) {
    return NextResponse.json(
      { error: "scanId and name are required" },
      { status: 400 }
    );
  }

  const template = captureTemplate(body.scanId, body.name, body.description);
  return NextResponse.json({ template }, { status: 201 });
}
