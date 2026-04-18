import { defineTool } from "../tool-registry";
import { z } from "zod";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ok, err, resolveEntityId, type ToolContext } from "./helpers";
import { access, stat, copyFile, mkdir } from "fs/promises";
import { basename, extname, join } from "path";
import crypto from "crypto";
import { getAinativeUploadsDir } from "@/lib/utils/ainative-paths";
import { processDocument } from "@/lib/documents/processor";

const MIME_TYPES: Record<string, string> = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".json": "application/json",
  ".csv": "text/csv",
  ".html": "text/html",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".py": "text/x-python",
  ".rs": "text/x-rust",
  ".go": "text/x-go",
};

function resolveMimeType(filename: string): string {
  return MIME_TYPES[extname(filename).toLowerCase()] ?? "application/octet-stream";
}

export function documentTools(ctx: ToolContext) {
  return [
    defineTool(
      "list_documents",
      "List documents, optionally filtered by project, task, direction, or status.",
      {
        projectId: z
          .string()
          .optional()
          .describe("Filter by project ID. Omit to use the active project."),
        taskId: z.string().optional().describe("Filter by task ID"),
        direction: z
          .enum(["input", "output"])
          .optional()
          .describe("Filter by direction (input or output)"),
        status: z
          .enum(["uploaded", "processing", "ready", "error"])
          .optional()
          .describe("Filter by processing status"),
      },
      async (args) => {
        try {
          const effectiveProjectId = args.projectId ?? ctx.projectId ?? undefined;
          const conditions = [];
          if (effectiveProjectId)
            conditions.push(eq(documents.projectId, effectiveProjectId));
          if (args.taskId) conditions.push(eq(documents.taskId, args.taskId));
          if (args.direction) conditions.push(eq(documents.direction, args.direction));
          if (args.status) conditions.push(eq(documents.status, args.status));

          const result = await db
            .select({
              id: documents.id,
              originalName: documents.originalName,
              mimeType: documents.mimeType,
              size: documents.size,
              direction: documents.direction,
              category: documents.category,
              status: documents.status,
              taskId: documents.taskId,
              projectId: documents.projectId,
              createdAt: documents.createdAt,
            })
            .from(documents)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(documents.createdAt))
            .limit(50);

          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list documents");
        }
      }
    ),

    defineTool(
      "get_document",
      "Get metadata for a specific document (does not return file content).",
      {
        documentId: z.string().describe("The document ID to look up"),
      },
      async (args) => {
        try {
          const resolved = await resolveEntityId(documents, documents.id, args.documentId);
          if ("error" in resolved) return err(resolved.error);
          const documentId = resolved.id;

          const doc = await db
            .select({
              id: documents.id,
              originalName: documents.originalName,
              filename: documents.filename,
              mimeType: documents.mimeType,
              size: documents.size,
              direction: documents.direction,
              category: documents.category,
              status: documents.status,
              taskId: documents.taskId,
              projectId: documents.projectId,
              processingError: documents.processingError,
              createdAt: documents.createdAt,
              updatedAt: documents.updatedAt,
            })
            .from(documents)
            .where(eq(documents.id, documentId))
            .get();

          if (!doc) return err(`Document not found: ${documentId}`);
          ctx.onToolResult?.("get_document", doc);
          return ok(doc);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get document");
        }
      }
    ),

    defineTool(
      "upload_document",
      "Upload a file from the filesystem as a document. Use this to register files you create as documents in the Documents library. The file is copied to ainative storage and queued for preprocessing (text extraction).",
      {
        file_path: z.string().describe("Absolute path to the file to upload"),
        taskId: z.string().optional().describe("Associate with a task ID"),
        projectId: z.string().optional().describe("Associate with a project ID. Omit to use the active project."),
        direction: z.enum(["input", "output"]).default("output").describe("Document direction: 'input' for reference docs, 'output' for agent-generated files"),
        metadata: z.record(z.string(), z.string()).optional().describe("Custom key-value metadata for indexing"),
      },
      async (args) => {
        try {
          // Validate file exists
          await access(args.file_path);
          const stats = await stat(args.file_path);
          if (!stats.isFile()) return err(`Not a file: ${args.file_path}`);

          const originalName = basename(args.file_path);
          const mimeType = resolveMimeType(originalName);
          const id = crypto.randomUUID();
          const ext = extname(originalName);
          const filename = `${id}${ext}`;

          // Copy to uploads directory
          const uploadsDir = getAinativeUploadsDir();
          await mkdir(uploadsDir, { recursive: true });
          const storagePath = join(uploadsDir, filename);
          await copyFile(args.file_path, storagePath);

          const effectiveProjectId = args.projectId ?? ctx.projectId ?? null;
          const now = new Date();

          await db.insert(documents).values({
            id,
            taskId: args.taskId ?? null,
            projectId: effectiveProjectId,
            filename,
            originalName,
            mimeType,
            size: stats.size,
            storagePath,
            version: 1,
            direction: args.direction,
            status: "uploaded",
            createdAt: now,
            updatedAt: now,
          });

          // Fire-and-forget preprocessing
          processDocument(id).catch(() => {});

          const result = { documentId: id, status: "uploaded", processingStatus: "queued", originalName, mimeType, size: stats.size };
          ctx.onToolResult?.("upload_document", result);
          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to upload document");
        }
      }
    ),

    defineTool(
      "update_document",
      "Update document metadata or trigger reprocessing. Metadata is merged with existing values, not replaced.",
      {
        documentId: z.string().describe("The document ID to update"),
        metadata: z.record(z.string(), z.string()).optional().describe("Key-value metadata to merge into existing metadata"),
        reprocess: z.boolean().optional().describe("If true, clear extracted text and re-run preprocessing"),
      },
      async (args) => {
        try {
          const resolved = await resolveEntityId(documents, documents.id, args.documentId);
          if ("error" in resolved) return err(resolved.error);
          const documentId = resolved.id;

          const doc = await db
            .select()
            .from(documents)
            .where(eq(documents.id, documentId))
            .get();

          if (!doc) return err(`Document not found: ${documentId}`);

          const updates: Record<string, unknown> = { updatedAt: new Date() };

          // Merge metadata
          if (args.metadata) {
            const existing = doc.category ? JSON.parse(doc.category) : {};
            const merged = { ...existing, ...args.metadata };
            updates.category = JSON.stringify(merged);
          }

          // Reprocess
          if (args.reprocess) {
            updates.extractedText = null;
            updates.processedPath = null;
            updates.processingError = null;
            updates.status = "processing";
          }

          await db
            .update(documents)
            .set(updates)
            .where(eq(documents.id, documentId));

          if (args.reprocess) {
            processDocument(documentId).catch(() => {});
          }

          const updatedFields = [];
          if (args.metadata) updatedFields.push("metadata");
          if (args.reprocess) updatedFields.push("processingStatus");

          const result = {
            documentId,
            updatedFields,
            processingStatus: args.reprocess ? "queued" : doc.status,
          };
          ctx.onToolResult?.("update_document", result);
          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to update document");
        }
      }
    ),

    defineTool(
      "delete_document",
      "Delete a document. If the document is linked to a task, you must set cascadeDelete to true to confirm deletion.",
      {
        documentId: z.string().describe("The document ID to delete"),
        cascadeDelete: z.boolean().default(false).describe("If true, delete even if linked to tasks. If false and linked, returns error listing the task."),
      },
      async (args) => {
        try {
          const resolved = await resolveEntityId(documents, documents.id, args.documentId);
          if ("error" in resolved) return err(resolved.error);
          const documentId = resolved.id;

          const doc = await db
            .select()
            .from(documents)
            .where(eq(documents.id, documentId))
            .get();

          if (!doc) return err(`Document not found: ${documentId}`);

          // Check task linkage
          if (doc.taskId && !args.cascadeDelete) {
            return err(`Document is linked to task ${doc.taskId}. Set cascadeDelete to true to confirm deletion.`);
          }

          // Delete file from filesystem
          try {
            const { unlink } = await import("fs/promises");
            await unlink(doc.storagePath);
          } catch {
            // File may already be deleted
          }

          await db.delete(documents).where(eq(documents.id, documentId));

          const result = {
            success: true,
            message: doc.taskId
              ? `Document deleted. Task link removed: ${doc.taskId}`
              : "Document deleted.",
          };
          ctx.onToolResult?.("delete_document", result);
          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to delete document");
        }
      }
    ),
    defineTool(
      "read_document_content",
      "Read the full extracted text content of a document. Use this when you need to analyze, summarize, or answer questions about a document's contents.",
      {
        documentId: z.string().describe("The document ID to read"),
      },
      async (args) => {
        try {
          const resolved = await resolveEntityId(documents, documents.id, args.documentId);
          if ("error" in resolved) return err(resolved.error);
          const documentId = resolved.id;

          const doc = await db
            .select({
              id: documents.id,
              originalName: documents.originalName,
              status: documents.status,
              extractedText: documents.extractedText,
            })
            .from(documents)
            .where(eq(documents.id, documentId))
            .get();

          if (!doc) return err(`Document not found: ${documentId}`);
          if (doc.status !== "ready")
            return err(`Document not ready (status: ${doc.status}). Wait for preprocessing to complete.`);
          if (!doc.extractedText)
            return err("No extracted text available for this document.");

          return ok({
            documentId: doc.id,
            originalName: doc.originalName,
            content: doc.extractedText,
          });
        } catch (e) {
          return err(
            e instanceof Error ? e.message : "Failed to read document content"
          );
        }
      }
    ),
  ];
}
