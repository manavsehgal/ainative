import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const UPLOAD_DIR = join(homedir(), ".stagent", "uploads");

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
