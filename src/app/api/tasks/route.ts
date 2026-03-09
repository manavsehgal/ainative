import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, documents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createTaskSchema } from "@/lib/validators/task";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const UPLOAD_DIR = join(homedir(), ".stagent", "uploads");

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");

  const conditions = [];
  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  if (status) conditions.push(eq(tasks.status, status as typeof tasks.status.enumValues[number]));

  const result = await db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(tasks.priority, desc(tasks.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(tasks).values({
    id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    projectId: parsed.data.projectId ?? null,
    priority: parsed.data.priority,
    assignedAgent: parsed.data.assignedAgent ?? null,
    status: "planned",
    createdAt: now,
    updatedAt: now,
  });

  // Link uploaded files to the task
  if (parsed.data.fileIds && parsed.data.fileIds.length > 0) {
    try {
      const files = await readdir(UPLOAD_DIR);
      for (const fileId of parsed.data.fileIds) {
        const match = files.find((f) => f.startsWith(fileId));
        if (!match) continue;
        const filepath = join(UPLOAD_DIR, match);
        const fileStat = await stat(filepath);
        const ext = match.split(".").pop()?.toLowerCase() ?? "";
        const mimeType = ext ? getMimeType(ext) : "application/octet-stream";
        await db.insert(documents).values({
          id: fileId,
          taskId: id,
          projectId: parsed.data.projectId ?? null,
          filename: match,
          originalName: match,
          mimeType,
          size: fileStat.size,
          storagePath: filepath,
          direction: "input",
          status: "uploaded",
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch {
      // File association is best-effort — don't fail task creation
    }
  }

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  return NextResponse.json(task, { status: 201 });
}

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

function getMimeType(ext: string): string {
  return MIME_TYPES[ext] ?? "application/octet-stream";
}
