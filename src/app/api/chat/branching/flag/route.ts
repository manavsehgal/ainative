import { NextResponse } from "next/server";
import { isBranchingEnabled } from "@/lib/chat/branching/flag";

/**
 * GET /api/chat/branching/flag
 * Exposes the server-side `AINATIVE_CHAT_BRANCHING` flag to the client without
 * leaking the env var via NEXT_PUBLIC_*. Default off; canonical-true-only.
 */
export async function GET() {
  return NextResponse.json({ enabled: isBranchingEnabled() });
}
