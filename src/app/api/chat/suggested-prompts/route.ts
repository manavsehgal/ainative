import { NextResponse } from "next/server";
import { getPromptCategories } from "@/lib/chat/suggested-prompts";

/**
 * GET /api/chat/suggested-prompts
 * Return context-aware prompt categories with sub-prompts.
 */
export async function GET() {
  const categories = await getPromptCategories();
  return NextResponse.json(categories);
}
