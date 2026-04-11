import { NextRequest, NextResponse } from "next/server";
import { canAccessFeature } from "@/lib/license/features";
import { licenseManager } from "@/lib/license/manager";
import { installApp } from "@/lib/apps/service";

export async function POST(req: NextRequest) {
  const tier = licenseManager.getTierFromDb();
  if (!canAccessFeature(tier, "marketplace-import")) {
    return NextResponse.json(
      { error: "Marketplace app install requires Solo or above." },
      { status: 402 }
    );
  }

  const body = (await req.json()) as { appId?: string; projectName?: string };
  if (!body.appId) {
    return NextResponse.json({ error: "appId is required" }, { status: 400 });
  }

  try {
    const instance = await installApp(body.appId, body.projectName);
    return NextResponse.json({
      app: {
        appId: instance.appId,
        name: instance.name,
        status: instance.status,
        projectId: instance.projectId,
        openHref: `/apps/${instance.appId}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to install app",
      },
      { status: 400 }
    );
  }
}
