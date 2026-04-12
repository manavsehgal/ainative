import { NextResponse } from "next/server";
import { deleteSapApp } from "@/lib/apps/service";

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
      // No body — default to false
    }

    await deleteSapApp(appId, { deleteProject });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete app package",
      },
      { status: 400 },
    );
  }
}
