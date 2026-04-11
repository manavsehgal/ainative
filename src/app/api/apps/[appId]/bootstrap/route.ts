import { NextResponse } from "next/server";
import { bootstrapApp } from "@/lib/apps/service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  try {
    const instance = await bootstrapApp(appId);
    return NextResponse.json({
      app: {
        appId: instance.appId,
        status: instance.status,
        projectId: instance.projectId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to bootstrap app",
      },
      { status: 400 }
    );
  }
}
