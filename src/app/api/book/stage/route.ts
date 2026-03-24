import { NextResponse } from "next/server";
import { getUsageStage } from "@/lib/docs/usage-stage";
import { recommendPath } from "@/lib/book/reading-paths";

export const dynamic = "force-dynamic";

export async function GET() {
  const stage = await getUsageStage();
  return NextResponse.json({
    stage,
    recommendedPath: recommendPath(stage),
  });
}
