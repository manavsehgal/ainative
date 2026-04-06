import { NextRequest, NextResponse } from "next/server";
import { licenseManager } from "@/lib/license/manager";
import { publishBlueprint } from "@/lib/marketplace/marketplace-client";

/**
 * POST /api/marketplace/publish
 * Publish a workflow blueprint to the marketplace. Requires Operator+ tier.
 */
export async function POST(req: NextRequest) {
  if (!licenseManager.isFeatureAllowed("marketplace-publish")) {
    return NextResponse.json(
      { error: "Blueprint publishing requires Operator tier or above" },
      { status: 402 }
    );
  }

  const body = await req.json();
  const { title, description, category, content, tags } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 }
    );
  }

  const result = await publishBlueprint({
    title,
    description: description ?? "",
    category: category ?? "general",
    content,
    tags: tags ?? [],
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
