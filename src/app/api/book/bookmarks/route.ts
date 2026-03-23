import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/** GET /api/book/bookmarks — return all bookmarks */
export async function GET() {
  const rows = db.select().from(bookmarks).all();
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      chapterId: r.chapterId,
      sectionId: r.sectionId,
      scrollPosition: r.scrollPosition,
      label: r.label,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}

/** POST /api/book/bookmarks — create a bookmark */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { chapterId, sectionId, scrollPosition, label } = body as {
    chapterId: string;
    sectionId?: string;
    scrollPosition: number;
    label: string;
  };

  if (!chapterId || !label) {
    return NextResponse.json({ error: "chapterId and label required" }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date();

  db.insert(bookmarks)
    .values({
      id,
      chapterId,
      sectionId: sectionId ?? null,
      scrollPosition: scrollPosition ?? 0,
      label,
      createdAt: now,
    })
    .run();

  return NextResponse.json({
    id,
    chapterId,
    sectionId: sectionId ?? null,
    scrollPosition: scrollPosition ?? 0,
    label,
    createdAt: now.toISOString(),
  }, { status: 201 });
}

/** DELETE /api/book/bookmarks?id=xxx — delete a bookmark */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const result = db.delete(bookmarks).where(eq(bookmarks.id, id)).run();
  if (result.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
