import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { getChapter } from "@/lib/book/content";
import { getChapterStaleness, detectStaleChapters } from "@/lib/book/update-detector";
import { buildChapterRegenerationPrompt } from "@/lib/book/chapter-generator";
import { executeTaskWithAgent } from "@/lib/agents/router";

export const dynamic = "force-dynamic";

/**
 * POST /api/book/regenerate
 * Create a task to generate/regenerate a book chapter using the document-writer agent.
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

    const isNew = chapter.sections.length === 0;
    const verb = isNew ? "Generate" : "Regenerate";

    // Create a real task with the document-writer profile
    const taskId = crypto.randomUUID();
    const now = new Date();

    await db.insert(tasks).values({
      id: taskId,
      title: `${verb} Chapter ${chapter.number}: ${chapter.title}`,
      description: prompt,
      agentProfile: "document-writer",
      assignedAgent: "claude-code",
      status: "queued",
      priority: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Fire-and-forget execution
    executeTaskWithAgent(taskId, "claude-code");

    return NextResponse.json(
      {
        taskId,
        chapterId,
        chapterTitle: chapter.title,
        chapterNumber: chapter.number,
        isNew,
        staleness,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Regenerate error:", error);
    return NextResponse.json(
      { error: "Failed to start chapter generation" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/book/regenerate
 * Check staleness. Supports ?chapterId=X for a single chapter.
 */
export async function GET(request: NextRequest) {
  try {
    const chapterId = request.nextUrl.searchParams.get("chapterId");

    if (chapterId) {
      const staleness = getChapterStaleness(chapterId);
      if (!staleness) {
        return NextResponse.json(
          { error: `Chapter not found: ${chapterId}` },
          { status: 404 }
        );
      }
      return NextResponse.json(staleness);
    }

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
