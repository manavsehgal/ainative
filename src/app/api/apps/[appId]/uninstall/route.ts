import { NextResponse } from "next/server";
import { uninstallApp } from "@/lib/apps/service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  try {
    uninstallApp(appId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to uninstall app",
      },
      { status: 400 }
    );
  }
}
