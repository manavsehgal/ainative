/**
 * Build document context section for agent prompts.
 * Queries documents linked to a task and formats them for the agent.
 */

import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
    .where(eq(documents.taskId, taskId));

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
