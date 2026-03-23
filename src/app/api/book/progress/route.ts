import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readingProgress } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** GET /api/book/progress — return all chapter progress */
export async function GET() {
  const rows = db.select().from(readingProgress).all();
  // Return as a map: chapterId → { progress, scrollPosition, lastReadAt }
  const result: Record<string, { progress: number; scrollPosition: number; lastReadAt: string }> = {};
  for (const row of rows) {
    result[row.chapterId] = {
      // progress is stored as integer 0–1000 for precision in SQLite
      progress: row.progress / 1000,
      scrollPosition: row.scrollPosition,
      lastReadAt: row.lastReadAt.toISOString(),
    };
  }
  return NextResponse.json(result);
}

/** PUT /api/book/progress — upsert progress for a chapter */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { chapterId, progress: pct, scrollPosition } = body as {
    chapterId: string;
    progress: number;
    scrollPosition: number;
  };

  if (!chapterId || typeof pct !== "number") {
    return NextResponse.json({ error: "chapterId and progress required" }, { status: 400 });
  }

  const now = new Date();
  // Store progress as integer 0–1000
  const progressInt = Math.round(Math.min(1, Math.max(0, pct)) * 1000);

  // Check existing to enforce high-water mark
  const existing = db
    .select()
    .from(readingProgress)
    .where(eq(readingProgress.chapterId, chapterId))
    .get();

  if (existing && existing.progress >= progressInt) {
    // Only update scroll position and timestamp, don't decrease progress
    db.update(readingProgress)
      .set({
        scrollPosition: scrollPosition ?? existing.scrollPosition,
        lastReadAt: now,
        updatedAt: now,
      })
      .where(eq(readingProgress.chapterId, chapterId))
      .run();
  } else if (existing) {
    db.update(readingProgress)
      .set({
        progress: progressInt,
        scrollPosition: scrollPosition ?? 0,
        lastReadAt: now,
        updatedAt: now,
      })
      .where(eq(readingProgress.chapterId, chapterId))
      .run();
  } else {
    db.insert(readingProgress)
      .values({
        chapterId,
        progress: progressInt,
        scrollPosition: scrollPosition ?? 0,
        lastReadAt: now,
        updatedAt: now,
      })
      .run();
  }

  return NextResponse.json({ ok: true });
}
