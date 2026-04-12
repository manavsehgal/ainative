import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { licenseManager } from "@/lib/license/manager";
import { canAccessFeature } from "@/lib/license/features";
import { publishApp } from "@/lib/marketplace/marketplace-client";

export async function POST(request: Request) {
  // Tier gate — Operator+ required
  const tier = licenseManager.getTierFromDb();
  if (!canAccessFeature(tier, "marketplace-publish")) {
    return NextResponse.json(
      { error: "Operator tier or above required to publish apps" },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();

    // Required fields
    const sapFile = formData.get("sap") as File | null;
    const metadataRaw = formData.get("metadata") as string | null;

    if (!sapFile) {
      return NextResponse.json(
        { error: "Missing .sap archive file" },
        { status: 400 },
      );
    }

    if (!metadataRaw) {
      return NextResponse.json(
        { error: "Missing metadata" },
        { status: 400 },
      );
    }

    let metadata: {
      appId: string;
      version: string;
      title: string;
      description: string;
      category: string;
      tags: string[];
      pricingType: "free" | "paid";
      priceCents?: number;
      readme?: string;
      manifestJson: string;
    };

    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      return NextResponse.json(
        { error: "Invalid metadata JSON" },
        { status: 400 },
      );
    }

    // Validate required metadata fields
    if (!metadata.appId || !metadata.version || !metadata.title || !metadata.description) {
      return NextResponse.json(
        { error: "Missing required fields: appId, version, title, description" },
        { status: 400 },
      );
    }

    // Read archive and compute checksum
    const archiveBuffer = new Uint8Array(await sapFile.arrayBuffer());
    const checksum = createHash("sha256")
      .update(archiveBuffer)
      .digest("hex");

    // Publish to marketplace
    const result = await publishApp({
      appId: metadata.appId,
      version: metadata.version,
      title: metadata.title,
      description: metadata.description,
      category: metadata.category ?? "general",
      tags: metadata.tags ?? [],
      pricingType: metadata.pricingType ?? "free",
      priceCents: metadata.priceCents,
      readme: metadata.readme,
      manifestJson: metadata.manifestJson,
      checksumSha256: checksum,
      sapArchive: archiveBuffer,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Publish failed" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        id: result.id,
        appId: metadata.appId,
        version: metadata.version,
        checksum,
        message: `App "${metadata.title}" published successfully`,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
