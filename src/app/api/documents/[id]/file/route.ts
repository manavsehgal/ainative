import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  const [doc] = await db
    .select({
      originalName: documents.originalName,
      mimeType: documents.mimeType,
      storagePath: documents.storagePath,
    })
    .from(documents)
    .where(eq(documents.id, id));

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const data = await readFile(doc.storagePath);
    const filename = basename(doc.originalName);
    const canInline =
      inline && (doc.mimeType.startsWith("image/") || doc.mimeType === "application/pdf");

    return new NextResponse(data, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `${canInline ? "inline" : "attachment"}; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
