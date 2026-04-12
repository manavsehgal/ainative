import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  projectDocumentDefaults,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateProjectSchema } from "@/lib/validators/project";
import { deleteProjectCascade } from "@/lib/data/delete-project";

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

  try {
    const deleted = deleteProjectCascade(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Project delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
