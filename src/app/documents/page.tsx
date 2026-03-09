import { db } from "@/lib/db";
import { documents, tasks, projects } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { DocumentBrowser } from "@/components/documents/document-browser";

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
      direction: documents.direction,
      category: documents.category,
      status: documents.status,
      extractedText: documents.extractedText,
      processedPath: documents.processedPath,
      processingError: documents.processingError,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      taskTitle: tasks.title,
      projectName: projects.name,
    })
    .from(documents)
    .leftJoin(tasks, eq(documents.taskId, tasks.id))
    .leftJoin(projects, eq(documents.projectId, projects.id))
    .orderBy(desc(documents.createdAt));

  const projectList = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects);

  return (
    <div className="gradient-forest-dawn min-h-screen flex flex-col gap-4 p-4 md:p-6">
      <DocumentBrowser initialDocuments={docs} projects={projectList} />
    </div>
  );
}
