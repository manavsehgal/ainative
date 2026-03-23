import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ok, err, type ToolContext } from "./helpers";

export function documentTools(ctx: ToolContext) {
  return [
    tool(
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

    tool(
      "get_document",
      "Get metadata for a specific document (does not return file content).",
      {
        documentId: z.string().describe("The document ID to look up"),
      },
      async (args) => {
        try {
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
            .where(eq(documents.id, args.documentId))
            .get();

          if (!doc) return err(`Document not found: ${args.documentId}`);
          ctx.onToolResult?.("get_document", doc);
          return ok(doc);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get document");
        }
      }
    ),
  ];
}
