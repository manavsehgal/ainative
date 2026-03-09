/**
 * Document processing pipeline orchestrator.
 * Registers all processors and provides the fire-and-forget processDocument entry point.
 */

import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { registerProcessor, getProcessor } from "./registry";
import { processText } from "./processors/text";
import { processPdf } from "./processors/pdf";
import { processImage } from "./processors/image";
import { processDocx, processPptx } from "./processors/office";
import { processSpreadsheet } from "./processors/spreadsheet";

// Register all processors by MIME type
// Text-based formats
const textMimeTypes = [
  "text/plain",
  "text/markdown",
  "application/json",
  "text/javascript",
  "text/typescript",
  "text/x-python",
  "text/html",
  "text/css",
  "text/yaml",
  "application/x-yaml",
];
for (const mime of textMimeTypes) {
  registerProcessor(mime, processText);
}

// PDF
registerProcessor("application/pdf", processPdf);

// Images
const imageMimeTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
for (const mime of imageMimeTypes) {
  registerProcessor(mime, processImage);
}

// Office documents
registerProcessor(
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  processDocx
);
registerProcessor(
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  processPptx
);

// Spreadsheets
registerProcessor(
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  processSpreadsheet
);
registerProcessor("text/csv", processSpreadsheet);

/**
 * Process a document asynchronously. Updates the document record with
 * extracted text or error. Never throws — errors are captured in DB.
 */
export async function processDocument(documentId: string): Promise<void> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) return;

  // Mark as processing
  await db
    .update(documents)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  const processor = getProcessor(doc.mimeType);

  if (!processor) {
    // No processor for this type — mark as ready with empty text
    await db
      .update(documents)
      .set({
        status: "ready",
        extractedText: null,
        processingError: `No processor for MIME type: ${doc.mimeType}`,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
    return;
  }

  try {
    const result = await processor(doc.storagePath);

    await db
      .update(documents)
      .set({
        status: "ready",
        extractedText: result.extractedText,
        processedPath: result.processedPath ?? null,
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await db
      .update(documents)
      .set({
        status: "error",
        processingError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
  }
}
