import { NextResponse } from "next/server";
import { getChapter } from "@/lib/book/content";
import { getChapterStaleness } from "@/lib/book/update-detector";
import { buildChapterRegenerationPrompt } from "@/lib/book/chapter-generator";

export const dynamic = "force-dynamic";

/**
 * POST /api/book/regenerate
 * Trigger chapter regeneration. Returns the prompt and staleness info.
 * In a full implementation, this would create a workflow task.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chapterId } = body;

    if (!chapterId || typeof chapterId !== "string") {
      return NextResponse.json(
        { error: "chapterId is required" },
        { status: 400 }
      );
    }

    const chapter = getChapter(chapterId);
    if (!chapter) {
      return NextResponse.json(
        { error: `Chapter not found: ${chapterId}` },
        { status: 404 }
      );
    }

    // Check staleness
    const staleness = getChapterStaleness(chapterId);

    // Build the regeneration prompt
    const prompt = buildChapterRegenerationPrompt(chapterId);

    // In a full implementation, this would:
    // 1. Create a workflow instance with the planner-executor pattern
    // 2. Assign the document-writer agent profile
    // 3. Create a review task for human approval
    // For now, return the prompt and staleness info for manual use

    return NextResponse.json(
      {
        chapterId,
        chapterTitle: chapter.title,
        staleness,
        prompt,
        message:
          "Chapter regeneration prompt generated. In production, this would create a workflow task for the document-writer agent.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Regenerate error:", error);
    return NextResponse.json(
      { error: "Failed to generate regeneration prompt" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/book/regenerate
 * Check staleness for all chapters.
 */
export async function GET() {
  try {
    const { detectStaleChapters } = await import(
      "@/lib/book/update-detector"
    );
    const staleness = detectStaleChapters();
    return NextResponse.json({ chapters: staleness });
  } catch (error) {
    console.error("Staleness check error:", error);
    return NextResponse.json(
      { error: "Failed to check staleness" },
      { status: 500 }
    );
  }
}
