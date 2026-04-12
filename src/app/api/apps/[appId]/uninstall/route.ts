import { NextResponse } from "next/server";
import { uninstallApp } from "@/lib/apps/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;

  try {
    let deleteProject = false;
    try {
      const body = (await req.json()) as { deleteProject?: boolean };
      deleteProject = body.deleteProject === true;
    } catch {
      // No body or invalid JSON — default to false
    }

    uninstallApp(appId, { deleteProject });
    return NextResponse.json({ success: true, projectDeleted: deleteProject });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to uninstall app",
      },
      { status: 400 },
    );
  }
}
