import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const UPLOAD_DIR = join(homedir(), ".stagent", "uploads");

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

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${match}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
