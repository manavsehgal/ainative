import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/environment/workspace-context";

export const dynamic = "force-dynamic";

export function GET() {
  const context = getWorkspaceContext();
  return NextResponse.json(context, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
