import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projectDocumentDefaults,
  documents,
  projects,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/documents
 * List all default document bindings for a project, with document metadata.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const { id: projectId } = await context.params;

  try {
    const bindings = await db
      .select()
      .from(projectDocumentDefaults)
      .where(eq(projectDocumentDefaults.projectId, projectId));

    if (bindings.length === 0) {
      return NextResponse.json([]);
    }

    const docIds = bindings.map((b) => b.documentId);
    const docs = await db
      .select()
      .from(documents)
      .where(inArray(documents.id, docIds));

    // Return flat document list (same shape as /api/documents)
    return NextResponse.json(
      docs.map((doc) => ({
        id: doc.id,
        originalName: doc.originalName,
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        direction: doc.direction,
        status: doc.status,
        category: doc.category,
      }))
    );
  } catch (error) {
    console.error("[project-documents] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch project documents" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]/documents
 * Replace all default document bindings for a project.
 * Body: { documentIds: string[] }
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { id: projectId } = await context.params;

  try {
    const body = await request.json();
    const { documentIds } = body as { documentIds: string[] };

    if (!Array.isArray(documentIds)) {
      return NextResponse.json(
        { error: "documentIds must be an array" },
        { status: 400 }
      );
    }

    // Verify project exists
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Remove all existing bindings
    await db
      .delete(projectDocumentDefaults)
      .where(eq(projectDocumentDefaults.projectId, projectId));

    // Insert new bindings
    const now = new Date();
    for (const docId of documentIds) {
      try {
        await db.insert(projectDocumentDefaults).values({
          id: crypto.randomUUID(),
          projectId,
          documentId: docId,
          createdAt: now,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (!msg.includes("UNIQUE constraint")) throw err;
      }
    }

    return NextResponse.json({ updated: documentIds.length, projectId });
  } catch (error) {
    console.error("[project-documents] PUT failed:", error);
    return NextResponse.json(
      { error: "Failed to update project documents" },
      { status: 500 }
    );
  }
}
