import { NextRequest, NextResponse } from "next/server";
import { getTemplate, deleteTemplate, parseManifest } from "@/lib/environment/templates";

/** GET: Get template detail with parsed manifest. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = getTemplate(id);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const manifest = parseManifest(template);

  return NextResponse.json({ template, manifest });
}

/** DELETE: Remove a template. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteTemplate(id);

  if (!deleted) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Template deleted" });
}
