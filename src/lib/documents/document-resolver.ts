/**
 * Resolve document selectors against the project document pool.
 * Used at workflow creation time for auto-discovery of relevant documents.
 */

import { db } from "@/lib/db";
import { documents, workflows, tasks } from "@/lib/db/schema";
import { and, eq, desc, like, inArray } from "drizzle-orm";
import type { DocumentRow } from "@/lib/db/schema";
import type { DocumentSelector } from "@/lib/workflows/types";

/**
 * Resolve a DocumentSelector against the project pool, returning matching documents.
 * Used for auto-discovery at workflow creation time (not at execution time).
 */
export async function resolveDocumentSelector(
  projectId: string,
  selector: DocumentSelector
): Promise<DocumentRow[]> {
  const conditions = [eq(documents.projectId, projectId)];

  if (selector.direction) {
    conditions.push(eq(documents.direction, selector.direction));
  }

  if (selector.category) {
    conditions.push(eq(documents.category, selector.category));
  }

  if (selector.mimeType) {
    conditions.push(eq(documents.mimeType, selector.mimeType));
  }

  if (selector.namePattern) {
    // Convert glob pattern to SQL LIKE: * → %, ? → _
    const likePattern = selector.namePattern
      .replace(/\*/g, "%")
      .replace(/\?/g, "_");
    conditions.push(like(documents.originalName, likePattern));
  }

  // Filter by source workflow (via task → workflow relationship)
  if (selector.fromWorkflowId) {
    const workflowTaskIds = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.workflowId, selector.fromWorkflowId));

    const taskIds = workflowTaskIds.map((t) => t.id);
    if (taskIds.length === 0) return [];
    conditions.push(inArray(documents.taskId, taskIds));
  } else if (selector.fromWorkflowName) {
    // Look up workflow by name, then get its task IDs
    const matchingWorkflows = await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(
        and(
          eq(workflows.projectId, projectId),
          like(workflows.name, `%${selector.fromWorkflowName}%`)
        )
      );

    if (matchingWorkflows.length === 0) return [];

    const wfIds = matchingWorkflows.map((w) => w.id);
    const workflowTaskIds = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(inArray(tasks.workflowId, wfIds));

    const taskIds = workflowTaskIds.map((t) => t.id);
    if (taskIds.length === 0) return [];
    conditions.push(inArray(documents.taskId, taskIds));
  }

  // Only return ready documents (processed and available)
  conditions.push(eq(documents.status, "ready"));

  let query = db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt));

  if (selector.latest) {
    query = query.limit(selector.latest) as typeof query;
  }

  return query;
}

/**
 * Get all output documents from completed workflows in a project.
 * Useful for browsing the project document pool.
 */
export async function getProjectDocumentPool(
  projectId: string,
  options?: { direction?: "input" | "output"; search?: string }
): Promise<DocumentRow[]> {
  const conditions = [
    eq(documents.projectId, projectId),
    eq(documents.status, "ready"),
  ];

  if (options?.direction) {
    conditions.push(eq(documents.direction, options.direction));
  }

  if (options?.search) {
    conditions.push(like(documents.originalName, `%${options.search}%`));
  }

  return db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt));
}
