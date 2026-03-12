import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, documents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createTaskSchema } from "@/lib/validators/task";
import { processDocument } from "@/lib/documents/processor";
import { validateRuntimeProfileAssignment } from "@/lib/agents/profiles/assignment-validation";

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

  const compatibilityError = validateRuntimeProfileAssignment({
    profileId: parsed.data.agentProfile,
    runtimeId: parsed.data.assignedAgent,
    context: "Task profile",
  });
  if (compatibilityError) {
    return NextResponse.json({ error: compatibilityError }, { status: 400 });
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
    agentProfile: parsed.data.agentProfile ?? null,
    status: "planned",
    createdAt: now,
    updatedAt: now,
  });

  // Link already-uploaded documents to this task
  if (parsed.data.fileIds && parsed.data.fileIds.length > 0) {
    try {
      for (const fileId of parsed.data.fileIds) {
        // Update existing document record (created by /api/uploads) to link to this task
        await db.update(documents)
          .set({
            taskId: id,
            projectId: parsed.data.projectId ?? null,
            updatedAt: now,
          })
          .where(eq(documents.id, fileId));

        // Trigger processing if not already done (fire-and-forget)
        processDocument(fileId).catch(() => {});
      }
    } catch {
      // File association is best-effort — don't fail task creation
    }
  }

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  return NextResponse.json(task, { status: 201 });
}
