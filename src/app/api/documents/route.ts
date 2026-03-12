import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, tasks, projects } from "@/lib/db/schema";
import { eq, and, like, or, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId");
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");
  const direction = url.searchParams.get("direction");
  const search = url.searchParams.get("search");

  const conditions = [];

  if (taskId) conditions.push(eq(documents.taskId, taskId));
  if (projectId) conditions.push(eq(documents.projectId, projectId));
  if (status) conditions.push(eq(documents.status, status as "uploaded" | "processing" | "ready" | "error"));
  if (direction) conditions.push(eq(documents.direction, direction as "input" | "output"));

  if (search) {
    conditions.push(
      or(
        like(documents.originalName, `%${search}%`),
        like(documents.extractedText, `%${search}%`)
      )
    );
  }

  const result = await db
    .select({
      id: documents.id,
      taskId: documents.taskId,
      projectId: documents.projectId,
      filename: documents.filename,
      originalName: documents.originalName,
      mimeType: documents.mimeType,
      size: documents.size,
      storagePath: documents.storagePath,
      version: documents.version,
      direction: documents.direction,
      category: documents.category,
      status: documents.status,
      extractedText: documents.extractedText,
      processedPath: documents.processedPath,
      processingError: documents.processingError,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      taskTitle: tasks.title,
      projectName: projects.name,
    })
    .from(documents)
    .leftJoin(tasks, eq(documents.taskId, tasks.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(documents.createdAt));

  return NextResponse.json(result);
}
