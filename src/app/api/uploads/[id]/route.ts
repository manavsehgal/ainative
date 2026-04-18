import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, unlink } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getAinativeUploadsDir } from "@/lib/utils/ainative-paths";
import { eq } from "drizzle-orm";

const UPLOAD_DIR = getAinativeUploadsDir();

const MIME_TYPES: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  js: "text/javascript",
  ts: "text/typescript",
  py: "text/x-python",
  html: "text/html",
  css: "text/css",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const files = await readdir(UPLOAD_DIR);
    const match = files.find((f) => f.startsWith(id));
    if (!match) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filepath = join(UPLOAD_DIR, match);
    const data = await readFile(filepath);
    const ext = match.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    // Force download for all files to prevent stored XSS via inline rendering
    // of attacker-controlled HTML/SVG/JS content
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${match}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const files = await readdir(UPLOAD_DIR);
    const match = files.find((f) => f.startsWith(id));
    if (!match) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filepath = join(UPLOAD_DIR, match);
    await unlink(filepath);
    await db.delete(documents).where(eq(documents.id, id));

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
