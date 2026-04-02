/**
 * Build document context section for agent prompts.
 * Queries documents linked to a task and formats them for the agent.
 */

import { db } from "@/lib/db";
import { documents, workflowDocumentInputs } from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DocumentRow } from "@/lib/db/schema";

const MAX_INLINE_TEXT = 10_000;

function formatDocument(doc: DocumentRow, index: number): string {
  const header = `[Document ${index + 1}: ${doc.originalName}]`;
  const pathLine = `Path: ${doc.storagePath}`;

  const isImage = doc.mimeType.startsWith("image/");

  // Images: path reference only (agent uses Read tool to view)
  if (isImage) {
    const meta = doc.extractedText ? `\n${doc.extractedText}` : "";
    return `${header}\n${pathLine}\nType: ${doc.mimeType} (use Read tool to view)${meta}`;
  }

  // Processing or failed: path + status note
  if (doc.status === "processing") {
    return `${header}\n${pathLine}\nStatus: still processing — content not yet available`;
  }

  if (doc.status === "error") {
    return `${header}\n${pathLine}\nStatus: processing failed (${doc.processingError ?? "unknown error"})`;
  }

  if (doc.status === "uploaded") {
    return `${header}\n${pathLine}\nStatus: not yet processed`;
  }

  // Ready with extracted text
  if (doc.extractedText) {
    if (doc.extractedText.length < MAX_INLINE_TEXT) {
      return `${header}\n${pathLine}\nContent:\n<document>\n${doc.extractedText}\n</document>`;
    }
    // Large document: truncated + path reference
    const truncated = doc.extractedText.slice(0, MAX_INLINE_TEXT);
    return `${header}\n${pathLine}\nContent (truncated to ${MAX_INLINE_TEXT} chars — use Read tool for full content):\n<document>\n${truncated}\n</document>`;
  }

  // Ready but no extracted text (unsupported format)
  return `${header}\n${pathLine}\nType: ${doc.mimeType} (use Read tool to access)`;
}

/**
 * Build the document context string for a task's prompt.
 * Returns null if the task has no documents.
 */
export async function buildDocumentContext(
  taskId: string
): Promise<string | null> {
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.taskId, taskId), eq(documents.direction, "input")));

  if (docs.length === 0) return null;

  const sections = docs.map((doc, i) => formatDocument(doc, i));

  return [
    "--- Attached Documents ---",
    "",
    ...sections,
    "",
    "--- End Attached Documents ---",
  ].join("\n");
}

const MAX_WORKFLOW_DOC_CONTEXT = 30_000;

/**
 * Build document context for workflow child tasks by querying the parent task's
 * input documents. Returns null if no parent task or no documents.
 */
export async function buildWorkflowDocumentContext(
  parentTaskId?: string
): Promise<string | null> {
  if (!parentTaskId) return null;

  try {
    const docs = await db
      .select()
      .from(documents)
      .where(and(eq(documents.taskId, parentTaskId), eq(documents.direction, "input")));

    if (docs.length === 0) return null;

    const sections = docs.map((doc, i) => formatDocument(doc, i));
    let result = sections.join("\n\n");

    // Guard against prompt bloat from many/large attachments
    if (result.length > MAX_WORKFLOW_DOC_CONTEXT) {
      result = result.slice(0, MAX_WORKFLOW_DOC_CONTEXT);
      result += `\n\n(Document context truncated at ${MAX_WORKFLOW_DOC_CONTEXT} chars — use Read tool for full content)`;
    }

    return [
      "--- Parent Task Documents ---",
      "",
      result,
      "",
      "--- End Parent Task Documents ---",
    ].join("\n");
  } catch (error) {
    console.error("[context-builder] Failed to build workflow document context:", error);
    return null;
  }
}

/**
 * Build document context from the workflow document pool (junction table).
 * Queries workflow_document_inputs for documents bound to this workflow,
 * optionally scoped to a specific step. Returns null if no pool documents.
 *
 * Includes both workflow-level bindings (stepId=null) and step-specific bindings.
 */
export async function buildPoolDocumentContext(
  workflowId: string,
  stepId?: string
): Promise<string | null> {
  try {
    // Get workflow-level (stepId=null) bindings — available to all steps
    const globalBindings = await db
      .select({ documentId: workflowDocumentInputs.documentId })
      .from(workflowDocumentInputs)
      .where(
        and(
          eq(workflowDocumentInputs.workflowId, workflowId),
          isNull(workflowDocumentInputs.stepId)
        )
      );

    // If a specific step, also get step-scoped bindings
    let stepBindings: { documentId: string }[] = [];
    if (stepId) {
      stepBindings = await db
        .select({ documentId: workflowDocumentInputs.documentId })
        .from(workflowDocumentInputs)
        .where(
          and(
            eq(workflowDocumentInputs.workflowId, workflowId),
            eq(workflowDocumentInputs.stepId, stepId)
          )
        );
    }

    // Deduplicate document IDs
    const docIdSet = new Set<string>();
    for (const b of [...globalBindings, ...stepBindings]) {
      docIdSet.add(b.documentId);
    }

    if (docIdSet.size === 0) return null;

    const docs = await db
      .select()
      .from(documents)
      .where(inArray(documents.id, [...docIdSet]));

    if (docs.length === 0) return null;

    const sections = docs.map((doc, i) => formatDocument(doc, i));
    let result = sections.join("\n\n");

    if (result.length > MAX_WORKFLOW_DOC_CONTEXT) {
      result = result.slice(0, MAX_WORKFLOW_DOC_CONTEXT);
      result += `\n\n(Pool document context truncated at ${MAX_WORKFLOW_DOC_CONTEXT} chars — use Read tool for full content)`;
    }

    return [
      "--- Workflow Pool Documents ---",
      "",
      result,
      "",
      "--- End Workflow Pool Documents ---",
    ].join("\n");
  } catch (error) {
    console.error("[context-builder] Failed to build pool document context:", error);
    return null;
  }
}
