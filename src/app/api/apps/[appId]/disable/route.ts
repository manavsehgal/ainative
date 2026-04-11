import { NextResponse } from "next/server";
import { setAppInstanceStatus } from "@/lib/apps/service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  try {
    const instance = setAppInstanceStatus(appId, "disabled");
    return NextResponse.json({ app: { appId: instance.appId, status: instance.status } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to disable app",
      },
      { status: 400 }
    );
  }
}
