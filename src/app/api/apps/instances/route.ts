import { NextResponse } from "next/server";
import { listInstalledAppInstances } from "@/lib/apps/service";

export async function GET() {
  return NextResponse.json({
    apps: listInstalledAppInstances().map((instance) => ({
      appId: instance.appId,
      name: instance.name,
      version: instance.version,
      projectId: instance.projectId,
      status: instance.status,
      bootstrapError: instance.bootstrapError,
      installedAt: instance.installedAt,
      bootstrappedAt: instance.bootstrappedAt,
      icon: instance.manifest.icon,
      projectHref: instance.projectId ? `/projects/${instance.projectId}` : null,
      openHref: `/apps/${instance.appId}`,
    })),
  });
}
