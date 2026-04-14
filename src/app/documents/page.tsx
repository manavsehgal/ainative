import { Suspense } from "react";
import { db } from "@/lib/db";
import { documents, tasks, projects, workflows } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { DocumentBrowser } from "@/components/documents/document-browser";
import { PageShell } from "@/components/shared/page-shell";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const docs = await db
    .select({
      id: documents.id,
      taskId: documents.taskId,
      projectId: documents.projectId,
      filename: documents.filename,
      originalName: documents.originalName,
      mimeType: documents.mimeType,
      size: documents.size,
      storagePath: documents.storagePath,
      version: documents.version,
      direction: documents.direction,
      category: documents.category,
      status: documents.status,
      extractedText: documents.extractedText,
      processedPath: documents.processedPath,
      processingError: documents.processingError,
      source: documents.source,
      conversationId: documents.conversationId,
      messageId: documents.messageId,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      taskTitle: tasks.title,
      projectName: projects.name,
      workflowId: workflows.id,
      workflowName: workflows.name,
      workflowRunNumber: tasks.workflowRunNumber,
    })
    .from(documents)
    .leftJoin(tasks, eq(documents.taskId, tasks.id))
    .leftJoin(workflows, eq(tasks.workflowId, workflows.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .orderBy(desc(documents.createdAt));

  const projectList = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects);

  return (
    <PageShell title="Documents">
      <Suspense fallback={null}>
        <DocumentBrowser initialDocuments={docs} projects={projectList} />
      </Suspense>
    </PageShell>
  );
}
