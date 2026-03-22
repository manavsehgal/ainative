import { NextResponse } from "next/server";
import { getSuggestedPrompts } from "@/lib/chat/suggested-prompts";

/**
 * GET /api/chat/suggested-prompts
 * Return context-aware chat suggestions.
 */
export async function GET() {
  const prompts = await getSuggestedPrompts();
  return NextResponse.json(prompts);
}
