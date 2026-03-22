import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/environment/workspace-context";

export function GET() {
  const context = getWorkspaceContext();
  return NextResponse.json(context, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
