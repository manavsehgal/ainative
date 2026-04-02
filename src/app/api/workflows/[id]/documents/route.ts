import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  workflowDocumentInputs,
  documents,
  workflows,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/workflows/[id]/documents
 * List all document bindings for a workflow, with document metadata.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const { id: workflowId } = await context.params;

  try {
    const bindings = await db
      .select()
      .from(workflowDocumentInputs)
      .where(eq(workflowDocumentInputs.workflowId, workflowId));

    if (bindings.length === 0) {
      return NextResponse.json([]);
    }

    const docIds = bindings.map((b) => b.documentId);
    const docs = await db
      .select()
      .from(documents)
      .where(inArray(documents.id, docIds));

    const docMap = new Map(docs.map((d) => [d.id, d]));

    const result = bindings.map((binding) => {
      const doc = docMap.get(binding.documentId);
      return {
        bindingId: binding.id,
        documentId: binding.documentId,
        stepId: binding.stepId,
        createdAt: binding.createdAt,
        document: doc
          ? {
              id: doc.id,
              originalName: doc.originalName,
              filename: doc.filename,
              mimeType: doc.mimeType,
              size: doc.size,
              direction: doc.direction,
              status: doc.status,
              category: doc.category,
            }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[workflow-documents] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow documents" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows/[id]/documents
 * Attach document IDs to a workflow.
 * Body: { documentIds: string[], stepId?: string }
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id: workflowId } = await context.params;

  try {
    const body = await request.json();
    const { documentIds, stepId } = body as {
      documentIds: string[];
      stepId?: string;
    };

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: "documentIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Verify workflow exists
    const [workflow] = await db
      .select({ id: workflows.id, projectId: workflows.projectId })
      .from(workflows)
      .where(eq(workflows.id, workflowId));

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Verify all documents exist
    const existingDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(inArray(documents.id, documentIds));

    const existingIds = new Set(existingDocs.map((d) => d.id));
    const missing = documentIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Documents not found: ${missing.join(", ")}` },
        { status: 404 }
      );
    }

    // Insert bindings (ignore duplicates via ON CONFLICT)
    const now = new Date();
    const values = documentIds.map((docId) => ({
      id: crypto.randomUUID(),
      workflowId,
      documentId: docId,
      stepId: stepId ?? null,
      createdAt: now,
    }));

    for (const value of values) {
      try {
        await db.insert(workflowDocumentInputs).values(value);
      } catch (err) {
        // Skip duplicates (unique constraint violation)
        const msg = err instanceof Error ? err.message : "";
        if (!msg.includes("UNIQUE constraint")) throw err;
      }
    }

    return NextResponse.json(
      { attached: documentIds.length, workflowId, stepId: stepId ?? null },
      { status: 201 }
    );
  } catch (error) {
    console.error("[workflow-documents] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to attach documents" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/[id]/documents
 * Remove document bindings from a workflow.
 * Body: { documentIds: string[], stepId?: string }
 * If no body, removes all bindings.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { id: workflowId } = await context.params;

  try {
    let body: { documentIds?: string[]; stepId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body = remove all
    }

    const { documentIds, stepId } = body;

    if (documentIds && documentIds.length > 0) {
      // Remove specific bindings
      for (const docId of documentIds) {
        const conditions = [
          eq(workflowDocumentInputs.workflowId, workflowId),
          eq(workflowDocumentInputs.documentId, docId),
        ];
        if (stepId !== undefined) {
          conditions.push(eq(workflowDocumentInputs.stepId, stepId));
        }
        await db
          .delete(workflowDocumentInputs)
          .where(and(...conditions));
      }
    } else {
      // Remove all bindings for this workflow
      await db
        .delete(workflowDocumentInputs)
        .where(eq(workflowDocumentInputs.workflowId, workflowId));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[workflow-documents] DELETE failed:", error);
    return NextResponse.json(
      { error: "Failed to remove document bindings" },
      { status: 500 }
    );
  }
}
