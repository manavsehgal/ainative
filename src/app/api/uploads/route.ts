import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { processDocument } from "@/lib/documents/processor";
import { getStagentUploadsDir } from "@/lib/utils/stagent-paths";

const UPLOAD_DIR = getStagentUploadsDir();

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const taskId = formData.get("taskId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const id = crypto.randomUUID();
  const ext = file.name.split(".").pop() ?? "";
  const filename = ext ? `${id}.${ext}` : id;
  const filepath = join(UPLOAD_DIR, filename);

  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(filepath, bytes);

  // Create document record in DB
  await db.insert(documents).values({
    id,
    taskId: taskId ?? null,
    projectId: null,
    filename,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    storagePath: filepath,
    direction: "input",
    status: "uploaded",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Fire-and-forget: trigger async document processing
  processDocument(id).catch((err) =>
    console.error(`[upload] Processing failed for ${id}:`, err)
  );

  return NextResponse.json(
    {
      id,
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      taskId,
    },
    { status: 201 }
  );
}
