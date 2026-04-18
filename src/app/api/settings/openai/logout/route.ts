import { NextResponse } from "next/server";
import { logoutCodexAuth } from "@/lib/agents/runtime/openai-codex-auth";

export async function POST() {
  await logoutCodexAuth();
  return NextResponse.json({ success: true });
}
