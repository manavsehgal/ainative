import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  tasks,
  workflows,
  documents,
  schedules,
  agentLogs,
  notifications,
  learnedContext,
  usageLedger,
  environmentSyncOps,
  environmentCheckpoints,
  environmentArtifacts,
  environmentScans,
  chatMessages,
  conversations,
  projectDocumentDefaults,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { updateProjectSchema } from "@/lib/validators/project";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  // Extract documentIds before validation (not a project column)
  const { documentIds, ...projectBody } = body as Record<string, unknown> & { documentIds?: string[] };
  const parsed = updateProjectSchema.safeParse(projectBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: now })
    .where(eq(projects.id, id));

  // Handle default document bindings
  if (documentIds !== undefined) {
    try {
      // Replace all bindings
      await db
        .delete(projectDocumentDefaults)
        .where(eq(projectDocumentDefaults.projectId, id));
      for (const docId of documentIds) {
        try {
          await db.insert(projectDocumentDefaults).values({
            id: crypto.randomUUID(),
            projectId: id,
            documentId: docId,
            createdAt: now,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (!msg.includes("UNIQUE constraint")) throw err;
        }
      }
    } catch (err) {
      console.error("[projects] Document defaults update failed:", err);
    }
  }

  const [updated] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [existing] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Cascade-delete in FK-safe order (children before parents)
    // Follows the same pattern as clear.ts and workflow DELETE

    // 1. Collect child IDs for nested FK chains
    const taskIds = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.projectId, id))
      .all()
      .map((r) => r.id);

    const workflowIds = db
      .select({ id: workflows.id })
      .from(workflows)
      .where(eq(workflows.projectId, id))
      .all()
      .map((r) => r.id);

    const conversationIds = db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.projectId, id))
      .all()
      .map((r) => r.id);

    const scanIds = db
      .select({ id: environmentScans.id })
      .from(environmentScans)
      .where(eq(environmentScans.projectId, id))
      .all()
      .map((r) => r.id);

    const checkpointIds = db
      .select({ id: environmentCheckpoints.id })
      .from(environmentCheckpoints)
      .where(eq(environmentCheckpoints.projectId, id))
      .all()
      .map((r) => r.id);

    // 2. Environment tables (deepest children first)
    if (checkpointIds.length > 0) {
      db.delete(environmentSyncOps)
        .where(inArray(environmentSyncOps.checkpointId, checkpointIds))
        .run();
      db.delete(environmentCheckpoints)
        .where(inArray(environmentCheckpoints.id, checkpointIds))
        .run();
    }
    if (scanIds.length > 0) {
      db.delete(environmentArtifacts)
        .where(inArray(environmentArtifacts.scanId, scanIds))
        .run();
      db.delete(environmentScans)
        .where(inArray(environmentScans.id, scanIds))
        .run();
    }

    // 3. Chat tables (messages before conversations)
    if (conversationIds.length > 0) {
      db.delete(chatMessages)
        .where(inArray(chatMessages.conversationId, conversationIds))
        .run();
      db.delete(conversations)
        .where(inArray(conversations.id, conversationIds))
        .run();
    }

    // 4. Usage ledger (references projectId, workflowId, taskId)
    db.delete(usageLedger).where(eq(usageLedger.projectId, id)).run();

    // 5. Task children (logs, notifications, documents, learned context)
    if (taskIds.length > 0) {
      db.delete(agentLogs).where(inArray(agentLogs.taskId, taskIds)).run();
      db.delete(notifications)
        .where(inArray(notifications.taskId, taskIds))
        .run();
      db.delete(documents).where(inArray(documents.taskId, taskIds)).run();
      db.delete(learnedContext)
        .where(inArray(learnedContext.sourceTaskId, taskIds))
        .run();
    }

    // 6. Project document defaults (junction table)
    db.delete(projectDocumentDefaults).where(eq(projectDocumentDefaults.projectId, id)).run();

    // 7. Direct project children
    db.delete(documents).where(eq(documents.projectId, id)).run();
    db.delete(tasks).where(eq(tasks.projectId, id)).run();
    if (workflowIds.length > 0) {
      db.delete(workflows).where(inArray(workflows.id, workflowIds)).run();
    }
    db.delete(schedules).where(eq(schedules.projectId, id)).run();

    // 7. Finally delete the project
    db.delete(projects).where(eq(projects.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Project delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
