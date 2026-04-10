import { NextResponse } from "next/server";
import { logoutStagentCodexAuth } from "@/lib/agents/runtime/openai-codex-auth";

export async function POST() {
  await logoutStagentCodexAuth();
  return NextResponse.json({ success: true });
}
