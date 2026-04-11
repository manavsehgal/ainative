import { NextResponse } from "next/server";
import { clearAppSampleData } from "@/lib/apps/service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  try {
    const result = await clearAppSampleData(appId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to clear sample data",
      },
      { status: 400 }
    );
  }
}
