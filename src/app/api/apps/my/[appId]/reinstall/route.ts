import { NextResponse } from "next/server";
import { reinstallArchivedApp } from "@/lib/apps/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;

  try {
    let projectName: string | undefined;
    try {
      const body = (await req.json()) as { projectName?: string };
      projectName = body.projectName;
    } catch {
      // No body — use default name
    }

    const instance = await reinstallArchivedApp(appId, projectName);
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
          error instanceof Error ? error.message : "Failed to reinstall app",
      },
      { status: 400 },
    );
  }
}
